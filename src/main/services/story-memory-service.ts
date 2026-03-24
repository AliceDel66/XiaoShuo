/**
 * StoryMemoryService — 长篇记忆系统核心服务
 *
 * 职责：
 *  - 存储：维护四层记忆的当前快照
 *  - 读取：按 action 类型返回裁剪后的记忆上下文
 *  - 装配：根据 token 预算组装分层上下文
 *  - 合并：接收 MemoryPatch，校验后合并到快照
 *  - 审计：暴露 patch 历史供用户审阅和回滚
 *
 * 不负责：调用 LLM、管理生成流程、持久化文件格式
 *        （持久化委托给 ProjectRepository）
 */

import { nanoid } from "nanoid";
import type {
  AppliedPatch,
  AssembledMemoryContext,
  CharacterState,
  ChapterMemorySnapshot,
  ChapterMemorySummary,
  ContextBudget,
  FactionState,
  ForeshadowState,
  ItemState,
  LocationState,
  MemoryLayer,
  MemoryPatch,
  PatchConflict,
  PatchHistoryFilter,
  PatchOperation,
  PatchValidationResult,
  PatchWarning,
  RelationshipState,
  RetentionPolicy,
  StoryMemory,
  WritingPosition,
  WorldRule,
} from "../../shared/memory-types";
import {
  createEmptyStoryMemory,
  DEFAULT_CONTEXT_BUDGETS,
  DEFAULT_RETENTION_POLICY,
} from "../../shared/memory-types";
import type {
  ChapterStateDelta,
  StoryBible,
  WorkflowAction,
} from "../../shared/types";
import { deepClone, nowIso } from "./helpers";
import { ProjectRepository } from "./project-repository";

// ═══════════════════════════════════════════════
// Token 估算
// ═══════════════════════════════════════════════

/**
 * 粗略估算中文文本的 token 数。
 * 中文约 1 字符 ≈ 1.5 token，英文/数字按空格分词 1 word ≈ 1 token。
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  let count = 0;
  for (const ch of text) {
    if (/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(ch)) {
      count += 1.5;
    } else if (/\s/.test(ch)) {
      // whitespace doesn't add tokens on its own
      count += 0.25;
    } else {
      count += 0.4;
    }
  }
  return Math.ceil(count);
}

/** 将文本裁剪到大约 maxTokens 以内 */
function truncateToTokenBudget(text: string, maxTokens: number): { text: string; truncated: boolean } {
  if (maxTokens <= 0) return { text: "", truncated: text.length > 0 };
  const estimated = estimateTokens(text);
  if (estimated <= maxTokens) return { text, truncated: false };
  // rough char ratio
  const ratio = maxTokens / estimated;
  const targetLen = Math.max(1, Math.floor(text.length * ratio * 0.95));
  return { text: text.slice(0, targetLen) + "…", truncated: true };
}

// ═══════════════════════════════════════════════
// Service
// ═══════════════════════════════════════════════

export class StoryMemoryService {
  constructor(private readonly repository: ProjectRepository) {}

  // ── Load / Save ───────────────────────────

  async loadMemory(rootPath: string, projectId: string): Promise<StoryMemory> {
    return this.repository.loadStoryMemory(rootPath, projectId);
  }

  async saveMemory(rootPath: string, memory: StoryMemory): Promise<void> {
    await this.repository.saveStoryMemory(rootPath, memory);
  }

  // ── Patch Validation ──────────────────────

  validatePatch(patch: MemoryPatch, memory: StoryMemory): PatchValidationResult {
    const conflicts: PatchConflict[] = [];
    const warnings: PatchWarning[] = [];
    const fieldUpdates = new Map<string, number[]>();

    for (let i = 0; i < patch.operations.length; i++) {
      const op = patch.operations[i];

      // Check cross-layer violations
      if (op.layer === "working" && (op.entityType === "world-rule" || op.entityType === "faction")) {
        conflicts.push({
          operationIndex: i,
          type: "cross-layer-violation",
          message: `不应在 working 层修改 ${op.entityType}`,
          suggestion: "auto-resolve",
        });
      }

      // Check entity existence
      const entity = resolveEntity(memory, op);
      if (entity === undefined && op.op !== "set") {
        conflicts.push({
          operationIndex: i,
          type: "entity-not-found",
          message: `实体 ${op.entityType}/${op.entityId} 不存在（将自动升级为 set）`,
          suggestion: "auto-resolve",
        });
      }

      // Check stale-before
      if (entity !== undefined && op.before !== undefined && op.before !== null) {
        const currentValue = getEntityField(entity, op.field);
        if (currentValue !== undefined && JSON.stringify(currentValue) !== JSON.stringify(op.before)) {
          conflicts.push({
            operationIndex: i,
            type: "stale-before",
            message: `${op.entityType}/${op.entityId}.${op.field} 当前值与 before 不匹配`,
            suggestion: "require-human",
          });
        }
      }

      // Check duplicate-update
      const fieldKey = `${op.layer}:${op.entityType}:${op.entityId}:${op.field}`;
      const prev = fieldUpdates.get(fieldKey);
      if (prev) {
        prev.push(i);
        warnings.push({
          operationIndex: i,
          message: `字段 ${fieldKey} 在同一 patch 中被多次修改（操作 ${prev.join(",")}）`,
        });
      } else {
        fieldUpdates.set(fieldKey, [i]);
      }
    }

    // Mark duplicate-update conflicts for entries with 3+ ops
    for (const [key, indices] of fieldUpdates) {
      if (indices.length > 1) {
        conflicts.push({
          operationIndex: indices[indices.length - 1],
          type: "duplicate-update",
          message: `字段 ${key} 被重复修改，将保留最后一次`,
          suggestion: "auto-resolve",
        });
      }
    }

    return {
      valid: conflicts.filter((c) => c.suggestion === "require-human").length === 0,
      conflicts,
      warnings,
    };
  }

  // ── Patch Application ─────────────────────

  applyPatch(patch: MemoryPatch, memory: StoryMemory): StoryMemory {
    const next = deepClone(memory);
    const now = nowIso();

    for (const op of patch.operations) {
      applyOperation(next, op);
    }

    next.version += 1;
    next.lastUpdatedAt = now;

    const appliedPatch: AppliedPatch = {
      patch: { ...deepClone(patch), status: "applied" },
      appliedAt: now,
      memoryVersionBefore: memory.version,
      memoryVersionAfter: next.version,
    };

    next.patchHistory = [...next.patchHistory, appliedPatch];

    // Trim in-memory history
    if (next.patchHistory.length > DEFAULT_RETENTION_POLICY.patchHistoryInMemory) {
      const trimCount = next.patchHistory.length - DEFAULT_RETENTION_POLICY.patchHistoryInMemory;
      const trimmed = next.patchHistory[trimCount - 1];
      next.patchHistoryTrimmedBefore = trimmed.appliedAt;
      next.patchHistory = next.patchHistory.slice(trimCount);
    }

    return next;
  }

  // ── Rollback ──────────────────────────────

  rollbackPatches(memory: StoryMemory, count: number): StoryMemory {
    if (count <= 0 || memory.patchHistory.length === 0) return deepClone(memory);

    const effectiveCount = Math.min(count, memory.patchHistory.length);
    const patchesToRollback = memory.patchHistory.slice(-effectiveCount);
    let current = deepClone(memory);

    // Reverse-apply patches (undo operations)
    for (let pi = patchesToRollback.length - 1; pi >= 0; pi--) {
      const applied = patchesToRollback[pi];
      for (let oi = applied.patch.operations.length - 1; oi >= 0; oi--) {
        const op = applied.patch.operations[oi];
        // Reverse: set the field back to `before`
        const reverseOp: PatchOperation = {
          ...op,
          op: "set",
          after: op.before,
          before: op.after,
          reason: `回滚: ${op.reason}`,
        };
        applyOperation(current, reverseOp);
      }
    }

    current.version += 1;
    current.lastUpdatedAt = nowIso();
    current.patchHistory = current.patchHistory.slice(0, -effectiveCount);

    return current;
  }

  // ── Patch History ─────────────────────────

  getPatchHistory(memory: StoryMemory, filter?: PatchHistoryFilter): AppliedPatch[] {
    let patches = [...memory.patchHistory];

    if (filter?.source) {
      patches = patches.filter((p) => p.patch.source === filter.source);
    }
    if (filter?.entityType) {
      patches = patches.filter((p) => p.patch.operations.some((op) => op.entityType === filter.entityType));
    }
    if (filter?.entityId) {
      patches = patches.filter((p) => p.patch.operations.some((op) => op.entityId === filter.entityId));
    }
    if (filter?.layer) {
      patches = patches.filter((p) => p.patch.operations.some((op) => op.layer === filter.layer));
    }
    if (filter?.limit && filter.limit > 0) {
      patches = patches.slice(-filter.limit);
    }

    return patches;
  }

  // ── Bible-Sync: StoryBible → LongTermMemory ──

  initFromBible(memory: StoryMemory, bible: StoryBible): MemoryPatch {
    const operations: PatchOperation[] = [];
    const now = nowIso();

    // World rules
    for (const world of bible.world) {
      for (let ruleIdx = 0; ruleIdx < world.rules.length; ruleIdx++) {
        const ruleId = `rule-${world.title}-${ruleIdx}`;
        operations.push({
          op: "set",
          layer: "long-term",
          entityType: "world-rule",
          entityId: ruleId,
          field: "*",
          before: null,
          after: {
            id: ruleId,
            layer: world.title,
            content: world.rules[ruleIdx],
            constraints: [],
            addedAt: now,
            lastVerifiedAt: now,
          } satisfies WorldRule,
          reason: `从资料库导入世界规则: ${world.title}`,
        });
      }
    }

    // Characters
    for (const char of bible.characters) {
      operations.push({
        op: "set",
        layer: "long-term",
        entityType: "character",
        entityId: char.id,
        field: "*",
        before: null,
        after: {
          id: char.id,
          name: char.name,
          role: char.role,
          baseProfile: {
            goal: char.goal,
            conflict: char.conflict,
            arc: char.arc,
            secrets: char.secrets,
          },
          currentStatus: char.currentStatus,
          currentAbilities: [],
          currentKnowledge: [],
          currentLocation: "",
          alive: true,
          lastUpdatedChapter: "",
        } satisfies CharacterState,
        reason: `从资料库导入角色: ${char.name}`,
      });
    }

    // Factions
    for (const faction of bible.factions) {
      operations.push({
        op: "set",
        layer: "long-term",
        entityType: "faction",
        entityId: faction.id,
        field: "*",
        before: null,
        after: {
          id: faction.id,
          name: faction.name,
          agenda: faction.agenda,
          resources: faction.resources,
          stance: faction.relationshipToProtagonist,
          lastUpdatedChapter: "",
        } satisfies FactionState,
        reason: `从资料库导入势力: ${faction.name}`,
      });
    }

    // Items
    for (const item of bible.items) {
      operations.push({
        op: "set",
        layer: "long-term",
        entityType: "item",
        entityId: item.id,
        field: "*",
        before: null,
        after: {
          id: item.id,
          name: item.name,
          purpose: item.purpose,
          currentOwner: item.owner,
          currentStatus: item.status,
          locationHistory: [],
        } satisfies ItemState,
        reason: `从资料库导入道具: ${item.name}`,
      });
    }

    // Foreshadows → mid-term
    for (const fs of bible.foreshadows) {
      operations.push({
        op: "set",
        layer: "mid-term",
        entityType: "foreshadow",
        entityId: fs.id,
        field: "*",
        before: null,
        after: {
          id: fs.id,
          clue: fs.clue,
          plantedChapter: fs.plantedAt,
          targetPayoffChapter: fs.payoffPlan,
          status: fs.status === "open" ? "planted" : fs.status === "paid-off" ? "paid-off" : "delayed",
          relatedCharacters: [],
          relatedPlotThreads: [],
          progressNotes: [],
        } satisfies ForeshadowState,
        reason: `从资料库导入伏笔: ${fs.clue.slice(0, 30)}`,
      });
    }

    return {
      patchId: nanoid(12),
      source: "bible-sync",
      sourceRef: "story-bible",
      createdAt: now,
      status: "confirmed",
      operations,
      summary: `从资料库初始导入: ${bible.characters.length} 角色, ${bible.factions.length} 势力, ${bible.items.length} 道具, ${bible.foreshadows.length} 伏笔`,
      conflicts: [],
    };
  }

  // ── ChapterStateDelta → MemoryPatch ───────

  extractPatchFromStateDelta(
    delta: ChapterStateDelta,
    memory: StoryMemory
  ): MemoryPatch {
    const operations: PatchOperation[] = [];

    // Character state changes
    for (const change of delta.characterStates) {
      const existing = memory.longTerm.characters.find((c) => c.name === change.target || c.id === change.target);
      operations.push({
        op: "merge",
        layer: "long-term",
        entityType: "character",
        entityId: existing?.id ?? change.target,
        field: "currentStatus",
        before: existing?.currentStatus ?? null,
        after: change.after,
        reason: change.reason,
      });
    }

    // Relationship changes
    for (const change of delta.relationshipChanges) {
      const relId = `rel-${change.target}`;
      const existing = memory.midTerm.relationships.find(
        (r) => r.id === relId || `${r.characterA}-${r.characterB}` === change.target
      );
      operations.push({
        op: existing ? "merge" : "set",
        layer: "mid-term",
        entityType: "relationship",
        entityId: relId,
        field: "currentLabel",
        before: existing?.currentLabel ?? change.before,
        after: change.after,
        reason: change.reason,
      });
    }

    // Foreshadow changes
    for (const change of delta.foreshadowChanges) {
      const existing = memory.midTerm.foreshadows.find(
        (f) => f.id === change.target || f.clue.includes(change.target)
      );
      operations.push({
        op: "merge",
        layer: "mid-term",
        entityType: "foreshadow",
        entityId: existing?.id ?? change.target,
        field: "status",
        before: existing?.status ?? change.before,
        after: change.after,
        reason: change.reason,
      });
    }

    // Location changes
    for (const change of delta.locationChanges) {
      const existing = memory.midTerm.locationStates.find(
        (l) => l.id === change.target || l.name === change.target
      );
      operations.push({
        op: existing ? "merge" : "set",
        layer: "mid-term",
        entityType: "location",
        entityId: existing?.id ?? change.target,
        field: "currentCondition",
        before: existing?.currentCondition ?? change.before,
        after: change.after,
        reason: change.reason,
      });
    }

    return {
      patchId: nanoid(12),
      source: "state-update",
      sourceRef: delta.chapterId,
      createdAt: nowIso(),
      status: "pending",
      operations,
      summary: `章节状态提取: ${delta.chapterTitle} — ${operations.length} 项变更`,
      conflicts: [],
    };
  }

  // ── Compact Memory ────────────────────────

  compactMemory(memory: StoryMemory, retentionPolicy: RetentionPolicy = DEFAULT_RETENTION_POLICY): StoryMemory {
    const next = deepClone(memory);
    const windowSize = retentionPolicy.shortTermWindowSize;

    // Short-Term → Mid-Term compression
    while (next.shortTerm.recentChapters.length > windowSize) {
      const oldest = next.shortTerm.recentChapters.shift()!;
      // Convert to chapter summary for mid-term
      const summary: ChapterMemorySummary = {
        chapterId: oldest.chapterId,
        chapterNumber: oldest.chapterNumber,
        chapterTitle: oldest.chapterTitle,
        narrativeSummary: oldest.narrativeSummary,
        keyStateChanges: oldest.stateChanges.map(
          (sc) => `${sc.target}: ${sc.before} → ${sc.after}`
        ),
        createdAt: oldest.createdAt,
      };
      next.midTerm.chapterSummaries.push(summary);
    }

    next.lastUpdatedAt = nowIso();
    return next;
  }

  // ── Context Assembly ──────────────────────

  getContextBudget(action: WorkflowAction): ContextBudget {
    return DEFAULT_CONTEXT_BUDGETS[action] ?? DEFAULT_CONTEXT_BUDGETS["write-chapter"];
  }

  assembleContext(
    memory: StoryMemory,
    action: WorkflowAction,
    position: WritingPosition,
    budget: ContextBudget
  ): AssembledMemoryContext {
    const truncations: string[] = [];

    // Calculate token budgets per layer
    const longTermBudget = Math.floor(budget.maxTokens * budget.layerWeights.longTerm);
    const midTermBudget = Math.floor(budget.maxTokens * budget.layerWeights.midTerm);
    const shortTermBudget = Math.floor(budget.maxTokens * budget.layerWeights.shortTerm);
    const workingBudget = Math.floor(budget.maxTokens * budget.layerWeights.working);

    // Assemble each layer
    const longTermRaw = assembleLongTerm(memory, action, position);
    const midTermRaw = assembleMidTerm(memory, action, position);
    const shortTermRaw = assembleShortTerm(memory, action, position);
    const workingRaw = assembleWorking(memory);

    // Truncate to budget
    const lt = truncateToTokenBudget(longTermRaw, longTermBudget);
    const mt = truncateToTokenBudget(midTermRaw, midTermBudget);
    const st = truncateToTokenBudget(shortTermRaw, shortTermBudget);
    const wk = truncateToTokenBudget(workingRaw, workingBudget);

    if (lt.truncated) truncations.push("长期记忆被截断");
    if (mt.truncated) truncations.push("中期记忆被截断");
    if (st.truncated) truncations.push("短期记忆被截断");
    if (wk.truncated) truncations.push("工作记忆被截断");

    const fullContext = [
      lt.text && `[长期设定]\n${lt.text}`,
      mt.text && `[中期推进]\n${mt.text}`,
      st.text && `[近期状态]\n${st.text}`,
      wk.text && `[当前写作]\n${wk.text}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    return {
      longTermContext: lt.text,
      midTermContext: mt.text,
      shortTermContext: st.text,
      workingContext: wk.text,
      fullContext,
      estimatedTokens: estimateTokens(fullContext),
      truncations,
    };
  }

  // ── Pending Patches Management ────────────

  async savePendingPatch(rootPath: string, patch: MemoryPatch): Promise<void> {
    await this.repository.savePendingPatch(rootPath, patch);
    // Also update the index
    const existing = await this.repository.loadPendingPatches(rootPath);
    const updated = [...existing.filter((p) => p.patchId !== patch.patchId), patch];
    await this.repository.savePendingPatchIndex(rootPath, updated);
  }

  async loadPendingPatches(rootPath: string): Promise<MemoryPatch[]> {
    return this.repository.loadPendingPatches(rootPath);
  }

  async reviewPatch(
    rootPath: string,
    projectId: string,
    patchId: string,
    decision: "confirm" | "reject"
  ): Promise<StoryMemory> {
    const pending = await this.loadPendingPatches(rootPath);
    const patch = pending.find((p) => p.patchId === patchId);
    if (!patch) throw new Error(`Pending patch not found: ${patchId}`);

    let memory = await this.loadMemory(rootPath, projectId);

    if (decision === "confirm") {
      patch.status = "confirmed";
      memory = this.applyPatch(patch, memory);
      await this.saveMemory(rootPath, memory);
      await this.repository.saveAppliedPatch(rootPath, {
        patch,
        appliedAt: nowIso(),
        memoryVersionBefore: memory.version - 1,
        memoryVersionAfter: memory.version,
      });
    } else {
      patch.status = "rejected";
    }

    // Remove from pending
    const remaining = pending.filter((p) => p.patchId !== patchId);
    await this.repository.savePendingPatchIndex(rootPath, remaining);

    return memory;
  }
}

// ═══════════════════════════════════════════════
// Internal Helpers
// ═══════════════════════════════════════════════

/** Resolve the entity object that an operation targets */
function resolveEntity(memory: StoryMemory, op: PatchOperation): unknown | undefined {
  switch (op.entityType) {
    case "character":
      return memory.longTerm.characters.find((c) => c.id === op.entityId);
    case "faction":
      return memory.longTerm.factions.find((f) => f.id === op.entityId);
    case "item":
      return memory.longTerm.coreItems.find((i) => i.id === op.entityId);
    case "world-rule":
      return memory.longTerm.worldRules.find((w) => w.id === op.entityId);
    case "relationship":
      return memory.midTerm.relationships.find((r) => r.id === op.entityId);
    case "foreshadow":
      return memory.midTerm.foreshadows.find((f) => f.id === op.entityId);
    case "location":
      return memory.midTerm.locationStates.find((l) => l.id === op.entityId);
    case "plot-thread":
      return memory.midTerm.plotThreads.find((p) => p.id === op.entityId);
    case "chapter-summary":
      return memory.midTerm.chapterSummaries.find((s) => s.chapterId === op.entityId);
    default:
      return undefined;
  }
}

/** Get a field's current value from an entity */
function getEntityField(entity: unknown, field: string): unknown {
  if (field === "*" || !entity || typeof entity !== "object") return undefined;
  return (entity as Record<string, unknown>)[field];
}

/** Apply a single operation to a mutable memory object */
function applyOperation(memory: StoryMemory, op: PatchOperation): void {
  switch (op.entityType) {
    case "character":
      applyToArray(memory.longTerm.characters, op);
      break;
    case "faction":
      applyToArray(memory.longTerm.factions, op);
      break;
    case "item":
      applyToArray(memory.longTerm.coreItems, op);
      break;
    case "world-rule":
      applyToArray(memory.longTerm.worldRules, op);
      break;
    case "relationship":
      applyToArray(memory.midTerm.relationships, op);
      break;
    case "foreshadow":
      applyToArray(memory.midTerm.foreshadows, op);
      break;
    case "location":
      applyToArray(memory.midTerm.locationStates, op);
      break;
    case "plot-thread":
      applyToArray(memory.midTerm.plotThreads, op);
      break;
    case "chapter-summary":
      applyToArray(memory.midTerm.chapterSummaries as Array<{ id?: string; chapterId?: string }>, op);
      break;
    default:
      break;
  }
}

/** Apply a patch operation to a typed array of entities with `id` field */
function applyToArray<T extends { id?: string; chapterId?: string }>(
  arr: T[],
  op: PatchOperation
): void {
  const idField = arr.length > 0 && "chapterId" in (arr[0] ?? {}) ? "chapterId" : "id";
  const existingIndex = arr.findIndex((item) => (item as Record<string, unknown>)[idField] === op.entityId);

  switch (op.op) {
    case "set": {
      if (op.field === "*") {
        // Replace entire entity
        if (existingIndex >= 0) {
          arr[existingIndex] = op.after as T;
        } else {
          arr.push(op.after as T);
        }
      } else {
        if (existingIndex >= 0) {
          (arr[existingIndex] as Record<string, unknown>)[op.field] = op.after;
        } else {
          // Create new entity with just this field
          const newEntity = { id: op.entityId, [op.field]: op.after } as T;
          arr.push(newEntity);
        }
      }
      break;
    }
    case "merge": {
      if (existingIndex >= 0) {
        if (op.field === "*" && typeof op.after === "object" && op.after !== null) {
          Object.assign(arr[existingIndex] as Record<string, unknown>, op.after);
        } else {
          (arr[existingIndex] as Record<string, unknown>)[op.field] = op.after;
        }
      } else {
        // Entity doesn't exist — create it
        if (op.field === "*" && typeof op.after === "object" && op.after !== null) {
          arr.push({ id: op.entityId, ...op.after } as unknown as T);
        } else {
          arr.push({ id: op.entityId, [op.field]: op.after } as T);
        }
      }
      break;
    }
    case "append": {
      if (existingIndex >= 0) {
        const current = (arr[existingIndex] as Record<string, unknown>)[op.field];
        if (Array.isArray(current)) {
          current.push(op.after);
        } else {
          (arr[existingIndex] as Record<string, unknown>)[op.field] = [op.after];
        }
      }
      break;
    }
    case "remove": {
      if (existingIndex >= 0) {
        if (op.field === "*") {
          arr.splice(existingIndex, 1);
        } else {
          delete (arr[existingIndex] as Record<string, unknown>)[op.field];
        }
      }
      break;
    }
    case "increment": {
      if (existingIndex >= 0) {
        const current = (arr[existingIndex] as Record<string, unknown>)[op.field];
        if (typeof current === "number" && typeof op.after === "number") {
          (arr[existingIndex] as Record<string, unknown>)[op.field] = current + op.after;
        }
      }
      break;
    }
  }
}

// ═══════════════════════════════════════════════
// Context Assembly Helpers
// ═══════════════════════════════════════════════

function assembleLongTerm(
  memory: StoryMemory,
  _action: WorkflowAction,
  _position: WritingPosition
): string {
  const sections: string[] = [];

  // World rules
  if (memory.longTerm.worldRules.length > 0) {
    const rules = memory.longTerm.worldRules.map((r) => `- [${r.layer}] ${r.content}`).join("\n");
    sections.push(`## 世界规则\n${rules}`);
  }

  // Characters
  if (memory.longTerm.characters.length > 0) {
    const chars = memory.longTerm.characters.map((c) => {
      const lines = [
        `### ${c.name}（${c.role}）`,
        `状态: ${c.currentStatus}`,
        `位置: ${c.currentLocation || "未知"}`,
        c.alive ? "" : "**已死亡**",
        `目标: ${c.baseProfile.goal}`,
        `冲突: ${c.baseProfile.conflict}`,
        `弧线: ${c.baseProfile.arc}`,
      ];
      if (c.currentAbilities.length > 0) {
        lines.push(`能力: ${c.currentAbilities.join(", ")}`);
      }
      if (c.currentKnowledge.length > 0) {
        lines.push(`已知信息: ${c.currentKnowledge.join(", ")}`);
      }
      return lines.filter(Boolean).join("\n");
    });
    sections.push(`## 角色\n${chars.join("\n\n")}`);
  }

  // Factions
  if (memory.longTerm.factions.length > 0) {
    const factions = memory.longTerm.factions.map(
      (f) => `- ${f.name}: ${f.agenda}（对主角: ${f.stance}）`
    );
    sections.push(`## 势力\n${factions.join("\n")}`);
  }

  // Core items
  if (memory.longTerm.coreItems.length > 0) {
    const items = memory.longTerm.coreItems.map(
      (i) => `- ${i.name}: ${i.purpose}（持有: ${i.currentOwner}, 状态: ${i.currentStatus}）`
    );
    sections.push(`## 核心道具\n${items.join("\n")}`);
  }

  // Volume archives
  if (memory.longTerm.volumeArchives.length > 0) {
    const archives = memory.longTerm.volumeArchives.map(
      (v) => `- 第${v.volumeNumber}卷「${v.title}」: ${v.summary.slice(0, 200)}`
    );
    sections.push(`## 已完成卷\n${archives.join("\n")}`);
  }

  return sections.join("\n\n");
}

function assembleMidTerm(
  memory: StoryMemory,
  _action: WorkflowAction,
  _position: WritingPosition
): string {
  const sections: string[] = [];

  // Plot threads
  const activeThreads = memory.midTerm.plotThreads.filter((t) => t.status === "active" || t.status === "paused");
  if (activeThreads.length > 0) {
    const threads = activeThreads.map((t) => {
      const lastMilestone = t.milestones.filter((m) => m.completed).at(-1);
      return `- [${t.type}] ${t.title}（${t.status}）张力:${t.tension}/10${lastMilestone ? ` 最近进展: ${lastMilestone.description}` : ""}`;
    });
    sections.push(`## 主线/支线\n${threads.join("\n")}`);
  }

  // Relationships
  if (memory.midTerm.relationships.length > 0) {
    const rels = memory.midTerm.relationships.map(
      (r) => `- ${r.characterA} → ${r.characterB}: ${r.currentLabel}（信任: ${r.trust}/10）`
    );
    sections.push(`## 关系矩阵\n${rels.join("\n")}`);
  }

  // Active foreshadows
  const activeForeshadows = memory.midTerm.foreshadows.filter(
    (f) => f.status === "planted" || f.status === "hinted" || f.status === "partial-reveal"
  );
  if (activeForeshadows.length > 0) {
    const fss = activeForeshadows.map((f) => {
      const lastNote = f.progressNotes.at(-1);
      return `- [${f.status}] ${f.clue}${lastNote ? ` — 最近: ${lastNote.note}` : ""}`;
    });
    sections.push(`## 活跃伏笔\n${fss.join("\n")}`);
  }

  // Volume goal progress
  const vg = memory.midTerm.volumeGoalProgress;
  if (vg.volumeGoal) {
    sections.push(
      `## 当前卷目标\n第${vg.volumeNumber}卷: ${vg.volumeGoal}（完成度: ${vg.estimatedCompletion}%）\n剩余: ${vg.remainingMilestones.join(", ") || "无"}`
    );
  }

  // Chapter summaries (compressed)
  if (memory.midTerm.chapterSummaries.length > 0) {
    const summaries = memory.midTerm.chapterSummaries.slice(-5).map(
      (s) => `- 第${s.chapterNumber}章「${s.chapterTitle}」: ${s.narrativeSummary.slice(0, 100)}`
    );
    sections.push(`## 中期章节摘要\n${summaries.join("\n")}`);
  }

  return sections.join("\n\n");
}

function assembleShortTerm(
  memory: StoryMemory,
  action: WorkflowAction,
  _position: WritingPosition
): string {
  const sections: string[] = [];
  const chapters = memory.shortTerm.recentChapters;

  if (chapters.length === 0) return "";

  // For write-scene, only show 2 most recent chapters  
  // For write-chapter, show 3 most recent  
  // For run-audit, show all
  const depth = action === "run-audit" ? chapters.length
    : action === "write-scene" ? Math.min(2, chapters.length)
    : Math.min(3, chapters.length);

  const relevant = chapters.slice(-depth);

  for (let i = 0; i < relevant.length; i++) {
    const ch = relevant[i];
    const isLatest = i === relevant.length - 1;
    const lines = [`### 第${ch.chapterNumber}章「${ch.chapterTitle}」`];

    // Latest chapter gets full detail
    if (isLatest) {
      lines.push(ch.narrativeSummary);
      if (ch.stateChanges.length > 0) {
        lines.push("状态变更:");
        for (const sc of ch.stateChanges) {
          lines.push(`  - ${sc.target}: ${sc.before} → ${sc.after}（${sc.reason}）`);
        }
      }
      if (ch.keyDialogues.length > 0) {
        lines.push("关键对话:");
        for (const d of ch.keyDialogues) {
          lines.push(`  - ${d.speaker}: "${d.line}"（${d.significance}）`);
        }
      }
    } else if (i === relevant.length - 2) {
      // Second latest: summary + hook + open questions
      lines.push(ch.narrativeSummary);
      if (ch.openQuestions.length > 0) {
        lines.push(`未解问题: ${ch.openQuestions.join("; ")}`);
      }
    } else {
      // Older: just summary
      lines.push(ch.narrativeSummary);
    }

    if (ch.endHook) {
      lines.push(`章末钩子: ${ch.endHook}`);
    }

    sections.push(lines.join("\n"));
  }

  // Pending hooks
  if (memory.shortTerm.pendingHooks.length > 0) {
    sections.push(`## 待回收钩子\n${memory.shortTerm.pendingHooks.map((h) => `- ${h}`).join("\n")}`);
  }

  return sections.join("\n\n");
}

function assembleWorking(memory: StoryMemory): string {
  const sections: string[] = [];
  const w = memory.working;

  if (w.currentOutline) {
    sections.push(
      `## 当前章纲\n标题: ${w.currentOutline.title}\n目标: ${w.currentOutline.goal}\n冲突: ${w.currentOutline.conflict}\n钩子: ${w.currentOutline.hook}\n摘要: ${w.currentOutline.summary}`
    );
  }

  if (w.userNotes) {
    sections.push(`## 用户指令\n${w.userNotes}`);
  }

  if (w.previousSceneTail) {
    sections.push(`## 上一场景尾段\n${w.previousSceneTail}`);
  }

  return sections.join("\n\n");
}
