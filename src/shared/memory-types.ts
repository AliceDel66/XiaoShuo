/**
 * Story Memory System — Phase 2 Type Definitions
 *
 * 长篇记忆系统类型定义。StoryMemory 是独立的一等对象，
 * 拥有四层分层结构、MemoryPatch 变更通道及上下文装配能力。
 */

import type { OutlinePacket, StateChangeEntry, WorkflowAction } from "./types";

// ═══════════════════════════════════════════════
// 通用枚举 / 联合类型
// ═══════════════════════════════════════════════

export type MemoryLayer = "long-term" | "mid-term" | "short-term" | "working";

export type MemoryEntityType =
  | "character"
  | "relationship"
  | "location"
  | "item"
  | "timeline"
  | "plot-thread"
  | "foreshadow"
  | "world-rule"
  | "faction"
  | "chapter-summary";

export type PatchSource =
  | "chapter-confirmed"
  | "state-update"
  | "audit-repair"
  | "manual-edit"
  | "bible-sync";

export type PatchStatus = "draft" | "pending" | "confirmed" | "applied" | "rejected";

export type PatchOperationType = "set" | "merge" | "append" | "remove" | "increment";

// ═══════════════════════════════════════════════
// 核心记忆对象
// ═══════════════════════════════════════════════

/** 项目的完整记忆状态（一等公民） */
export interface StoryMemory {
  projectId: string;
  version: number;
  lastUpdatedAt: string;

  longTerm: LongTermMemory;
  midTerm: MidTermMemory;
  shortTerm: ShortTermMemory;
  working: WorkingMemory;

  patchHistory: AppliedPatch[];
  patchHistoryTrimmedBefore?: string;
}

// ── Long-Term Layer ─────────────────────────

export interface LongTermMemory {
  worldRules: WorldRule[];
  characters: CharacterState[];
  factions: FactionState[];
  coreItems: ItemState[];
  volumeArchives: VolumeSummary[];
}

export interface WorldRule {
  id: string;
  layer: string;
  content: string;
  constraints: string[];
  addedAt: string;
  lastVerifiedAt: string;
}

export interface CharacterState {
  id: string;
  name: string;
  role: string;
  baseProfile: {
    goal: string;
    conflict: string;
    arc: string;
    secrets: string[];
  };
  currentStatus: string;
  currentAbilities: string[];
  currentKnowledge: string[];
  currentLocation: string;
  alive: boolean;
  lastUpdatedChapter: string;
}

export interface FactionState {
  id: string;
  name: string;
  agenda: string;
  resources: string[];
  stance: string;
  lastUpdatedChapter: string;
}

export interface ItemState {
  id: string;
  name: string;
  purpose: string;
  currentOwner: string;
  currentStatus: string;
  locationHistory: Array<{
    owner: string;
    chapter: string;
    note: string;
  }>;
}

export interface VolumeSummary {
  volumeNumber: number;
  title: string;
  summary: string;
  keyEvents: string[];
  stateAtEnd: string;
  completedAt: string;
}

// ── Mid-Term Layer ──────────────────────────

export interface MidTermMemory {
  currentVolume: number;
  plotThreads: PlotThread[];
  relationships: RelationshipState[];
  foreshadows: ForeshadowState[];
  locationStates: LocationState[];
  chapterSummaries: ChapterMemorySummary[];
  volumeGoalProgress: VolumeGoalProgress;
}

export interface PlotThread {
  id: string;
  type: "mainline" | "subplot";
  title: string;
  description: string;
  status: "active" | "paused" | "resolved" | "abandoned";
  startedChapter: string;
  lastProgressChapter: string;
  milestones: Array<{
    description: string;
    chapter: string;
    completed: boolean;
  }>;
  tension: number;
}

export interface RelationshipState {
  id: string;
  characterA: string;
  characterB: string;
  currentLabel: string;
  trust: number;
  history: Array<{
    chapter: string;
    from: string;
    to: string;
    reason: string;
  }>;
  lastUpdatedChapter: string;
}

export interface ForeshadowState {
  id: string;
  clue: string;
  plantedChapter: string;
  targetPayoffChapter?: string;
  actualPayoffChapter?: string;
  status: "planted" | "hinted" | "partial-reveal" | "paid-off" | "delayed" | "abandoned";
  relatedCharacters: string[];
  relatedPlotThreads: string[];
  progressNotes: Array<{
    chapter: string;
    note: string;
  }>;
}

export interface LocationState {
  id: string;
  name: string;
  description: string;
  currentCondition: string;
  occupants: string[];
  significance: string;
  lastEventChapter: string;
}

export interface VolumeGoalProgress {
  volumeNumber: number;
  volumeGoal: string;
  completedMilestones: string[];
  remainingMilestones: string[];
  estimatedCompletion: number;
}

/** 章节记忆摘要 — 用于 mid-term 层的已压缩章摘要 */
export interface ChapterMemorySummary {
  chapterId: string;
  chapterNumber: number;
  chapterTitle: string;
  narrativeSummary: string;
  keyStateChanges: string[];
  createdAt: string;
}

// ── Short-Term Layer ────────────────────────

export interface ShortTermMemory {
  recentChapters: ChapterMemorySnapshot[];
  pendingHooks: string[];
  activeSceneThreads: string[];
}

export interface ChapterMemorySnapshot {
  chapterId: string;
  chapterNumber: number;
  chapterTitle: string;
  narrativeSummary: string;
  stateChanges: StateChangeEntry[];
  keyDialogues: Array<{
    speaker: string;
    line: string;
    significance: string;
  }>;
  endHook: string;
  openQuestions: string[];
  foreshadowActivity: string[];
  involvedCharacters: string[];
  involvedLocations: string[];
  createdAt: string;
}

// ── Working Layer ───────────────────────────

export interface WorkingMemory {
  activeChapterId: string | null;
  activeSceneIndex: number | null;
  currentOutline: OutlinePacket | null;
  userNotes: string;
  previousSceneTail: string;
  tempStateOverrides: Record<string, unknown>;
}

// ═══════════════════════════════════════════════
// Patch 系统
// ═══════════════════════════════════════════════

export interface PatchOperation {
  op: PatchOperationType;
  layer: MemoryLayer;
  entityType: MemoryEntityType;
  entityId: string;
  field: string;
  before: unknown;
  after: unknown;
  reason: string;
}

export interface MemoryPatch {
  patchId: string;
  source: PatchSource;
  sourceRef: string;
  createdAt: string;
  status: PatchStatus;
  operations: PatchOperation[];
  summary: string;
  conflicts: PatchConflict[];
}

export interface PatchConflict {
  operationIndex: number;
  type: "stale-before" | "entity-not-found" | "duplicate-update" | "cross-layer-violation";
  message: string;
  suggestion: "auto-resolve" | "require-human";
}

export interface PatchWarning {
  operationIndex: number;
  message: string;
}

export interface PatchValidationResult {
  valid: boolean;
  conflicts: PatchConflict[];
  warnings: PatchWarning[];
}

export interface AppliedPatch {
  patch: MemoryPatch;
  appliedAt: string;
  memoryVersionBefore: number;
  memoryVersionAfter: number;
}

export interface PatchHistoryFilter {
  source?: PatchSource;
  entityType?: MemoryEntityType;
  entityId?: string;
  layer?: MemoryLayer;
  limit?: number;
}

// ═══════════════════════════════════════════════
// 上下文装配
// ═══════════════════════════════════════════════

export interface WritingPosition {
  volumeNumber: number;
  chapterNumber?: number;
  sceneIndex?: number;
}

export interface ContextBudget {
  maxTokens: number;
  layerWeights: {
    longTerm: number;
    midTerm: number;
    shortTerm: number;
    working: number;
  };
}

export interface AssembledMemoryContext {
  longTermContext: string;
  midTermContext: string;
  shortTermContext: string;
  workingContext: string;
  fullContext: string;
  estimatedTokens: number;
  truncations: string[];
}

// ═══════════════════════════════════════════════
// 配置
// ═══════════════════════════════════════════════

export interface RetentionPolicy {
  shortTermWindowSize: number;
  midTermSummaryInterval: number;
  patchHistoryInMemory: number;
  volumeArchiveMaxWords: number;
  chapterSummaryMaxWords: number;
}

export interface MemoryAutoApplyPolicy {
  enabled: boolean;
  autoApplyThreshold: number;
  requireHumanForSeverity: PatchConflict["type"][];
}

// ═══════════════════════════════════════════════
// 默认值
// ═══════════════════════════════════════════════

export const DEFAULT_RETENTION_POLICY: RetentionPolicy = {
  shortTermWindowSize: 5,
  midTermSummaryInterval: 5,
  patchHistoryInMemory: 50,
  volumeArchiveMaxWords: 500,
  chapterSummaryMaxWords: 300,
};

export const DEFAULT_MEMORY_AUTO_APPLY_POLICY: MemoryAutoApplyPolicy = {
  enabled: false,
  autoApplyThreshold: 0,
  requireHumanForSeverity: ["stale-before", "cross-layer-violation"],
};

export const DEFAULT_CONTEXT_BUDGETS: Record<string, ContextBudget> = {
  "generate-project-setup": {
    maxTokens: 2000,
    layerWeights: { longTerm: 0, midTerm: 0, shortTerm: 0, working: 1 },
  },
  "generate-story-bible": {
    maxTokens: 2000,
    layerWeights: { longTerm: 0, midTerm: 0, shortTerm: 0, working: 1 },
  },
  "generate-volume-outline": {
    maxTokens: 4000,
    layerWeights: { longTerm: 0.5, midTerm: 0, shortTerm: 0, working: 0.5 },
  },
  "generate-chapter-outline": {
    maxTokens: 6000,
    layerWeights: { longTerm: 0.2, midTerm: 0.3, shortTerm: 0.2, working: 0.3 },
  },
  "write-chapter": {
    maxTokens: 8000,
    layerWeights: { longTerm: 0.2, midTerm: 0.25, shortTerm: 0.35, working: 0.2 },
  },
  "write-scene": {
    maxTokens: 6000,
    layerWeights: { longTerm: 0.15, midTerm: 0.2, shortTerm: 0.35, working: 0.3 },
  },
  "update-chapter-state": {
    maxTokens: 8000,
    layerWeights: { longTerm: 0.1, midTerm: 0.2, shortTerm: 0.2, working: 0.5 },
  },
  "run-audit": {
    maxTokens: 12000,
    layerWeights: { longTerm: 0.25, midTerm: 0.3, shortTerm: 0.3, working: 0.15 },
  },
  "export-project": {
    maxTokens: 0,
    layerWeights: { longTerm: 0, midTerm: 0, shortTerm: 0, working: 0 },
  },
};

/** 创建空白 StoryMemory */
export function createEmptyStoryMemory(projectId: string): StoryMemory {
  return {
    projectId,
    version: 0,
    lastUpdatedAt: new Date().toISOString(),
    longTerm: {
      worldRules: [],
      characters: [],
      factions: [],
      coreItems: [],
      volumeArchives: [],
    },
    midTerm: {
      currentVolume: 1,
      plotThreads: [],
      relationships: [],
      foreshadows: [],
      locationStates: [],
      chapterSummaries: [],
      volumeGoalProgress: {
        volumeNumber: 1,
        volumeGoal: "",
        completedMilestones: [],
        remainingMilestones: [],
        estimatedCompletion: 0,
      },
    },
    shortTerm: {
      recentChapters: [],
      pendingHooks: [],
      activeSceneThreads: [],
    },
    working: {
      activeChapterId: null,
      activeSceneIndex: null,
      currentOutline: null,
      userNotes: "",
      previousSceneTail: "",
      tempStateOverrides: {},
    },
    patchHistory: [],
  };
}
