import { mkdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { nanoid } from "nanoid";
import type {
  ArtifactEditorDocument,
  ArtifactRef,
  AuditReport,
  ChapterDraft,
  ChapterStateDelta,
  CreateProjectInput,
  OutlinePacket,
  PremiseCard,
  ProjectManifest,
  ProjectSnapshot,
  StoryBible
} from "../../shared/types";
import {
  deepClone,
  ensureDir,
  nowIso,
  parseYamlText,
  readText,
  readYaml,
  sanitizeFileName,
  slugifyId,
  stringifyYaml,
  summarizeList,
  writeText,
  writeYaml
} from "./helpers";

interface ProjectPaths {
  root: string;
  initiativeDir: string;
  bibleDir: string;
  outlineDir: string;
  draftDir: string;
  stateDir: string;
  auditDir: string;
  exportDir: string;
  referenceDir: string;
}

interface DraftEditorMetadata {
  title: string;
  chapterNumber: number;
  volumeNumber: number;
  scope: "scene" | "chapter";
}

export class ProjectRepository {
  constructor(private readonly defaultProjectsDir: string) {}

  private getPaths(root: string): ProjectPaths {
    return {
      root,
      initiativeDir: join(root, "00-立项"),
      bibleDir: join(root, "01-资料库"),
      outlineDir: join(root, "02-大纲"),
      draftDir: join(root, "03-正文"),
      stateDir: join(root, "04-状态"),
      auditDir: join(root, "05-审计"),
      exportDir: join(root, "06-导出"),
      referenceDir: join(root, "07-参考")
    };
  }

  private projectFile(root: string): string {
    return join(root, "project.yaml");
  }

  async createProject(input: CreateProjectInput): Promise<ProjectManifest> {
    const createdAt = nowIso();
    const projectId = slugifyId(`${input.title}-${nanoid(6)}`);
    const projectRootBase = input.rootDirectory ?? this.defaultProjectsDir;
    const folderName = sanitizeFileName(`${input.title}-${projectId.slice(-6)}`);
    const rootPath = join(projectRootBase, folderName);
    const paths = this.getPaths(rootPath);

    await mkdir(rootPath, { recursive: true });
    await Promise.all(Object.values(paths).map((value) => ensureDir(value)));

    const manifest: ProjectManifest = {
      projectId,
      title: input.title,
      premise: input.premise,
      genre: input.genre,
      targetWords: input.targetWords,
      plannedVolumes: input.plannedVolumes,
      endingType: input.endingType,
      workflowMode: input.workflowMode,
      currentStage: "initiative",
      currentChapter: null,
      rootPath,
      createdAt,
      updatedAt: createdAt,
      archivedAt: null
    };

    await this.saveManifest(manifest);
    await this.savePremiseCard(rootPath, null);
    await this.saveStoryBible(rootPath, null);
    await this.saveOutlines(rootPath, []);
    await this.saveDrafts(rootPath, []);
    await this.saveStates(rootPath, []);
    await this.saveAudits(rootPath, []);

    return manifest;
  }

  async saveManifest(manifest: ProjectManifest): Promise<void> {
    await writeYaml(this.projectFile(manifest.rootPath), manifest);
  }

  async savePremiseCard(rootPath: string, premiseCard: PremiseCard | null): Promise<void> {
    const paths = this.getPaths(rootPath);
    const initiativeMarkdown = premiseCard
      ? [
          `# ${basename(rootPath)} 立项`,
          "",
          "## 核心卖点",
          summarizeList(premiseCard.coreSellingPoints),
          "",
          `## 目标字数\n${premiseCard.targetWords}`,
          "",
          "## 卷数规划",
          summarizeList(premiseCard.volumePlan),
          "",
          "## 主角成长曲线",
          summarizeList(premiseCard.protagonistGrowthCurve),
          "",
          `## 主线矛盾\n${premiseCard.mainConflict}`,
          "",
          `## 结局类型\n${premiseCard.endingType}`
        ].join("\n")
      : "# 立项\n\n等待生成立项结果。";

    await Promise.all([
      writeYaml(join(paths.initiativeDir, "premise-card.yaml"), premiseCard ?? {}),
      writeText(join(paths.initiativeDir, "立项.md"), initiativeMarkdown)
    ]);
  }

  async saveStoryBible(rootPath: string, storyBible: StoryBible | null): Promise<void> {
    const paths = this.getPaths(rootPath);
    if (!storyBible) {
      await Promise.all([
        writeText(join(paths.bibleDir, "world.md"), "# 世界观\n\n等待生成。"),
        writeYaml(join(paths.bibleDir, "characters.yaml"), []),
        writeYaml(join(paths.bibleDir, "timeline.yaml"), []),
        writeYaml(join(paths.bibleDir, "factions.yaml"), []),
        writeYaml(join(paths.bibleDir, "items.yaml"), []),
        writeYaml(join(paths.bibleDir, "foreshadows.yaml"), []),
        writeYaml(join(paths.bibleDir, "story-bible.yaml"), {})
      ]);
      return;
    }

    const worldMarkdown = [
      "# 世界观",
      "",
      ...storyBible.world.flatMap((entry) => [
        `## ${entry.title}`,
        "",
        entry.summary,
        "",
        "规则：",
        summarizeList(entry.rules),
        ""
      ])
    ].join("\n");

    await Promise.all([
      writeText(join(paths.bibleDir, "world.md"), worldMarkdown),
      writeYaml(join(paths.bibleDir, "characters.yaml"), storyBible.characters),
      writeYaml(join(paths.bibleDir, "timeline.yaml"), storyBible.timeline),
      writeYaml(join(paths.bibleDir, "factions.yaml"), storyBible.factions),
      writeYaml(join(paths.bibleDir, "items.yaml"), storyBible.items),
      writeYaml(join(paths.bibleDir, "foreshadows.yaml"), storyBible.foreshadows),
      writeYaml(join(paths.bibleDir, "story-bible.yaml"), storyBible)
    ]);
  }

  async saveOutlines(rootPath: string, outlines: OutlinePacket[]): Promise<void> {
    const paths = this.getPaths(rootPath);
    const volumes = outlines.filter((packet) => packet.level === "volume");
    const chapters = outlines.filter((packet) => packet.level !== "volume");
    await Promise.all([
      writeYaml(join(paths.outlineDir, "volumes.yaml"), volumes),
      writeYaml(join(paths.outlineDir, "chapters.yaml"), chapters)
    ]);
  }

  async saveDraft(rootPath: string, draft: ChapterDraft): Promise<string> {
    const paths = this.getPaths(rootPath);
    const indexPath = join(paths.draftDir, "drafts.yaml");
    const currentDrafts = await readYaml<ChapterDraft[]>(indexPath, []);
    const nextDrafts = [...currentDrafts.filter((item) => item.id !== draft.id), draft].sort(
      (left, right) => left.chapterNumber - right.chapterNumber
    );
    const draftPath = join(paths.draftDir, `${draft.id}.md`);
    await Promise.all([writeYaml(indexPath, nextDrafts), writeText(draftPath, draft.markdown)]);
    return draftPath;
  }

  async saveDrafts(rootPath: string, drafts: ChapterDraft[]): Promise<void> {
    const paths = this.getPaths(rootPath);
    await writeYaml(join(paths.draftDir, "drafts.yaml"), drafts);
  }

  async saveChapterState(rootPath: string, state: ChapterStateDelta): Promise<string> {
    const paths = this.getPaths(rootPath);
    const indexPath = join(paths.stateDir, "states.yaml");
    const currentStates = await readYaml<ChapterStateDelta[]>(indexPath, []);
    const nextStates = [...currentStates.filter((item) => item.chapterId !== state.chapterId), state].sort(
      (left, right) => left.chapterId.localeCompare(right.chapterId)
    );
    await writeYaml(indexPath, nextStates);
    const statePath = join(paths.stateDir, `${state.chapterId}.yaml`);
    await writeYaml(statePath, state);
    return statePath;
  }

  async saveStates(rootPath: string, states: ChapterStateDelta[]): Promise<void> {
    const paths = this.getPaths(rootPath);
    await writeYaml(join(paths.stateDir, "states.yaml"), states);
  }

  async saveAuditReport(rootPath: string, report: AuditReport): Promise<string> {
    const paths = this.getPaths(rootPath);
    const indexPath = join(paths.auditDir, "reports.yaml");
    const currentReports = await readYaml<AuditReport[]>(indexPath, []);
    const nextReports = [...currentReports.filter((item) => item.id !== report.id), report].sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt)
    );
    const markdown = [
      `# 审计报告 ${report.id}`,
      "",
      "## 连续性",
      summarizeFindings(report.continuityFindings),
      "",
      "## 节奏",
      summarizeFindings(report.pacingFindings),
      "",
      "## 人设",
      summarizeFindings(report.characterFindings),
      "",
      "## 主线推进",
      summarizeFindings(report.mainlineFindings),
      "",
      "## 阻塞问题",
      summarizeList(report.blockingIssues.length > 0 ? report.blockingIssues : ["无"]),
      "",
      "## 修复建议",
      summarizeList(report.suggestedFixes)
    ].join("\n");

    await Promise.all([
      writeYaml(indexPath, nextReports),
      writeYaml(join(paths.auditDir, `${report.id}.yaml`), report),
      writeText(join(paths.auditDir, `${report.id}.md`), markdown)
    ]);
    return join(paths.auditDir, `${report.id}.md`);
  }

  async saveAudits(rootPath: string, reports: AuditReport[]): Promise<void> {
    const paths = this.getPaths(rootPath);
    await writeYaml(join(paths.auditDir, "reports.yaml"), reports);
  }

  async loadProjectSnapshot(rootPath: string): Promise<ProjectSnapshot> {
    const paths = this.getPaths(rootPath);
    const manifest = await readYaml<ProjectManifest>(this.projectFile(rootPath), {} as ProjectManifest);
    const premiseCardRaw = await readYaml<PremiseCard | Record<string, never>>(
      join(paths.initiativeDir, "premise-card.yaml"),
      {}
    );
    const storyBibleRaw = await readYaml<StoryBible | Record<string, never>>(
      join(paths.bibleDir, "story-bible.yaml"),
      {}
    );
    const volumeOutlines = await readYaml<OutlinePacket[]>(join(paths.outlineDir, "volumes.yaml"), []);
    const chapterOutlines = await readYaml<OutlinePacket[]>(join(paths.outlineDir, "chapters.yaml"), []);
    const draftIndex = await readYaml<ChapterDraft[]>(join(paths.draftDir, "drafts.yaml"), []);
    const states = await readYaml<ChapterStateDelta[]>(join(paths.stateDir, "states.yaml"), []);
    const audits = await readYaml<AuditReport[]>(join(paths.auditDir, "reports.yaml"), []);

    const drafts = await Promise.all(
      draftIndex.map(async (draft) => ({
        ...draft,
        markdown: await readText(join(paths.draftDir, `${draft.id}.md`), draft.markdown ?? "")
      }))
    );

    return {
      manifest,
      premiseCard: isPremiseCard(premiseCardRaw) ? premiseCardRaw : null,
      storyBible: isStoryBible(storyBibleRaw) ? storyBibleRaw : null,
      outlines: [...volumeOutlines, ...chapterOutlines],
      drafts,
      chapterStates: states,
      audits,
      unresolvedWarnings: []
    };
  }

  async openArtifactDocument(snapshot: ProjectSnapshot, artifactRef: ArtifactRef): Promise<ArtifactEditorDocument> {
    switch (artifactRef.artifactType) {
      case "premise-card": {
        const premiseCard = snapshot.premiseCard ?? emptyPremiseCard(snapshot.manifest);
        return buildStructuredDocument(artifactRef, "立项卡", premiseCard);
      }
      case "story-bible": {
        const storyBible = snapshot.storyBible ?? emptyStoryBible();
        return buildStructuredDocument(artifactRef, "资料库", storyBible);
      }
      case "volume-outline": {
        const outlines = snapshot.outlines.filter((item) => item.level === "volume");
        return buildStructuredDocument(artifactRef, "卷纲", outlines);
      }
      case "chapter-outline": {
        const outlines = snapshot.outlines.filter((item) => item.level === "chapter");
        return buildStructuredDocument(artifactRef, "章纲", outlines);
      }
      case "draft": {
        const draft = snapshot.drafts.find((item) => item.id === artifactRef.artifactId);
        if (!draft) {
          throw new Error(`Draft not found: ${artifactRef.artifactId}`);
        }
        const metadata: DraftEditorMetadata = {
          title: draft.title,
          chapterNumber: draft.chapterNumber,
          volumeNumber: draft.volumeNumber,
          scope: draft.scope
        };
        return {
          artifactRef,
          mode: "form",
          displayTitle: draft.title,
          format: "markdown",
          rawText: draft.markdown,
          structuredPayload: metadata,
          isDirty: false
        };
      }
      case "chapter-state": {
        const state = snapshot.chapterStates.find((item) => item.chapterId === artifactRef.artifactId);
        if (!state) {
          throw new Error(`Chapter state not found: ${artifactRef.artifactId}`);
        }
        return buildStructuredDocument(artifactRef, state.chapterTitle, state);
      }
      case "audit-report": {
        const report = snapshot.audits.find((item) => item.id === artifactRef.artifactId);
        if (!report) {
          throw new Error(`Audit report not found: ${artifactRef.artifactId}`);
        }
        return buildStructuredDocument(artifactRef, report.id, report);
      }
      default:
        throw new Error(`Unsupported artifact type: ${artifactRef.artifactType}`);
    }
  }

  async saveArtifactDocument(snapshot: ProjectSnapshot, document: ArtifactEditorDocument): Promise<ProjectSnapshot> {
    const manifest: ProjectManifest = {
      ...snapshot.manifest,
      updatedAt: nowIso()
    };

    switch (document.artifactRef.artifactType) {
      case "premise-card": {
        const premiseCard = readStructuredDocument<PremiseCard>(document, snapshot.premiseCard ?? emptyPremiseCard(manifest));
        await this.savePremiseCard(manifest.rootPath, premiseCard);
        manifest.currentStage = "initiative";
        break;
      }
      case "story-bible": {
        const storyBible = readStructuredDocument<StoryBible>(document, snapshot.storyBible ?? emptyStoryBible());
        await this.saveStoryBible(manifest.rootPath, storyBible);
        manifest.currentStage = "bible";
        break;
      }
      case "volume-outline": {
        const volumeOutlines = readStructuredDocument<OutlinePacket[]>(document, snapshot.outlines.filter((item) => item.level === "volume"));
        await this.saveOutlines(manifest.rootPath, [
          ...volumeOutlines,
          ...snapshot.outlines.filter((item) => item.level !== "volume")
        ]);
        manifest.currentStage = "outlining";
        break;
      }
      case "chapter-outline": {
        const chapterOutlines = readStructuredDocument<OutlinePacket[]>(document, snapshot.outlines.filter((item) => item.level === "chapter"));
        await this.saveOutlines(manifest.rootPath, [
          ...snapshot.outlines.filter((item) => item.level === "volume"),
          ...chapterOutlines
        ]);
        manifest.currentStage = "outlining";
        break;
      }
      case "draft": {
        const existingDraft = snapshot.drafts.find((item) => item.id === document.artifactRef.artifactId);
        const metadata = (document.structuredPayload as DraftEditorMetadata | undefined) ?? {
          title: existingDraft?.title ?? "",
          chapterNumber: existingDraft?.chapterNumber ?? 1,
          volumeNumber: existingDraft?.volumeNumber ?? 1,
          scope: existingDraft?.scope ?? "chapter"
        };
        await this.saveDraft(manifest.rootPath, {
          ...(existingDraft ?? {
            id: document.artifactRef.artifactId,
            createdAt: nowIso()
          }),
          title: metadata.title,
          chapterNumber: metadata.chapterNumber,
          volumeNumber: metadata.volumeNumber,
          scope: metadata.scope,
          markdown: document.rawText,
          updatedAt: nowIso()
        });
        manifest.currentStage = "drafting";
        manifest.currentChapter = document.artifactRef.artifactId;
        break;
      }
      case "chapter-state": {
        const state = readStructuredDocument<ChapterStateDelta>(document, emptyChapterState(document.artifactRef.artifactId));
        await this.saveChapterState(manifest.rootPath, state);
        manifest.currentStage = "state-sync";
        manifest.currentChapter = state.chapterId;
        break;
      }
      case "audit-report": {
        const report = readStructuredDocument<AuditReport>(document, emptyAuditReport(manifest.projectId));
        await this.saveAuditReport(manifest.rootPath, report);
        manifest.currentStage = "audit";
        break;
      }
      default:
        throw new Error(`Unsupported artifact type: ${document.artifactRef.artifactType}`);
    }

    await this.saveManifest(manifest);
    return this.loadProjectSnapshot(manifest.rootPath);
  }

  getExportDirectory(rootPath: string): string {
    return this.getPaths(rootPath).exportDir;
  }

  getReferenceDirectory(rootPath: string): string {
    return this.getPaths(rootPath).referenceDir;
  }
}

function summarizeFindings(
  findings: Array<{
    severity: "info" | "warning" | "blocking";
    title: string;
    detail: string;
  }>
): string {
  if (findings.length === 0) {
    return "- 无";
  }

  return findings.map((finding) => `- [${finding.severity}] ${finding.title}: ${finding.detail}`).join("\n");
}

function isPremiseCard(value: unknown): value is PremiseCard {
  return Boolean(value && typeof value === "object" && Array.isArray((value as PremiseCard).coreSellingPoints));
}

function isStoryBible(value: unknown): value is StoryBible {
  return Boolean(value && typeof value === "object" && Array.isArray((value as StoryBible).characters));
}

function buildStructuredDocument(
  artifactRef: ArtifactRef,
  displayTitle: string,
  structuredPayload: unknown
): ArtifactEditorDocument {
  return {
    artifactRef,
    mode: "form",
    displayTitle,
    format: "yaml",
    rawText: stringifyYaml(structuredPayload),
    structuredPayload: deepClone(structuredPayload),
    isDirty: false
  };
}

function readStructuredDocument<T>(document: ArtifactEditorDocument, fallback: T): T {
  if (document.mode === "form" && document.structuredPayload) {
    return deepClone(document.structuredPayload as T);
  }

  if (!document.rawText.trim()) {
    return fallback;
  }

  return parseYamlText<T>(document.rawText);
}

function emptyPremiseCard(manifest: ProjectManifest): PremiseCard {
  return {
    coreSellingPoints: [],
    targetWords: manifest.targetWords,
    volumePlan: [],
    protagonistGrowthCurve: [],
    mainConflict: "",
    endingType: manifest.endingType
  };
}

function emptyStoryBible(): StoryBible {
  return {
    world: [],
    characters: [],
    factions: [],
    items: [],
    timeline: [],
    foreshadows: []
  };
}

function emptyChapterState(chapterId: string): ChapterStateDelta {
  return {
    chapterId,
    chapterTitle: "",
    characterStates: [],
    timelineEvents: [],
    foreshadowChanges: [],
    relationshipChanges: [],
    locationChanges: [],
    openQuestions: [],
    updatedAt: nowIso()
  };
}

function emptyAuditReport(projectId: string): AuditReport {
  return {
    id: `audit-${nanoid(6)}`,
    projectId,
    createdAt: nowIso(),
    continuityFindings: [],
    pacingFindings: [],
    characterFindings: [],
    mainlineFindings: [],
    blockingIssues: [],
    suggestedFixes: []
  };
}
