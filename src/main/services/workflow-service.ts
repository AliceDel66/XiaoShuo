import { DEFAULT_PROMPT_TEMPLATES, WORKFLOW_ACTION_LABELS } from "../../shared/defaults";
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

  constructor(
    private readonly repository: ProjectRepository,
    private readonly aiOrchestrator: AiOrchestrator,
    private readonly exportService: ExportService
  ) {}

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
    prepared: PreparedGenerationTarget
  ): GenerationPromptTrace {
    const referenceContext = buildReferenceContext(referenceHints, referenceMatches);
    const projectContextSummary = buildProjectContextSummary(snapshot, prepared);
    const template = this.promptTemplates[input.action] ?? DEFAULT_PROMPT_TEMPLATES[input.action];
    const payload = buildPromptPayload(snapshot, input, referenceContext, projectContextSummary, prepared);
    const context: Record<string, string> = {
      actionLabel: WORKFLOW_ACTION_LABELS[input.action],
      projectTitle: snapshot.manifest.title,
      projectGenre: snapshot.manifest.genre,
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
      storyBibleJson: JSON.stringify(snapshot.storyBible),
      chapterOutlineJson: JSON.stringify(prepared.targetOutline ?? null),
      draftJson: JSON.stringify(prepared.targetDraft ?? null),
      existingChapterOutlinesJson: JSON.stringify(snapshot.outlines.filter((item) => item.level === "chapter")),
      latestOutlinesJson: JSON.stringify(snapshot.outlines.slice(-12)),
      latestDraftsJson: JSON.stringify(
        snapshot.drafts.slice(-6).map((draft) => ({ ...draft, markdown: excerpt(draft.markdown, 1800) }))
      ),
      latestStatesJson: JSON.stringify(snapshot.chapterStates.slice(-6))
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
          fallback: () => mockChapterOutlines(snapshot, input.volumeNumber ?? 1, referenceHints)
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
    referenceHints: ReferenceCorpusManifest[]
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

    const generated = await this.generateCandidate(snapshot, input, referenceHints, [], prepared, 1);
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
  const sections = [
    `动作: ${WORKFLOW_ACTION_LABELS[input.action]}`,
    `项目: ${JSON.stringify(snapshot.manifest)}`,
    `项目摘要: ${projectContextSummary.join(" | ")}`,
    `参考上下文: ${referenceContext.join(" | ")}`
  ];

  switch (input.action) {
    case "generate-project-setup":
      sections.push(
        'JSON schema: {"coreSellingPoints": string[], "targetWords": number, "volumePlan": string[], "protagonistGrowthCurve": string[], "mainConflict": string, "endingType": string}'
      );
      break;
    case "generate-story-bible":
      sections.push(
        'JSON schema: {"world": [{"title": string, "summary": string, "rules": string[]}], "characters": [{"id": string, "name": string, "role": string, "goal": string, "conflict": string, "arc": string, "secrets": string[], "currentStatus": string}], "factions": [{"id": string, "name": string, "agenda": string, "resources": string[], "relationshipToProtagonist": string}], "items": [{"id": string, "name": string, "purpose": string, "owner": string, "status": string}], "timeline": [{"id": string, "timeLabel": string, "description": string, "relatedCharacters": string[], "chapterRef": string}], "foreshadows": [{"id": string, "clue": string, "plantedAt": string, "payoffPlan": string, "status": "open" | "paid-off" | "delayed"}]}',
        `立项卡: ${JSON.stringify(snapshot.premiseCard)}`
      );
      break;
    case "generate-volume-outline":
      sections.push(
        'JSON schema: [{"id": string, "level": "volume", "title": string, "summary": string, "goal": string, "conflict": string, "hook": string, "sceneCount": number, "dependencies": string[], "references": [{"type": "project" | "corpus", "id": string, "title": string, "note": string}], "children": string[], "volumeNumber": number}]',
        `立项卡: ${JSON.stringify(snapshot.premiseCard)}`,
        `资料库: ${JSON.stringify(snapshot.storyBible)}`
      );
      break;
    case "generate-chapter-outline":
      sections.push(
        'JSON schema: [{"id": string, "level": "chapter", "title": string, "summary": string, "goal": string, "conflict": string, "hook": string, "sceneCount": number, "dependencies": string[], "references": [{"type": "project" | "corpus", "id": string, "title": string, "note": string}], "children": string[], "chapterNumber": number, "volumeNumber": number}]',
        `目标卷号: ${input.volumeNumber ?? 1}`,
        `既有章纲: ${JSON.stringify(snapshot.outlines.filter((item) => item.level === "chapter"))}`,
        `资料库: ${JSON.stringify(snapshot.storyBible)}`,
        `立项卡: ${JSON.stringify(snapshot.premiseCard)}`
      );
      break;
    case "write-scene":
    case "write-chapter":
      sections.push(
        'JSON schema: {"id": string, "title": string, "chapterNumber": number, "volumeNumber": number, "scope": "scene" | "chapter", "markdown": string}',
        `目标章纲: ${JSON.stringify(prepared.targetOutline ?? null)}`,
        `资料库: ${JSON.stringify(snapshot.storyBible)}`,
        `立项卡: ${JSON.stringify(snapshot.premiseCard)}`,
        `写作范围: ${input.scope ?? "chapter"}`,
        `附加说明: ${input.notes ?? ""}`
      );
      break;
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
