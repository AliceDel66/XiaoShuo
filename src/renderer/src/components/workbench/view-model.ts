import {
  EXPORT_FORMAT_LABELS,
  WORKFLOW_ACTION_LABELS,
  createProjectInputFromDefaults
} from "@shared/defaults";
import type {
  ArtifactRef,
  CreateProjectInput,
  OutlinePacket,
  PreviewSession,
  ProjectSnapshot,
  StoryBible,
  WorkflowAction,
  WorkbenchSettings
} from "@shared/types";
import type {
  DatabaseCategoryKey,
  DatabaseCategoryOption,
  DatabaseEntityRecord,
  WorkbenchChapterItem
} from "./types";

export { EXPORT_FORMAT_LABELS, WORKFLOW_ACTION_LABELS };

export const WORKBENCH_VIEW_LABELS = {
  dashboard: "连载控制台",
  editor: "沉浸写作",
  outline: "大纲与时间轴",
  database: "资料库",
  settings: "设置",
  drama: "短剧工作台"
} as const;

export function buildProjectFormFromSettings(settings: WorkbenchSettings): CreateProjectInput {
  const fallback = createProjectInputFromDefaults();
  return {
    ...fallback,
    genre: settings.projectDefaults.genre,
    targetWords: settings.projectDefaults.targetWords,
    plannedVolumes: settings.projectDefaults.plannedVolumes,
    endingType: settings.projectDefaults.endingType,
    workflowMode: settings.projectDefaults.workflowMode,
    rootDirectory: settings.projectDefaults.defaultRootDirectory || undefined
  };
}

export function deriveChapterItems(snapshot: ProjectSnapshot | null): WorkbenchChapterItem[] {
  if (!snapshot) {
    return [];
  }

  const outlineMap = new Map<string, OutlinePacket>();
  for (const outline of snapshot.outlines.filter((item) => item.level === "chapter")) {
    outlineMap.set(chapterKey(outline.volumeNumber ?? 1, outline.chapterNumber ?? 1), outline);
  }

  const draftMap = new Map<string, ProjectSnapshot["drafts"][number]>();
  for (const draft of snapshot.drafts) {
    draftMap.set(chapterKey(draft.volumeNumber, draft.chapterNumber), draft);
  }

  const keys = Array.from(new Set([...outlineMap.keys(), ...draftMap.keys()]));
  return keys
    .map((key) => {
      const outline = outlineMap.get(key) ?? null;
      const draft = draftMap.get(key) ?? null;
      const [volumeNumber, chapterNumber] = key.split("-").map(Number);
      return {
        key,
        title: draft?.title ?? outline?.title ?? `第${chapterNumber}章`,
        volumeNumber,
        chapterNumber,
        draftId: draft?.id ?? null,
        draftTitle: draft?.title ?? null,
        outlineId: outline?.id ?? null,
        draftMarkdown: draft?.markdown ?? null,
        outline
      };
    })
    .sort((left, right) =>
      left.volumeNumber === right.volumeNumber
        ? left.chapterNumber - right.chapterNumber
        : left.volumeNumber - right.volumeNumber
    );
}

export function findMatchingChapter(
  snapshot: ProjectSnapshot | null,
  volumeNumber: number,
  chapterNumber: number
): WorkbenchChapterItem | null {
  return deriveChapterItems(snapshot).find(
    (item) => item.volumeNumber === volumeNumber && item.chapterNumber === chapterNumber
  ) ?? null;
}

export function chapterKey(volumeNumber: number, chapterNumber: number): string {
  return `${volumeNumber}-${chapterNumber}`;
}

export function getLatestDraftArtifactRef(snapshot: ProjectSnapshot | null): ArtifactRef | null {
  const latestDraft = snapshot?.drafts.at(-1);
  if (!snapshot || !latestDraft) {
    return null;
  }

  return {
    artifactType: "draft",
    artifactId: latestDraft.id,
    projectId: snapshot.manifest.projectId
  };
}

export function outlineArtifactRef(snapshot: ProjectSnapshot, type: "volume-outline" | "chapter-outline"): ArtifactRef {
  return {
    artifactType: type,
    artifactId: type,
    projectId: snapshot.manifest.projectId
  };
}

export function storyBibleArtifactRef(snapshot: ProjectSnapshot): ArtifactRef {
  return {
    artifactType: "story-bible",
    artifactId: "story-bible",
    projectId: snapshot.manifest.projectId
  };
}

export function premiseArtifactRef(snapshot: ProjectSnapshot): ArtifactRef {
  return {
    artifactType: "premise-card",
    artifactId: "premise-card",
    projectId: snapshot.manifest.projectId
  };
}

export function actionNeedsChapter(action: WorkflowAction): boolean {
  return action === "generate-chapter-outline" || action === "write-scene" || action === "write-chapter";
}

export function actionSupportsNotes(action: WorkflowAction): boolean {
  return action !== "export-project";
}

export function databaseOptions(storyBible: StoryBible | null): DatabaseCategoryOption[] {
  return [
    { key: "all", label: "全部库", count: totalStoryBibleCount(storyBible) },
    { key: "characters", label: "角色", count: storyBible?.characters.length ?? 0 },
    { key: "world", label: "世界观", count: storyBible?.world.length ?? 0 },
    { key: "factions", label: "势力", count: storyBible?.factions.length ?? 0 },
    { key: "items", label: "物品/技能", count: storyBible?.items.length ?? 0 },
    { key: "timeline", label: "时间线", count: storyBible?.timeline.length ?? 0 },
    { key: "foreshadows", label: "伏笔", count: storyBible?.foreshadows.length ?? 0 }
  ];
}

export function databaseRecords(storyBible: StoryBible | null): DatabaseEntityRecord[] {
  if (!storyBible) {
    return [];
  }

  const world = storyBible.world.map<DatabaseEntityRecord>((entry, index) => ({
    id: `world-${index}`,
    category: "world",
    typeLabel: "世界观",
    title: entry.title,
    subtitle: `${entry.rules.length} 条规则`,
    description: entry.summary,
    searchText: [entry.title, entry.summary, ...entry.rules].join(" "),
    payload: entry
  }));

  const characters = storyBible.characters.map<DatabaseEntityRecord>((entry) => ({
    id: entry.id,
    category: "characters",
    typeLabel: "角色",
    title: entry.name,
    subtitle: entry.role,
    description: entry.goal,
    searchText: [entry.name, entry.role, entry.goal, entry.conflict, entry.arc, ...entry.secrets].join(" "),
    payload: entry
  }));

  const factions = storyBible.factions.map<DatabaseEntityRecord>((entry) => ({
    id: entry.id,
    category: "factions",
    typeLabel: "势力",
    title: entry.name,
    subtitle: entry.relationshipToProtagonist,
    description: entry.agenda,
    searchText: [entry.name, entry.agenda, entry.relationshipToProtagonist, ...entry.resources].join(" "),
    payload: entry
  }));

  const items = storyBible.items.map<DatabaseEntityRecord>((entry) => ({
    id: entry.id,
    category: "items",
    typeLabel: "物品",
    title: entry.name,
    subtitle: entry.status,
    description: entry.purpose,
    searchText: [entry.name, entry.purpose, entry.owner, entry.status].join(" "),
    payload: entry
  }));

  const timeline = storyBible.timeline.map<DatabaseEntityRecord>((entry) => ({
    id: entry.id,
    category: "timeline",
    typeLabel: "时间线",
    title: entry.timeLabel,
    subtitle: entry.chapterRef ?? "未绑定章节",
    description: entry.description,
    searchText: [entry.timeLabel, entry.description, entry.chapterRef ?? "", ...entry.relatedCharacters].join(" "),
    payload: entry
  }));

  const foreshadows = storyBible.foreshadows.map<DatabaseEntityRecord>((entry) => ({
    id: entry.id,
    category: "foreshadows",
    typeLabel: "伏笔",
    title: entry.clue,
    subtitle: entry.status,
    description: entry.payoffPlan,
    searchText: [entry.clue, entry.plantedAt, entry.payoffPlan, entry.status].join(" "),
    payload: entry
  }));

  return [...characters, ...world, ...factions, ...items, ...timeline, ...foreshadows];
}

export function filterDatabaseRecords(
  records: DatabaseEntityRecord[],
  category: DatabaseCategoryKey,
  query: string
): DatabaseEntityRecord[] {
  const normalized = query.trim().toLowerCase();
  return records.filter((record) => {
    if (category !== "all" && record.category !== category) {
      return false;
    }
    if (!normalized) {
      return true;
    }
    return record.searchText.toLowerCase().includes(normalized);
  });
}

export function candidateFromSession(session: PreviewSession | null, candidateId: string | null) {
  if (!session) {
    return null;
  }

  return (
    session.candidates.find((candidate) => candidate.candidateId === candidateId) ??
    session.candidates.at(-1) ??
    null
  );
}

export function volumeOutlineTree(snapshot: ProjectSnapshot | null) {
  if (!snapshot) {
    return [];
  }

  const chapters = snapshot.outlines.filter((item) => item.level === "chapter");
  return snapshot.outlines
    .filter((item) => item.level === "volume")
    .sort((left, right) => (left.volumeNumber ?? 0) - (right.volumeNumber ?? 0))
    .map((volume) => ({
      volume,
      chapters: chapters
        .filter((chapter) => chapter.volumeNumber === volume.volumeNumber)
        .sort((left, right) => (left.chapterNumber ?? 0) - (right.chapterNumber ?? 0))
    }));
}

function totalStoryBibleCount(storyBible: StoryBible | null): number {
  if (!storyBible) {
    return 0;
  }

  return (
    storyBible.characters.length +
    storyBible.world.length +
    storyBible.factions.length +
    storyBible.items.length +
    storyBible.timeline.length +
    storyBible.foreshadows.length
  );
}
