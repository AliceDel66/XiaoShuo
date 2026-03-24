import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  DEFAULT_MODEL_PROFILE,
  DEFAULT_WORKBENCH_SETTINGS,
  WORKFLOW_ACTION_LABELS
} from "../../shared/defaults";
import type {
  AppApi,
  ArtifactEditorDocument,
  DashboardData,
  ExportProjectInput,
  GenerationEvent,
  ImportCorpusInput,
  ModelProfile,
  PreviewSession,
  ProjectSnapshot,
  SearchCorpusInput,
  WorkbenchSettings,
  WorkflowExecutionInput
} from "../../shared/types";
import { AiOrchestrator, type FallbackPolicy } from "./ai-orchestrator";
import { CorpusService } from "./corpus-service";
import { ExportService } from "./export-service";
import { deepClone, ensureDir, nowIso, readYaml, writeYaml } from "./helpers";
import { GenerationCoordinator } from "./generation-coordinator";
import { LibraryDatabase } from "./library-database";
import { PreviewSessionService } from "./preview-session-service";
import { ProjectRepository } from "./project-repository";
import { evaluateOutstandingWarnings, WorkflowService } from "./workflow-service";
import { StoryMemoryService } from "./story-memory-service";
import type { MemoryPatch, StoryMemory } from "../../shared/memory-types";

export class WorkbenchService implements AppApi {
  private database!: LibraryDatabase;

  private readonly projectRepository: ProjectRepository;

  private readonly exportService = new ExportService();

  private readonly aiOrchestrator: AiOrchestrator;

  private workflowService!: WorkflowService;

  private corpusService!: CorpusService;

  private previewSessionService!: PreviewSessionService;

  private generationCoordinator!: GenerationCoordinator;

  private storyMemoryService!: StoryMemoryService;

  private readonly modelProfilePath: string;

  private readonly workbenchSettingsPath: string;

  constructor(
    private readonly dataDirectory: string,
    private readonly defaultProjectsDirectory: string,
    private readonly builtinCorpusDirectory: string,
    fallbackPolicy: FallbackPolicy = "allow"
  ) {
    this.projectRepository = new ProjectRepository(defaultProjectsDirectory);
    this.modelProfilePath = join(dataDirectory, "settings", "model-profile.yaml");
    this.workbenchSettingsPath = join(dataDirectory, "settings", "workbench-settings.yaml");
    this.aiOrchestrator = new AiOrchestrator(() => this.getModelProfileInternal(), fallbackPolicy);
  }

  async init(): Promise<void> {
    await ensureDir(this.dataDirectory);
    await mkdir(this.defaultProjectsDirectory, { recursive: true });
    this.database = new LibraryDatabase(join(this.dataDirectory, "library.sqlite"));
    this.workflowService = new WorkflowService(this.projectRepository, this.aiOrchestrator, this.exportService);
    this.storyMemoryService = new StoryMemoryService(this.projectRepository);
    this.workflowService.setStoryMemoryService(this.storyMemoryService);
    this.corpusService = new CorpusService(this.database, this.aiOrchestrator, this.builtinCorpusDirectory);
    this.previewSessionService = new PreviewSessionService(join(this.dataDirectory, "preview-sessions"));
    await this.previewSessionService.init();
    this.generationCoordinator = new GenerationCoordinator(
      this.workflowService,
      this.previewSessionService,
      (input) => this.loadGenerationContext(input)
    );
    await this.saveModelProfile(await this.getModelProfileInternal());
    await this.saveWorkbenchSettings(await this.getWorkbenchSettingsInternal());
    await this.corpusService.seedBuiltinCorpora();
  }

  onGenerationEvent(listener: (event: GenerationEvent) => void): () => void {
    return this.generationCoordinator.onEvent(listener);
  }

  subscribeGenerationEvents(listener: (event: GenerationEvent) => void): () => void {
    return this.onGenerationEvent(listener);
  }

  async getDashboardData(): Promise<DashboardData> {
    const settings = await this.getWorkbenchSettingsInternal();
    const projects = this.database.listProjects();
    const archivedProjects = this.database.listArchivedProjects();
    const corpora = this.database.listCorpora();
    const preferredProjectId =
      settings.startupPreferences.reopenLastProject && settings.startupPreferences.lastOpenedProjectId
        ? settings.startupPreferences.lastOpenedProjectId
        : null;
    const selectedManifest =
      [...projects, ...archivedProjects].find((project) => project.projectId === preferredProjectId) ??
      projects[0] ??
      archivedProjects[0] ??
      null;
    const selectedProject = selectedManifest ? await this.getProject(selectedManifest.projectId) : null;
    return {
      modelProfile: await this.getModelProfileInternal(),
      settings,
      projects,
      archivedProjects,
      corpora,
      selectedProject,
      activeJob: this.generationCoordinator.getActiveJob(),
      activePreviewSession: await this.generationCoordinator.getActivePreviewSession()
    };
  }

  async saveModelProfile(profile: ModelProfile): Promise<ModelProfile> {
    const normalized = normalizeModelProfile(profile);
    await writeYaml(this.modelProfilePath, normalized);
    return normalized;
  }

  async testModelProfileConnection(profile: ModelProfile) {
    return this.aiOrchestrator.testConnection(normalizeModelProfile(profile));
  }

  async saveWorkbenchSettings(settings: WorkbenchSettings): Promise<WorkbenchSettings> {
    const normalized = normalizeWorkbenchSettings(settings);
    await writeYaml(this.workbenchSettingsPath, normalized);
    this.workflowService.setPromptTemplates(normalized.promptTemplates);
    return normalized;
  }

  async createProject(input: Parameters<AppApi["createProject"]>[0]): Promise<ProjectSnapshot> {
    const settings = await this.getWorkbenchSettingsInternal();
    const manifest = await this.projectRepository.createProject({
      ...input,
      rootDirectory: input.rootDirectory || settings.projectDefaults.defaultRootDirectory || undefined
    });
    this.database.upsertProject(manifest);
    await this.saveWorkbenchSettings({
      ...settings,
      startupPreferences: {
        ...settings.startupPreferences,
        lastOpenedProjectId: manifest.projectId
      }
    });
    const snapshot = await this.projectRepository.loadProjectSnapshot(manifest.rootPath);
    snapshot.unresolvedWarnings = evaluateOutstandingWarnings(snapshot);
    return snapshot;
  }

  async getProject(projectId: string): Promise<ProjectSnapshot> {
    const manifest = this.database.getProjectManifest(projectId);
    if (!manifest) {
      throw new Error(`Project not found: ${projectId}`);
    }
    const snapshot = await this.projectRepository.loadProjectSnapshot(manifest.rootPath);
    snapshot.unresolvedWarnings = evaluateOutstandingWarnings(snapshot);
    return snapshot;
  }

  async archiveProject(projectId: string): Promise<DashboardData> {
    const manifest = this.database.getProjectManifest(projectId);
    if (!manifest) {
      throw new Error(`Project not found: ${projectId}`);
    }
    if (this.generationCoordinator.getActiveJob()?.projectId === projectId) {
      throw new Error("当前项目仍有生成任务运行中，暂时不能归档。");
    }

    const nextManifest = {
      ...manifest,
      archivedAt: nowIso(),
      updatedAt: nowIso()
    };
    await this.projectRepository.saveManifest(nextManifest);
    this.database.upsertProject(nextManifest);
    return this.getDashboardData();
  }

  async restoreProject(projectId: string): Promise<DashboardData> {
    const manifest = this.database.getProjectManifest(projectId);
    if (!manifest) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const nextManifest = {
      ...manifest,
      archivedAt: null,
      updatedAt: nowIso()
    };
    await this.projectRepository.saveManifest(nextManifest);
    this.database.upsertProject(nextManifest);
    return this.getDashboardData();
  }

  async deleteProject(projectId: string): Promise<DashboardData> {
    const manifest = this.database.getProjectManifest(projectId);
    if (!manifest) {
      throw new Error(`Project not found: ${projectId}`);
    }
    if (this.generationCoordinator.getActiveJob()?.projectId === projectId) {
      throw new Error("当前项目仍有生成任务运行中，无法删除。");
    }
    this.database.deleteProject(projectId);
    return this.getDashboardData();
  }

  async executeWorkflow(input: WorkflowExecutionInput) {
    const snapshot = await this.getProject(input.projectId);
    const { referenceHints, referenceMatches } = this.loadReferenceContext(snapshot, input);
    const result = await this.workflowService.execute(snapshot, input, referenceHints, referenceMatches);
    this.database.upsertProject(result.updatedProject.manifest);
    return result;
  }

  async importCorpus(input: ImportCorpusInput) {
    return this.corpusService.importCorpus(input);
  }

  async searchCorpus(input: SearchCorpusInput) {
    return this.corpusService.search(input);
  }

  async exportProject(input: ExportProjectInput): Promise<string> {
    const snapshot = await this.getProject(input.projectId);
    const outputPath = await this.workflowService.runExport(snapshot, input.format);
    const settings = await this.getWorkbenchSettingsInternal();
    await this.saveWorkbenchSettings({
      ...settings,
      exportPreferences: {
        ...settings.exportPreferences,
        preferredFormat: input.format,
        lastExportedFormat: input.format,
        lastExportedPath: outputPath,
        lastExportedAt: nowIso()
      }
    });
    return outputPath;
  }

  async pickCorpusFile(): Promise<string | null> {
    throw new Error("pickCorpusFile is only available through the Electron dialog bridge.");
  }

  async startGeneration(input: WorkflowExecutionInput): Promise<{ jobId: string; sessionId: string }> {
    return this.generationCoordinator.startGeneration(input);
  }

  async getPreviewSession(sessionId: string): Promise<PreviewSession> {
    return this.previewSessionService.getSession(sessionId);
  }

  async regenerateCandidate(sessionId: string): Promise<{ jobId: string }> {
    const session = await this.previewSessionService.getSession(sessionId);
    const result = await this.generationCoordinator.startGeneration(session.request, sessionId);
    return { jobId: result.jobId };
  }

  async confirmCandidate(sessionId: string, candidateId: string): Promise<ProjectSnapshot> {
    const session = await this.previewSessionService.getSession(sessionId);
    const candidate = session.candidates.find((item) => item.candidateId === candidateId);
    if (!candidate) {
      throw new Error(`Preview candidate not found: ${candidateId}`);
    }
    const snapshot = await this.getProject(session.projectId);
    const updatedProject = await this.workflowService.applyConfirmedArtifact(snapshot, session.artifactRef, candidate);
    updatedProject.unresolvedWarnings = evaluateOutstandingWarnings(updatedProject);
    this.database.upsertProject(updatedProject.manifest);
    await this.previewSessionService.updateSession(sessionId, (current) => ({
      ...current,
      status: "confirmed",
      selectedCandidateId: candidateId
    }));

    // Phase 2: Extract memory patch after chapter-related confirmations
    if (
      session.action === "update-chapter-state" &&
      candidate.structuredPayload
    ) {
      try {
        const rootPath = updatedProject.manifest.rootPath;
        const memory = await this.storyMemoryService.loadMemory(
          rootPath,
          updatedProject.manifest.projectId
        );
        const stateDelta = candidate.structuredPayload as import("../../shared/types").ChapterStateDelta;
        const patch = this.storyMemoryService.extractPatchFromStateDelta(stateDelta, memory);

        if (patch.operations.length > 0) {
          const validation = this.storyMemoryService.validatePatch(patch, memory);
          if (validation.valid && validation.conflicts.length === 0) {
            // Auto-apply if no conflicts
            const newMemory = this.storyMemoryService.applyPatch(patch, memory);
            await this.storyMemoryService.saveMemory(rootPath, newMemory);
          } else {
            // Save as pending for human review
            patch.conflicts = validation.conflicts;
            await this.storyMemoryService.savePendingPatch(rootPath, patch);
          }
        }
      } catch (error) {
        // Memory patch extraction is non-blocking
        console.warn("[WorkbenchService] Memory patch extraction failed:", error);
      }
    }

    // Phase 2: Bible-sync when story-bible is confirmed
    if (session.action === "generate-story-bible" && candidate.structuredPayload) {
      try {
        const rootPath = updatedProject.manifest.rootPath;
        const memory = await this.storyMemoryService.loadMemory(
          rootPath,
          updatedProject.manifest.projectId
        );
        const bible = candidate.structuredPayload as import("../../shared/types").StoryBible;
        const patch = this.storyMemoryService.initFromBible(memory, bible);
        const newMemory = this.storyMemoryService.applyPatch(patch, memory);
        await this.storyMemoryService.saveMemory(rootPath, newMemory);
      } catch (error) {
        console.warn("[WorkbenchService] Bible-sync failed:", error);
      }
    }

    return updatedProject;
  }

  async discardPreviewSession(sessionId: string): Promise<void> {
    await this.previewSessionService.discardSession(sessionId);
  }

  async openArtifactEditor(artifactRef: Parameters<AppApi["openArtifactEditor"]>[0]): Promise<ArtifactEditorDocument> {
    const snapshot = await this.getProject(artifactRef.projectId);
    return this.projectRepository.openArtifactDocument(snapshot, artifactRef);
  }

  async saveArtifactEdits(document: ArtifactEditorDocument): Promise<ProjectSnapshot> {
    const snapshot = await this.getProject(document.artifactRef.projectId);
    const updatedProject = await this.projectRepository.saveArtifactDocument(snapshot, document);
    updatedProject.unresolvedWarnings = evaluateOutstandingWarnings(updatedProject);
    this.database.upsertProject(updatedProject.manifest);
    return updatedProject;
  }

  async createEmptyDraft(projectId: string, volumeNumber: number, chapterNumber: number, chapterTitle: string): Promise<ProjectSnapshot> {
    const snapshot = await this.getProject(projectId);
    const existingDraft = snapshot.drafts.find((d) => d.chapterNumber === chapterNumber && d.volumeNumber === volumeNumber);
    if (existingDraft) {
      return snapshot;
    }
    const outline = snapshot.outlines.find(
      (o) => o.level === "chapter" && o.chapterNumber === chapterNumber && o.volumeNumber === volumeNumber
    );
    const draftId = `chapter-${String(chapterNumber).padStart(3, "0")}`;
    const draftMarkdown = outline
      ? [
          `# ${outline.title}`,
          "",
          `> 目标：${outline.goal}`,
          `> 冲突：${outline.conflict}`,
          `> 钩子：${outline.hook}`,
          "",
          ""
        ].join("\n")
      : `# ${chapterTitle}\n\n`;
    const document: ArtifactEditorDocument = {
      artifactRef: { artifactType: "draft", artifactId: draftId, projectId },
      mode: "form",
      displayTitle: chapterTitle,
      format: "markdown",
      rawText: draftMarkdown,
      structuredPayload: {
        title: outline?.title ?? chapterTitle,
        chapterNumber,
        volumeNumber,
        scope: "chapter"
      },
      isDirty: true
    };
    const updatedProject = await this.projectRepository.saveArtifactDocument(snapshot, document);
    updatedProject.unresolvedWarnings = evaluateOutstandingWarnings(updatedProject);
    this.database.upsertProject(updatedProject.manifest);
    return updatedProject;
  }

  dispose(): void {
    this.database.close();
  }

  private async getModelProfileInternal(): Promise<ModelProfile> {
    return readYaml(this.modelProfilePath, DEFAULT_MODEL_PROFILE);
  }

  private async getWorkbenchSettingsInternal(): Promise<WorkbenchSettings> {
    const settings = normalizeWorkbenchSettings(await readYaml(this.workbenchSettingsPath, DEFAULT_WORKBENCH_SETTINGS));
    if (settings.projectDefaults.defaultRootDirectory !== this.defaultProjectsDirectory) {
      settings.projectDefaults.defaultRootDirectory ||= this.defaultProjectsDirectory;
    }
    if (JSON.stringify(settings.promptTemplates) !== JSON.stringify(this.workflowService.getPromptTemplates())) {
      this.workflowService.setPromptTemplates(settings.promptTemplates);
    }
    return settings;
  }

  private loadReferenceContext(snapshot: ProjectSnapshot, input: WorkflowExecutionInput) {
    const referenceHints = this.database
      .listCorpora()
      .filter((corpus) => input.referenceCorpusIds?.includes(corpus.corpusId));
    const query = deriveReferenceQuery(snapshot, input);
    const referenceMatches =
      referenceHints.length > 0
        ? this.corpusService.search({
            query,
            corpusIds: referenceHints.map((corpus) => corpus.corpusId),
            limit: 4
          })
        : [];
    return { referenceHints, referenceMatches };
  }

  private async loadGenerationContext(input: WorkflowExecutionInput) {
    const snapshot = await this.getProject(input.projectId);
    const { referenceHints, referenceMatches } = this.loadReferenceContext(snapshot, input);

    // Phase 2: Load memory context for generation
    let memoryContext = null;
    try {
      const memory = await this.storyMemoryService.loadMemory(
        snapshot.manifest.rootPath,
        snapshot.manifest.projectId
      );
      if (memory.version > 0) {
        const budget = this.storyMemoryService.getContextBudget(input.action);
        memoryContext = this.storyMemoryService.assembleContext(
          memory,
          input.action,
          { volumeNumber: input.volumeNumber ?? 1, chapterNumber: input.chapterNumber },
          budget
        );
      }
    } catch (error) {
      console.warn("[WorkbenchService] Memory context loading failed, falling back to legacy:", error);
    }

    return {
      snapshot,
      referenceHints,
      referenceMatches,
      memoryContext
    };
  }

  // ── Phase 2: Story Memory API methods ─────────────

  async getStoryMemory(projectId: string): Promise<StoryMemory> {
    const manifest = this.database.getProjectManifest(projectId);
    if (!manifest) throw new Error(`Project not found: ${projectId}`);
    return this.storyMemoryService.loadMemory(manifest.rootPath, projectId);
  }

  async getPendingPatches(projectId: string): Promise<MemoryPatch[]> {
    const manifest = this.database.getProjectManifest(projectId);
    if (!manifest) throw new Error(`Project not found: ${projectId}`);
    return this.storyMemoryService.loadPendingPatches(manifest.rootPath);
  }

  async reviewPatch(
    projectId: string,
    patchId: string,
    decision: "confirm" | "reject"
  ): Promise<StoryMemory> {
    const manifest = this.database.getProjectManifest(projectId);
    if (!manifest) throw new Error(`Project not found: ${projectId}`);
    return this.storyMemoryService.reviewPatch(manifest.rootPath, projectId, patchId, decision);
  }

  async rollbackMemory(projectId: string, count: number): Promise<StoryMemory> {
    const manifest = this.database.getProjectManifest(projectId);
    if (!manifest) throw new Error(`Project not found: ${projectId}`);
    const memory = await this.storyMemoryService.loadMemory(manifest.rootPath, projectId);
    const rolledBack = this.storyMemoryService.rollbackPatches(memory, count);
    await this.storyMemoryService.saveMemory(manifest.rootPath, rolledBack);
    return rolledBack;
  }

  async compactMemory(projectId: string): Promise<StoryMemory> {
    const manifest = this.database.getProjectManifest(projectId);
    if (!manifest) throw new Error(`Project not found: ${projectId}`);
    const memory = await this.storyMemoryService.loadMemory(manifest.rootPath, projectId);
    const compacted = this.storyMemoryService.compactMemory(memory);
    await this.storyMemoryService.saveMemory(manifest.rootPath, compacted);
    return compacted;
  }
}

function normalizeModelProfile(profile: ModelProfile): ModelProfile {
  return {
    ...DEFAULT_MODEL_PROFILE,
    ...profile,
    embeddingModel: profile.embeddingModel ?? "",
    temperaturePolicy: {
      ...DEFAULT_MODEL_PROFILE.temperaturePolicy,
      ...profile.temperaturePolicy
    }
  };
}

function normalizeWorkbenchSettings(settings: WorkbenchSettings): WorkbenchSettings {
  return {
    editorPreferences: {
      ...DEFAULT_WORKBENCH_SETTINGS.editorPreferences,
      ...settings.editorPreferences
    },
    startupPreferences: {
      ...DEFAULT_WORKBENCH_SETTINGS.startupPreferences,
      ...settings.startupPreferences
    },
    projectDefaults: {
      ...DEFAULT_WORKBENCH_SETTINGS.projectDefaults,
      ...settings.projectDefaults
    },
    promptTemplates: normalizePromptTemplates(settings.promptTemplates),
    exportPreferences: {
      ...DEFAULT_WORKBENCH_SETTINGS.exportPreferences,
      ...settings.exportPreferences
    }
  };
}

function normalizePromptTemplates(
  templates: WorkbenchSettings["promptTemplates"] | undefined
): WorkbenchSettings["promptTemplates"] {
  const nextTemplates = deepClone(DEFAULT_WORKBENCH_SETTINGS.promptTemplates);
  for (const action of Object.keys(WORKFLOW_ACTION_LABELS) as Array<keyof WorkbenchSettings["promptTemplates"]>) {
    if (!templates?.[action]) {
      continue;
    }
    nextTemplates[action] = {
      systemTemplate:
        templates[action].systemTemplate?.trim() || DEFAULT_WORKBENCH_SETTINGS.promptTemplates[action].systemTemplate,
      userTemplate:
        templates[action].userTemplate?.trim() || DEFAULT_WORKBENCH_SETTINGS.promptTemplates[action].userTemplate
    };
  }
  return nextTemplates;
}

function deriveReferenceQuery(snapshot: ProjectSnapshot, input: WorkflowExecutionInput): string {
  const latestOutline = snapshot.outlines
    .filter((outline) => outline.level === "chapter" && (input.chapterNumber === undefined || outline.chapterNumber === input.chapterNumber))
    .at(0);
  return [
    input.notes,
    latestOutline?.title,
    latestOutline?.hook,
    snapshot.premiseCard?.mainConflict,
    snapshot.manifest.premise,
    snapshot.manifest.genre
  ]
    .filter((item): item is string => Boolean(item && item.trim()))
    .join(" ");
}
