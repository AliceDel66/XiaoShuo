import { DEFAULT_PROMPT_TEMPLATES, WORKFLOW_ACTION_LABELS } from "../../shared/defaults";
import type { AssembledMemoryContext } from "../../shared/memory-types";
import type { StoryMemoryService } from "./story-memory-service";
import type {
  ArtifactEditorDocument,
  ArtifactFormat,
  ArtifactRef,
  AuditReport,
  ChapterDraft,
  GenerationPromptTrace,
  OutlinePacket,
  PreviewCandidate,
  PromptTemplateMap,
  ProjectSnapshot,
  ReferenceCorpusManifest,
  SearchResult,
  WorkflowAction,
  WorkflowExecutionInput,
  WorkflowResult,
  WorkflowWarning
} from "../../shared/types";
import {
  AiOrchestrator,
  buildAuditPreviewText,
  mockAudit,
  mockChapterOutlines,
  mockChapterState,
  mockDraft,
  mockPremiseCard,
  mockStoryBible,
  mockVolumeOutlines
} from "./ai-orchestrator";
import { ExportService } from "./export-service";
import { excerpt, nowIso, stringifyYaml } from "./helpers";
import { ProjectRepository } from "./project-repository";

interface PreparedGenerationTarget {
  action: WorkflowAction;
  artifactRef: ArtifactRef;
  artifactFormat: ArtifactFormat;
  displayTitle: string;
  warnings: WorkflowWarning[];
  blocked: boolean;
  role: "plannerModel" | "writerModel" | "auditorModel";
  targetOutline?: OutlinePacket;
  targetDraft?: ChapterDraft;
}

export class WorkflowService {
  private promptTemplates: PromptTemplateMap = DEFAULT_PROMPT_TEMPLATES;
  private storyMemoryService: StoryMemoryService | null = null;

  constructor(
    private readonly repository: ProjectRepository,
    private readonly aiOrchestrator: AiOrchestrator,
    private readonly exportService: ExportService
  ) {}

  setStoryMemoryService(service: StoryMemoryService): void {
    this.storyMemoryService = service;
  }

  getStoryMemoryService(): StoryMemoryService | null {
    return this.storyMemoryService;
  }

  setPromptTemplates(templates: PromptTemplateMap): void {
    this.promptTemplates = templates;
  }

  getPromptTemplates(): PromptTemplateMap {
    return this.promptTemplates;
  }

  prepareGenerationTarget(
    snapshot: ProjectSnapshot,
    input: WorkflowExecutionInput
  ): PreparedGenerationTarget {
    const warnings = evaluatePrerequisites(snapshot, input.action);
    const artifactRef = createArtifactRef(snapshot, input);
    const blocked = snapshot.manifest.workflowMode === "strict" && warnings.some((item) => item.level === "blocking");
    const targetOutline = findChapterOutline(snapshot, input);
    const targetDraft = findDraft(snapshot, input);

    return {
      action: input.action,
      artifactRef,
      artifactFormat: artifactFormatForAction(input.action),
      displayTitle: artifactDisplayTitle(snapshot, input, artifactRef),
      warnings,
      blocked,
      role: modelRoleForAction(input.action),
      targetOutline,
      targetDraft
    };
  }

  buildPromptTrace(
    snapshot: ProjectSnapshot,
    input: WorkflowExecutionInput,
    referenceHints: ReferenceCorpusManifest[],
    referenceMatches: SearchResult[],
    prepared: PreparedGenerationTarget,
    memoryContext?: AssembledMemoryContext | null
  ): GenerationPromptTrace {
    const referenceContext = buildReferenceContext(referenceHints, referenceMatches);
    const projectContextSummary = buildProjectContextSummary(snapshot, prepared);
    const template = this.promptTemplates[input.action] ?? DEFAULT_PROMPT_TEMPLATES[input.action];
    const payload = buildPromptPayload(snapshot, input, referenceContext, projectContextSummary, prepared);
    const context: Record<string, string> = {
      actionLabel: WORKFLOW_ACTION_LABELS[input.action],
      projectTitle: snapshot.manifest.title,
      projectPremise: snapshot.manifest.premise,
      projectGenre: snapshot.manifest.genre,
      protagonistName: snapshot.storyBible?.characters.find((c) => c.role === "主角")?.name ?? "",
      workflowMode: snapshot.manifest.workflowMode,
      targetVolume: String(input.volumeNumber ?? 1),
      targetChapter: input.chapterNumber ? String(input.chapterNumber) : "",
      scope: input.scope ?? "chapter",
      notes: input.notes ?? "",
      payload,
      referenceContext: referenceContext.join(" | "),
      projectContextSummary: projectContextSummary.join(" | "),
      manifestJson: JSON.stringify(snapshot.manifest),
      premiseCardJson: JSON.stringify(snapshot.premiseCard),
      // When memory context is available, use it instead of raw JSON dumps
      storyBibleJson: memoryContext ? "" : JSON.stringify(snapshot.storyBible),
      chapterOutlineJson: JSON.stringify(prepared.targetOutline ?? null),
      draftJson: JSON.stringify(prepared.targetDraft ?? null),
      existingChapterOutlinesJson: JSON.stringify(snapshot.outlines.filter((item) => item.level === "chapter")),
      latestOutlinesJson: JSON.stringify(snapshot.outlines.slice(-12)),
      latestDraftsJson: memoryContext ? "" : JSON.stringify(
        snapshot.drafts.slice(-6).map((draft) => ({ ...draft, markdown: excerpt(draft.markdown, 1800) }))
      ),
      latestStatesJson: memoryContext ? "" : JSON.stringify(snapshot.chapterStates.slice(-6)),
      // New memory context variables
      memoryLongTerm: memoryContext?.longTermContext ?? "",
      memoryMidTerm: memoryContext?.midTermContext ?? "",
      memoryShortTerm: memoryContext?.shortTermContext ?? "",
      memoryWorking: memoryContext?.workingContext ?? "",
      memoryFull: memoryContext?.fullContext ?? "",
    };

    return {
      systemPrompt: renderPromptTemplate(template.systemTemplate, context),
      userPrompt: renderPromptTemplate(template.userTemplate, context),
      referenceContext,
      projectContextSummary
    };
  }

  async generateCandidate(
    snapshot: ProjectSnapshot,
    input: WorkflowExecutionInput,
    referenceHints: ReferenceCorpusManifest[],
    referenceMatches: SearchResult[],
    prepared: PreparedGenerationTarget,
    versionNumber: number
  ): Promise<{
    candidate: PreviewCandidate;
    promptTrace: GenerationPromptTrace;
    source: "model" | "fallback";
  }> {
    const promptTrace = this.buildPromptTrace(snapshot, input, referenceHints, referenceMatches, prepared);

    switch (input.action) {
      case "generate-project-setup": {
        const result = await this.aiOrchestrator.executeJson({
          role: "plannerModel",
          promptTrace,
          fallback: () => mockPremiseCard(snapshot.manifest)
        });
        return {
          candidate: {
            candidateId: `${prepared.artifactRef.artifactId}-candidate-${versionNumber}`,
            sessionId: "",
            versionNumber,
            artifactType: prepared.artifactRef.artifactType,
            displayTitle: `${prepared.displayTitle} 候选 ${versionNumber}`,
            format: "yaml",
            renderedContent: stringifyYaml(result.data),
            structuredPayload: result.data,
            source: result.source,
            createdAt: nowIso()
          },
          promptTrace,
          source: result.source
        };
      }
      case "generate-story-bible": {
        const result = await this.aiOrchestrator.executeJson({
          role: "plannerModel",
          promptTrace,
          fallback: () => mockStoryBible(snapshot)
        });
        return {
          candidate: {
            candidateId: `${prepared.artifactRef.artifactId}-candidate-${versionNumber}`,
            sessionId: "",
            versionNumber,
            artifactType: prepared.artifactRef.artifactType,
            displayTitle: `${prepared.displayTitle} 候选 ${versionNumber}`,
            format: "yaml",
            renderedContent: stringifyYaml(result.data),
            structuredPayload: result.data,
            source: result.source,
            createdAt: nowIso()
          },
          promptTrace,
          source: result.source
        };
      }
      case "generate-volume-outline": {
        const result = await this.aiOrchestrator.executeJson({
          role: "plannerModel",
          promptTrace,
          fallback: () => mockVolumeOutlines(snapshot)
        });
        return {
          candidate: {
            candidateId: `${prepared.artifactRef.artifactId}-candidate-${versionNumber}`,
            sessionId: "",
            versionNumber,
            artifactType: prepared.artifactRef.artifactType,
            displayTitle: `${prepared.displayTitle} 候选 ${versionNumber}`,
            format: "yaml",
            renderedContent: stringifyYaml(result.data),
            structuredPayload: result.data,
            source: result.source,
            createdAt: nowIso()
          },
          promptTrace,
          source: result.source
        };
      }
      case "generate-chapter-outline": {
        const result = await this.aiOrchestrator.executeJson({
          role: "plannerModel",
          promptTrace,
          fallback: () => mockChapterOutlines(snapshot, input.volumeNumber ?? 1, referenceHints, input.chapterCount)
        });
        return {
          candidate: {
            candidateId: `${prepared.artifactRef.artifactId}-candidate-${versionNumber}`,
            sessionId: "",
            versionNumber,
            artifactType: prepared.artifactRef.artifactType,
            displayTitle: `${prepared.displayTitle} 候选 ${versionNumber}`,
            format: "yaml",
            renderedContent: stringifyYaml(result.data),
            structuredPayload: result.data,
            source: result.source,
            createdAt: nowIso()
          },
          promptTrace,
          source: result.source
        };
      }
      case "write-scene":
      case "write-chapter": {
        const result = await this.aiOrchestrator.executeJson({
          role: "writerModel",
          promptTrace,
          fallback: () => {
            const draft = mockDraft(snapshot, input, prepared.targetOutline, referenceHints);
            return {
              ...draft,
              createdAt: nowIso(),
              updatedAt: nowIso()
            };
          }
        });
        const draft = result.data as ChapterDraft;
        return {
          candidate: {
            candidateId: `${prepared.artifactRef.artifactId}-candidate-${versionNumber}`,
            sessionId: "",
            versionNumber,
            artifactType: prepared.artifactRef.artifactType,
            displayTitle: `${draft.title} 候选 ${versionNumber}`,
            format: "markdown",
            renderedContent: draft.markdown,
            structuredPayload: draft,
            source: result.source,
            createdAt: nowIso()
          },
          promptTrace,
          source: result.source
        };
      }
      case "update-chapter-state": {
        const result = await this.aiOrchestrator.executeJson({
          role: "auditorModel",
          promptTrace,
          fallback: () => mockChapterState(snapshot, prepared.targetDraft ?? latestDraftOrThrow(snapshot))
        });
        return {
          candidate: {
            candidateId: `${prepared.artifactRef.artifactId}-candidate-${versionNumber}`,
            sessionId: "",
            versionNumber,
            artifactType: prepared.artifactRef.artifactType,
            displayTitle: `${prepared.displayTitle} 候选 ${versionNumber}`,
            format: "yaml",
            renderedContent: stringifyYaml(result.data),
            structuredPayload: result.data,
            source: result.source,
            createdAt: nowIso()
          },
          promptTrace,
          source: result.source
        };
      }
      case "run-audit": {
        const result = await this.aiOrchestrator.executeJson({
          role: "auditorModel",
          promptTrace,
          fallback: () => mockAudit(snapshot)
        });
        const report = result.data as AuditReport;
        return {
          candidate: {
            candidateId: `${prepared.artifactRef.artifactId}-candidate-${versionNumber}`,
            sessionId: "",
            versionNumber,
            artifactType: prepared.artifactRef.artifactType,
            displayTitle: `${prepared.displayTitle} 候选 ${versionNumber}`,
            format: "yaml",
            renderedContent: buildAuditPreviewText(report),
            structuredPayload: report,
            source: result.source,
            createdAt: nowIso()
          },
          promptTrace,
          source: result.source
        };
      }
      default:
        throw new Error(`Unsupported generation action: ${input.action}`);
    }
  }

  async applyConfirmedArtifact(
    snapshot: ProjectSnapshot,
    artifactRef: ArtifactRef,
    candidate: PreviewCandidate
  ): Promise<ProjectSnapshot> {
    const document = candidateToDocument(artifactRef, candidate);
    let updatedSnapshot = await this.repository.saveArtifactDocument(snapshot, document);

    if (
      artifactRef.artifactType === "chapter-state" &&
      updatedSnapshot.chapterStates.length > 0 &&
      updatedSnapshot.chapterStates.length % 10 === 0
    ) {
      const prepared = this.prepareGenerationTarget(updatedSnapshot, {
        projectId: updatedSnapshot.manifest.projectId,
        action: "run-audit"
      });
      const auditCandidate = await this.generateCandidate(
        updatedSnapshot,
        { projectId: updatedSnapshot.manifest.projectId, action: "run-audit" },
        [],
        [],
        prepared,
        1
      );
      updatedSnapshot = await this.repository.saveArtifactDocument(
        updatedSnapshot,
        candidateToDocument(prepared.artifactRef, auditCandidate.candidate)
      );
    }

    return updatedSnapshot;
  }

  async runExport(snapshot: ProjectSnapshot, format: "markdown" | "txt" | "epub"): Promise<string> {
    return this.exportService.exportProject(
      snapshot,
      format,
      this.repository.getExportDirectory(snapshot.manifest.rootPath)
    );
  }

  async execute(
    snapshot: ProjectSnapshot,
    input: WorkflowExecutionInput,
    referenceHints: ReferenceCorpusManifest[],
    referenceMatches: SearchResult[] = []
  ): Promise<WorkflowResult> {
    if (input.action === "export-project") {
      const exportPath = await this.runExport(snapshot, inferExportFormat(input.notes));
      return {
        action: input.action,
        warnings: [],
        updatedProject: snapshot,
        createdPaths: [exportPath]
      };
    }

    const prepared = this.prepareGenerationTarget(snapshot, input);
    if (prepared.blocked) {
      return {
        action: input.action,
        warnings: prepared.warnings,
        updatedProject: {
          ...snapshot,
          unresolvedWarnings: evaluateOutstandingWarnings(snapshot)
        },
        createdPaths: []
      };
    }

    const generated = await this.generateCandidate(snapshot, input, referenceHints, referenceMatches, prepared, 1);
    const updatedProject = await this.applyConfirmedArtifact(snapshot, prepared.artifactRef, generated.candidate);
    updatedProject.unresolvedWarnings = evaluateOutstandingWarnings(updatedProject);

    return {
      action: input.action,
      warnings: prepared.warnings,
      updatedProject,
      createdPaths: []
    };
  }
}

export function evaluateOutstandingWarnings(snapshot: ProjectSnapshot): WorkflowWarning[] {
  const warnings: WorkflowWarning[] = [];
  if (!snapshot.premiseCard) {
    warnings.push({ level: "warning", message: "立项尚未生成。" });
  }
  if (!snapshot.storyBible) {
    warnings.push({ level: "warning", message: "资料库尚未生成。" });
  }
  if (!snapshot.outlines.some((outline) => outline.level === "volume")) {
    warnings.push({ level: "warning", message: "卷纲尚未生成。" });
  }
  if (!snapshot.outlines.some((outline) => outline.level === "chapter")) {
    warnings.push({ level: "warning", message: "章纲尚未生成。" });
  }

  for (const draft of snapshot.drafts) {
    if (!snapshot.chapterStates.find((state) => state.chapterId === draft.id)) {
      warnings.push({ level: "blocking", message: `${draft.title} 缺少状态更新。` });
    }
  }

  if (snapshot.drafts.length >= 10 && snapshot.audits.length === 0) {
    warnings.push({ level: "warning", message: "已经写到 10 章以上，建议运行一次总审。" });
  }

  return warnings;
}

function evaluatePrerequisites(snapshot: ProjectSnapshot, action: WorkflowAction): WorkflowWarning[] {
  switch (action) {
    case "generate-project-setup":
      return [];
    case "generate-story-bible":
      return snapshot.premiseCard ? [] : [{ level: "blocking", message: "必须先完成立项，再生成资料库。" }];
    case "generate-volume-outline":
      return snapshot.storyBible ? [] : [{ level: "blocking", message: "必须先生成资料库，再生成卷纲。" }];
    case "generate-chapter-outline":
      return snapshot.outlines.some((outline) => outline.level === "volume")
        ? []
        : [{ level: "blocking", message: "必须先生成卷纲，再生成章纲。" }];
    case "write-scene":
    case "write-chapter":
      return snapshot.outlines.some((outline) => outline.level === "chapter")
        ? []
        : [{ level: "blocking", message: "必须先生成章纲，再开始写作。" }];
    case "update-chapter-state":
      return snapshot.drafts.length > 0 ? [] : [{ level: "blocking", message: "必须先写出草稿，才能更新章节状态。" }];
    case "run-audit":
      return snapshot.drafts.length > 0 ? [] : [{ level: "blocking", message: "至少需要一章草稿后才能开始总审。" }];
    case "export-project":
      return snapshot.drafts.length > 0 ? [] : [{ level: "blocking", message: "至少需要一章正文，才能导出项目。" }];
    default:
      return [];
  }
}

function createArtifactRef(snapshot: ProjectSnapshot, input: WorkflowExecutionInput): ArtifactRef {
  switch (input.action) {
    case "generate-project-setup":
      return { artifactType: "premise-card", artifactId: "premise-card", projectId: snapshot.manifest.projectId };
    case "generate-story-bible":
      return { artifactType: "story-bible", artifactId: "story-bible", projectId: snapshot.manifest.projectId };
    case "generate-volume-outline":
      return { artifactType: "volume-outline", artifactId: "volumes", projectId: snapshot.manifest.projectId };
    case "generate-chapter-outline":
      return {
        artifactType: "chapter-outline",
        artifactId: `volume-${String(input.volumeNumber ?? 1).padStart(2, "0")}`,
        projectId: snapshot.manifest.projectId
      };
    case "write-scene":
    case "write-chapter":
      return {
        artifactType: "draft",
        artifactId: `chapter-${String(input.chapterNumber ?? snapshot.drafts.length + 1).padStart(3, "0")}`,
        projectId: snapshot.manifest.projectId
      };
    case "update-chapter-state": {
      const targetDraft = findDraft(snapshot, input);
      return {
        artifactType: "chapter-state",
        artifactId: targetDraft?.id ?? `chapter-${String(input.chapterNumber ?? 1).padStart(3, "0")}`,
        projectId: snapshot.manifest.projectId
      };
    }
    case "run-audit":
      return {
        artifactType: "audit-report",
        artifactId: `audit-${snapshot.manifest.projectId}`,
        projectId: snapshot.manifest.projectId
      };
    default:
      return { artifactType: "premise-card", artifactId: "premise-card", projectId: snapshot.manifest.projectId };
  }
}

function artifactDisplayTitle(
  snapshot: ProjectSnapshot,
  input: WorkflowExecutionInput,
  artifactRef: ArtifactRef
): string {
  switch (artifactRef.artifactType) {
    case "premise-card":
      return "立项卡";
    case "story-bible":
      return "资料库";
    case "volume-outline":
      return "卷纲";
    case "chapter-outline":
      return `第 ${input.volumeNumber ?? 1} 卷章纲`;
    case "draft":
      return `第 ${input.chapterNumber ?? snapshot.drafts.length + 1} 章草稿`;
    case "chapter-state":
      return `第 ${input.chapterNumber ?? snapshot.chapterStates.length + 1} 章状态`;
    case "audit-report":
      return "总审报告";
    default:
      return "内容";
  }
}

function artifactFormatForAction(action: WorkflowAction): ArtifactFormat {
  switch (action) {
    case "write-scene":
    case "write-chapter":
      return "markdown";
    default:
      return "yaml";
  }
}

function modelRoleForAction(action: WorkflowAction): "plannerModel" | "writerModel" | "auditorModel" {
  switch (action) {
    case "write-scene":
    case "write-chapter":
      return "writerModel";
    case "update-chapter-state":
    case "run-audit":
      return "auditorModel";
    default:
      return "plannerModel";
  }
}

function buildReferenceContext(referenceHints: ReferenceCorpusManifest[], referenceMatches: SearchResult[]): string[] {
  const summaries = referenceHints.map(
    (corpus) =>
      `${corpus.title}: ${corpus.analysisArtifacts.structureProfile.openingHook} / ${corpus.analysisArtifacts.voiceProfile.narrationBias}`
  );
  const snippets = referenceMatches.map((match) => `${match.title}: ${match.snippet}`);
  return [...summaries, ...snippets].slice(0, 12);
}

function buildProjectContextSummary(snapshot: ProjectSnapshot, prepared: PreparedGenerationTarget): string[] {
  const summary: string[] = [
    `项目：${snapshot.manifest.title}`,
    `阶段：${snapshot.manifest.currentStage}`,
    `卷纲数：${snapshot.outlines.filter((item) => item.level === "volume").length}`,
    `章纲数：${snapshot.outlines.filter((item) => item.level === "chapter").length}`,
    `草稿数：${snapshot.drafts.length}`
  ];

  if (snapshot.premiseCard?.mainConflict) {
    summary.push(`主线：${excerpt(snapshot.premiseCard.mainConflict, 90)}`);
  }
  if (snapshot.storyBible?.characters[0]) {
    summary.push(`主角：${snapshot.storyBible.characters[0].name} / ${snapshot.storyBible.characters[0].goal}`);
  }
  if (prepared.targetOutline) {
    summary.push(`目标章纲：${prepared.targetOutline.title}`);
  }
  if (prepared.targetDraft) {
    summary.push(`目标草稿：${prepared.targetDraft.title}`);
  }

  return summary;
}

function buildPromptPayload(
  snapshot: ProjectSnapshot,
  input: WorkflowExecutionInput,
  referenceContext: string[],
  projectContextSummary: string[],
  prepared: PreparedGenerationTarget
): string {
  const protagonistName = snapshot.storyBible?.characters.find((c) => c.role === "主角")?.name
    ?? snapshot.premiseCard?.mainConflict?.match(/^([\u4e00-\u9fff]{2,4})(?:必须)/)?.[1]
    ?? null;
  const sections = [
    `动作: ${WORKFLOW_ACTION_LABELS[input.action]}`,
    `项目标题: ${snapshot.manifest.title}`,
    `一句话构思: ${snapshot.manifest.premise}`,
    protagonistName ? `主角姓名: ${protagonistName}` : "",
    `项目元信息: ${JSON.stringify({ genre: snapshot.manifest.genre, targetWords: snapshot.manifest.targetWords, plannedVolumes: snapshot.manifest.plannedVolumes, endingType: snapshot.manifest.endingType, workflowMode: snapshot.manifest.workflowMode })}`,
    `项目摘要: ${projectContextSummary.join(" | ")}`,
    referenceContext.length > 0 ? `参考上下文: ${referenceContext.join(" | ")}` : ""
  ].filter(Boolean);

  switch (input.action) {
    case "generate-project-setup":
      sections.push(
        '⚠️ 重要：一句话构思中如果提到了角色名字，在 mainConflict 和 protagonistGrowthCurve 中必须使用该名字，不要用"主角"代替。',
        'JSON schema: {"coreSellingPoints": string[], "targetWords": number, "volumePlan": string[], "protagonistGrowthCurve": string[], "mainConflict": string, "endingType": string}'
      );
      break;
    case "generate-story-bible":
      sections.push(
        '⚠️ 重要：characters 数组中 role="主角" 的角色，其 name 字段必须使用一句话构思中提到的角色名字。所有角色、势力、物品必须与上方立项卡的 mainConflict 和 volumePlan 直接关联，不得脱离故事主线。',
        `立项卡: ${JSON.stringify(snapshot.premiseCard)}`,
        'JSON schema: {"world": [{"title": string, "summary": string, "rules": string[]}], "characters": [{"id": string, "name": string, "role": string, "goal": string, "conflict": string, "arc": string, "secrets": string[], "currentStatus": string}], "factions": [{"id": string, "name": string, "agenda": string, "resources": string[], "relationshipToProtagonist": string}], "items": [{"id": string, "name": string, "purpose": string, "owner": string, "status": string}], "timeline": [{"id": string, "timeLabel": string, "description": string, "relatedCharacters": string[], "chapterRef": string}], "foreshadows": [{"id": string, "clue": string, "plantedAt": string, "payoffPlan": string, "status": "open" | "paid-off" | "delayed"}]}'
      );
      break;
    case "generate-volume-outline": {
      const avgChapterWords = 4000;
      const wordsPerVol = Math.ceil(snapshot.manifest.targetWords / Math.max(1, snapshot.manifest.plannedVolumes));
      const suggestedChaptersPerVol = Math.max(10, Math.ceil(wordsPerVol / avgChapterWords));
      sections.push(
        '⚠️ 重要：每卷的 summary、goal、conflict 必须直接引用资料库中的角色名、势力名和主线矛盾，卷与卷之间必须形成因果递进关系。',
        `⚠️ 重要：每卷必须明确指定 chapterCount（该卷计划的章节数）。本项目总目标字数 ${snapshot.manifest.targetWords} 字、共 ${snapshot.manifest.plannedVolumes} 卷、平均每章约 ${avgChapterWords} 字，建议每卷约 ${suggestedChaptersPerVol} 章。请根据各卷内容密度合理调整，但总量应与目标字数匹配。`,
        `立项卡: ${JSON.stringify(snapshot.premiseCard)}`,
        `资料库: ${JSON.stringify(snapshot.storyBible)}`,
        'JSON schema: [{"id": string, "level": "volume", "title": string, "summary": string, "goal": string, "conflict": string, "hook": string, "sceneCount": number, "chapterCount": number, "dependencies": string[], "references": [{"type": "project" | "corpus", "id": string, "title": string, "note": string}], "children": string[], "volumeNumber": number}]'
      );
      break;
    }
    case "generate-chapter-outline": {
      const targetVolNumber = input.volumeNumber ?? 1;
      const targetVolumeOutline = snapshot.outlines.find((o) => o.level === "volume" && o.volumeNumber === targetVolNumber);
      const volumePlannedChapters = targetVolumeOutline?.chapterCount ?? 0;
      const existingChaptersForVolume = snapshot.outlines.filter((o) => o.level === "chapter" && o.volumeNumber === targetVolNumber);
      const remainingChapters = volumePlannedChapters > 0 ? volumePlannedChapters - existingChaptersForVolume.length : (input.chapterCount ?? 5);
      const effectiveCount = Math.max(1, Math.min(input.chapterCount ?? remainingChapters, remainingChapters > 0 ? remainingChapters : (input.chapterCount ?? 5)));
      sections.push(
        '⚠️ 重要：章纲中的角色名、地点、冲突必须与资料库严格一致。每章的 goal 和 conflict 必须能追溯到卷纲和立项卡的主线矛盾。',
        `目标卷号: ${targetVolNumber}`,
        volumePlannedChapters > 0 ? `该卷计划总章数: ${volumePlannedChapters}` : '',
        `该卷已有章纲数: ${existingChaptersForVolume.length}`,
        `本次需要生成章数: ${effectiveCount}`,
        `立项卡: ${JSON.stringify(snapshot.premiseCard)}`,
        `资料库: ${JSON.stringify(snapshot.storyBible)}`,
        `目标卷纲: ${JSON.stringify(targetVolumeOutline ?? null)}`,
        `该卷既有章纲: ${JSON.stringify(existingChaptersForVolume)}`,
        `请从既有章纲之后继续生成，章节号接续该卷已有的最后一章。严格生成 ${effectiveCount} 章，不要重复已有章节。`,
        'JSON schema: [{"id": string, "level": "chapter", "title": string, "summary": string, "goal": string, "conflict": string, "hook": string, "sceneCount": number, "dependencies": string[], "references": [{"type": "project" | "corpus", "id": string, "title": string, "note": string}], "children": string[], "chapterNumber": number, "volumeNumber": number}]'
      );
      break;
    }
    case "write-scene":
    case "write-chapter": {
      // Build continuity context from previous chapters
      const targetChapterNum = input.chapterNumber ?? snapshot.drafts.length + 1;
      const targetVolNum = input.volumeNumber ?? 1;
      const previousDraft = snapshot.drafts
        .filter((d) => d.volumeNumber === targetVolNum && d.chapterNumber < targetChapterNum)
        .sort((a, b) => b.chapterNumber - a.chapterNumber)[0];
      const previousState = previousDraft
        ? snapshot.chapterStates.find((s) => s.chapterId === previousDraft.id)
        : snapshot.chapterStates.at(-1);
      const previousEnding = previousDraft
        ? excerpt(previousDraft.markdown, 1200).split("\n").slice(-20).join("\n")
        : "";
      const previousOutline = previousDraft
        ? snapshot.outlines.find(
            (o) => o.level === "chapter" && o.volumeNumber === targetVolNum && o.chapterNumber === previousDraft.chapterNumber
          )
        : null;

      sections.push(
        '⚠️ 重要：正文中所有角色必须使用资料库中的准确姓名，不得使用"主角""他/她"等代称开头。角色行为、能力、关系必须与资料库一致。如果章纲中有具体的冲突和钩子描述，必须在正文中体现。',
        '⚠️ 衔接要求：本章开头必须自然承接上一章的结尾场景和情绪，不能出现断裂感。请注意以下衔接细节：',
        '  - 时间连续性：上一章结尾的时间点/场景需要与本章开头吻合',
        '  - 情绪延续：上一章结尾的气氛和情感基调应在本章开头延续并过渡',
        '  - 线索呼应：上一章末尾的悬念/钩子应在本章前半段得到回应或推进',
        '  - 角色状态：角色的位置、心理状态、已知信息必须与上一章结束时一致',
        `目标章纲: ${JSON.stringify(prepared.targetOutline ?? null)}`,
        `资料库: ${JSON.stringify(snapshot.storyBible)}`,
        `立项卡: ${JSON.stringify(snapshot.premiseCard)}`,
        `写作范围: ${input.scope ?? "chapter"}`,
        `附加说明: ${input.notes ?? ""}`
      );

      if (previousDraft && previousEnding) {
        sections.push(
          `上一章标题: ${previousDraft.title}（第${previousDraft.chapterNumber}章）`,
          `上一章结尾内容（最后约1000字）:\n${previousEnding}`
        );
      }
      if (previousOutline) {
        sections.push(`上一章章纲: ${JSON.stringify({ title: previousOutline.title, goal: previousOutline.goal, conflict: previousOutline.conflict, hook: previousOutline.hook })}`);
      }
      if (previousState) {
        sections.push(`上一章状态变化: ${JSON.stringify({
          characterStates: previousState.characterStates,
          openQuestions: previousState.openQuestions,
          timelineEvents: previousState.timelineEvents.slice(-3),
          foreshadowChanges: previousState.foreshadowChanges
        })}`);
      }
      if (snapshot.drafts.length > 1) {
        const recentDraftSummaries = snapshot.drafts
          .filter((d) => d.volumeNumber === targetVolNum && d.chapterNumber < targetChapterNum)
          .sort((a, b) => b.chapterNumber - a.chapterNumber)
          .slice(0, 3)
          .map((d) => ({ title: d.title, chapterNumber: d.chapterNumber, ending: excerpt(d.markdown, 300).split("\n").slice(-5).join("\n") }));
        if (recentDraftSummaries.length > 0) {
          sections.push(`最近章节摘要（用于保持连贯性）: ${JSON.stringify(recentDraftSummaries)}`);
        }
      }

      sections.push(
        'JSON schema: {"id": string, "title": string, "chapterNumber": number, "volumeNumber": number, "scope": "scene" | "chapter", "markdown": string}'
      );
      break;
    }
    case "update-chapter-state":
      sections.push(
        'JSON schema: {"chapterId": string, "chapterTitle": string, "characterStates": [{"target": string, "before": string, "after": string, "reason": string}], "timelineEvents": [{"id": string, "timeLabel": string, "description": string, "relatedCharacters": string[], "chapterRef": string}], "foreshadowChanges": [{"target": string, "before": string, "after": string, "reason": string}], "relationshipChanges": [{"target": string, "before": string, "after": string, "reason": string}], "locationChanges": [{"target": string, "before": string, "after": string, "reason": string}], "openQuestions": string[]}',
        `目标草稿: ${JSON.stringify(prepared.targetDraft ?? latestDraftOrThrow(snapshot))}`,
        `资料库: ${JSON.stringify(snapshot.storyBible)}`,
        `最近状态: ${JSON.stringify(snapshot.chapterStates.slice(-5))}`
      );
      break;
    case "run-audit":
      sections.push(
        'JSON schema: {"id": string, "projectId": string, "createdAt": string, "continuityFindings": [{"severity": "info" | "warning" | "blocking", "title": string, "detail": string, "chapterRef": string}], "pacingFindings": [{"severity": "info" | "warning" | "blocking", "title": string, "detail": string, "chapterRef": string}], "characterFindings": [{"severity": "info" | "warning" | "blocking", "title": string, "detail": string, "chapterRef": string}], "mainlineFindings": [{"severity": "info" | "warning" | "blocking", "title": string, "detail": string, "chapterRef": string}], "blockingIssues": string[], "suggestedFixes": string[]}',
        `最近章纲: ${JSON.stringify(snapshot.outlines.slice(-12))}`,
        `最近草稿: ${JSON.stringify(snapshot.drafts.slice(-6).map((draft) => ({ ...draft, markdown: excerpt(draft.markdown, 1800) })))}`,
        `最近状态: ${JSON.stringify(snapshot.chapterStates.slice(-6))}`
      );
      break;
    default:
      break;
  }

  return sections.join("\n");
}

function renderPromptTemplate(template: string, context: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => context[key] ?? "");
}

function candidateToDocument(artifactRef: ArtifactRef, candidate: PreviewCandidate): ArtifactEditorDocument {
  if (artifactRef.artifactType === "draft") {
    const draft = candidate.structuredPayload as ChapterDraft;
    return {
      artifactRef,
      mode: "form",
      displayTitle: draft.title,
      format: "markdown",
      rawText: candidate.renderedContent,
      structuredPayload: {
        title: draft.title,
        chapterNumber: draft.chapterNumber,
        volumeNumber: draft.volumeNumber,
        scope: draft.scope
      },
      isDirty: false
    };
  }

  return {
    artifactRef,
    mode: "form",
    displayTitle: candidate.displayTitle,
    format: candidate.format,
    rawText: candidate.format === "yaml" ? stringifyYaml(candidate.structuredPayload ?? {}) : candidate.renderedContent,
    structuredPayload: candidate.structuredPayload,
    isDirty: false
  };
}

function findChapterOutline(snapshot: ProjectSnapshot, input: WorkflowExecutionInput): OutlinePacket | undefined {
  if (input.chapterNumber !== undefined) {
    return snapshot.outlines.find(
      (outline) =>
        outline.level === "chapter" &&
        outline.chapterNumber === input.chapterNumber &&
        (input.volumeNumber === undefined || outline.volumeNumber === input.volumeNumber)
    );
  }

  return snapshot.outlines
    .filter((outline) => outline.level === "chapter")
    .sort((left, right) => (right.chapterNumber ?? 0) - (left.chapterNumber ?? 0))[0];
}

function findDraft(snapshot: ProjectSnapshot, input: WorkflowExecutionInput): ChapterDraft | undefined {
  if (input.chapterNumber !== undefined) {
    return snapshot.drafts.find((draft) => draft.chapterNumber === input.chapterNumber);
  }

  return snapshot.drafts.sort((left, right) => right.chapterNumber - left.chapterNumber)[0];
}

function latestDraftOrThrow(snapshot: ProjectSnapshot): ChapterDraft {
  const latestDraft = snapshot.drafts.at(-1);
  if (!latestDraft) {
    throw new Error("No draft available for state update.");
  }
  return latestDraft;
}

function inferExportFormat(notes?: string): "markdown" | "txt" | "epub" {
  const normalized = notes?.trim().toLowerCase();
  if (normalized === "txt" || normalized === "epub" || normalized === "markdown") {
    return normalized;
  }
  return "markdown";
}
