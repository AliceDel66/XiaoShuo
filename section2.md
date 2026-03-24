# 第二阶段设计方案：长篇记忆系统（Story Memory System）

## 1. 第二阶段目标理解

当前仓库已具备完整的**单次生成闭环**：立项 → 资料库 → 卷纲 → 章纲 → 写作 → 状态更新 → 审计。但在长篇创作的核心场景——写到第 20 章、第 50 章时——系统面临三个结构性瓶颈：

| 瓶颈 | 现状根因 | 后果 |
|------|---------|------|
| **状态累积缺失** | `ChapterStateDelta` 只记录"第 N 章发生了什么变化"，没有"当前全局状态快照" | AI 写第 30 章时，无法知晓角色 X 当前的完整状态，只能看到最近 5-6 条 delta |
| **上下文爆炸** | workflow-service.ts 直接将 `storyBibleJson`、`latestStatesJson` 全量序列化 | 20 章后 context 轻松超 128K tokens，即使截取也丢失关键信息 |
| **记忆不可控** | 没有 patch 审计、没有用户确认、没有冲突检测 | 状态漂移后用户无从发现，修复成本极高 |

本阶段目标：**将 Story Memory 提升为系统一等公民**，让 AI 在任意章节都能拿到**正确、压缩、分层**的上下文，同时让用户对每一次记忆变更拥有完整可见性和否决权。

## 2. Story Memory 为什么必须独立设计

现有 `ChapterStateDelta` 是**审计日志**（什么时候改了什么），而非**状态机**（当前世界是什么样的）。这两者的区别决定了记忆系统不能是 `chapterStates` 的附属品：

```
ChapterStateDelta（现有）：
  第3章: 陈默 信任→怀疑 林照
  第5章: 陈默 怀疑→有限合作 林照
  第8章: 陈默 有限合作→深度绑定 林照

StoryMemory（目标）：
  关系[陈默→林照].current = "深度绑定"
  关系[陈默→林照].history = [{ch3,"信任→怀疑"},{ch5,"怀疑→有限合作"},{ch8,"有限合作→深度绑定"}]
  关系[陈默→林照].lastUpdated = "chapter-008"
```

独立设计的理由：

1. **不同的读取模式**：写作时需要"当前快照"，审计时需要"变更历史"，两者查询路径不同
2. **不同的更新频率**：长期设定几乎不变，关系每章可能变，临时战术状态每个场景都变
3. **不同的生命周期**：ChapterStateDelta 随章节绑定，StoryMemory 跨越全书
4. **不同的持久化需求**：delta 可以重建，但累积状态需要独立快照便于回滚

## 3. StoryMemoryService 架构方案

### 3.1 职责边界

```
┌──────────────────────────────────────────────┐
│              StoryMemoryService              │
│                                              │
│  存储：维护四层记忆的当前快照                    │
│  读取：按 action 类型返回裁剪后的记忆上下文        │
│  装配：根据 token 预算组装分层上下文               │
│  合并：接收 MemoryPatch，校验后合并到快照          │
│  审计：暴露 patch 历史供用户审阅和回滚             │
│                                              │
│  不负责：调用 LLM、管理生成流程、持久化文件格式     │
│        （持久化委托给 ProjectRepository 扩展）    │
└──────────────────────────────────────────────┘
```

### 3.2 核心 API 签名

```typescript
class StoryMemoryService {
  /** 从磁盘加载项目的完整记忆状态 */
  loadMemory(rootPath: string): Promise<StoryMemory>;

  /** 保存完整记忆状态到磁盘 */
  saveMemory(rootPath: string, memory: StoryMemory): Promise<void>;

  /** 根据 action + 当前写作位置，组装上下文（受 token 预算约束） */
  assembleContext(
    memory: StoryMemory,
    action: WorkflowAction,
    position: WritingPosition,
    budget: ContextBudget
  ): AssembledMemoryContext;

  /** 从 AI 生成结果或用户编辑中提取 patch */
  extractPatch(
    source: PatchSource,
    currentMemory: StoryMemory,
    rawContent: unknown
  ): MemoryPatch;

  /** 校验 patch，返回冲突列表 */
  validatePatch(patch: MemoryPatch, memory: StoryMemory): PatchValidationResult;

  /** 合并已确认的 patch 到记忆状态（返回新的 StoryMemory，不可变） */
  applyPatch(patch: MemoryPatch, memory: StoryMemory): StoryMemory;

  /** 回退最近的 N 个 patch */
  rollbackPatches(memory: StoryMemory, count: number): StoryMemory;

  /** 获取 patch 历史（审计用） */
  getPatchHistory(memory: StoryMemory, filter?: PatchHistoryFilter): AppliedPatch[];

  /** 压缩中期/短期层：将较旧的状态摘要化 */
  compactMemory(memory: StoryMemory, retentionPolicy: RetentionPolicy): StoryMemory;
}
```

### 3.3 与现有流程的嵌入点

```
现有流程：
  WorkflowService.buildPromptTrace() → 组装 prompt
  WorkflowService.generateCandidate() → 调用 AI
  WorkflowService.applyConfirmedArtifact() → 保存结果

改造后：
  WorkflowService.buildPromptTrace() 
    ├─ 调用 storyMemoryService.assembleContext() ← 新增
    └─ 将 assembledContext 注入 prompt payload
  
  WorkflowService.applyConfirmedArtifact()
    ├─ 保存原有 artifact
    ├─ 调用 storyMemoryService.extractPatch() ← 新增
    ├─ 调用 storyMemoryService.validatePatch() ← 新增
    └─ 如果是自动模式则 applyPatch，否则标记待确认
```

## 4. MemoryPatch 机制设计

### 4.1 Patch 数据结构

```typescript
interface MemoryPatch {
  patchId: string;                    // nanoid
  source: PatchSource;                // 来源类型
  sourceRef: string;                  // 来源引用 (chapterId / auditId / "manual")
  createdAt: string;                  // ISO
  status: PatchStatus;                // draft → pending → confirmed → applied | rejected
  operations: PatchOperation[];       // 具体变更操作列表
  summary: string;                    // 人类可读的变更摘要
  conflicts: PatchConflict[];         // 校验发现的冲突
}

type PatchSource =
  | "chapter-confirmed"     // 章节确认后自动提取
  | "state-update"          // update-chapter-state 动作产出
  | "audit-repair"          // 审计修复
  | "manual-edit"           // 用户手动编辑
  | "bible-sync";           // 资料库同步

type PatchStatus = "draft" | "pending" | "confirmed" | "applied" | "rejected";

interface PatchOperation {
  op: "set" | "merge" | "append" | "remove" | "increment";
  layer: MemoryLayer;                 // 操作目标层
  path: string;                       // 如 "characters.陈默.status"
  entityType: MemoryEntityType;       // character / relationship / location / ...
  entityId: string;                   // 实体 ID
  field: string;                      // 字段名
  before: unknown;                    // 变更前的值（用于冲突检测）
  after: unknown;                     // 变更后的值
  reason: string;                     // 变更理由
}

type MemoryLayer = "long-term" | "mid-term" | "short-term" | "working";
type MemoryEntityType =
  | "character" | "relationship" | "location" | "item"
  | "timeline" | "plot-thread" | "foreshadow" | "world-rule";
```

### 4.2 Patch 来源

| 来源 | 触发时机 | 生成方式 |
|------|---------|---------|
| `chapter-confirmed` | 用户在 PreviewSession 确认候选后 | AI（auditorModel）按 diff schema 提取 |
| `state-update` | 执行 `update-chapter-state` 动作 | AI 产出的 `ChapterStateDelta` 自动转换 |
| `audit-repair` | 审计发现设定漂移后执行修复 | AI 或人工提出修复 patch |
| `manual-edit` | 用户在 Database 视图手动编辑记忆 | UI 表单生成 |
| `bible-sync` | 资料库被编辑后 | diff 算法对比旧 StoryBible 与新 StoryBible |

### 4.3 校验机制

```typescript
interface PatchValidationResult {
  valid: boolean;
  conflicts: PatchConflict[];
  warnings: PatchWarning[];
}

interface PatchConflict {
  operationIndex: number;
  type: "stale-before"          // before 值与当前实际不匹配
      | "entity-not-found"      // 目标实体不存在
      | "duplicate-update"      // 同一字段在同一批 patch 中被多次修改
      | "cross-layer-violation"; // 试图在错误的层修改数据
  message: string;
  suggestion: "auto-resolve" | "require-human";
}
```

校验策略：
- **stale-before**：如果 `operation.before` 与当前记忆中的值不一致，说明在 patch 生成后记忆已被改动。推荐策略：标记冲突，让用户决定。
- **entity-not-found**：如果 path 指向不存在的实体（如新角色），自动升级为 `set` 操作创建新实体。
- **duplicate-update**：同一 patch 中对同一字段多次操作，保留最后一次。
- **cross-layer-violation**：例如试图在 `working` 层修改长期设定，自动路由到正确的层。

### 4.4 冲突处理策略

| 冲突类型 | 推荐策略 | 可选策略 |
|---------|---------|---------|
| stale-before | 弹窗让用户选择"覆盖/保留/手动合并" | 自动采用最新值 |
| entity-not-found | 自动创建并标记为新增 | 拒绝并提示先更新 bible |
| duplicate-update | 保留最后一条，合并 reason | 全量展示让用户选 |
| cross-layer | 自动路由到正确层 | 拒绝并提示 |

### 4.5 人工确认机制

引入 `MemoryPatchReview` 流程：

```
AI 产出 patch
  → patch.status = "pending"
  → 在 UI 的 Memory Patch 面板展示 diff 预览
  → 用户逐条确认/修改/拒绝
  → patch.status = "confirmed" / "rejected"
  → confirmed 的 patch 执行 applyPatch()
  → applied patch 记入 patchHistory
```

权衡点：

- **推荐方案**：默认"pending + 需人工确认"，但提供"自动应用"开关（在 Settings 面板）。理由：长篇创作中设定漂移的代价很大，人工确认成本可控（每章约 5-15 条操作）。
- **可选方案**：默认自动应用 + 事后审阅。理由：减少打断，但风险是用户不主动审阅就会积累"隐性漂移"。

## 5. 分层记忆模型

### 5.1 四层架构

```
┌─────────────────────────────────────────────────┐
│  Layer 0: Long-Term（长期设定层）                  │
│  ─ 世界规则、角色基础设定、势力结构、核心道具        │
│  ─ 更新频率：极低（仅资料库大改或跨卷升级时）        │
│  ─ 生命周期：全书                                 │
│  ─ 来源：StoryBible 初始化 + 重大 patch            │
├─────────────────────────────────────────────────┤
│  Layer 1: Mid-Term（中期推进层）                   │
│  ─ 主线/支线进度、跨章关系变化、伏笔状态、          │
│    角色阶段性目标、势力博弈态势                     │
│  ─ 更新频率：每 3-5 章滚动摘要                     │
│  ─ 生命周期：当前卷 + 前一卷摘要                   │
│  ─ 来源：patch 累积 + 周期性压缩                   │
├─────────────────────────────────────────────────┤
│  Layer 2: Short-Term（短期状态层）                  │
│  ─ 最近 3-5 章的详细状态变化、角色情绪/位置/         │
│    手中信息、最新关系动态                           │
│  ─ 更新频率：每章                                  │
│  ─ 生命周期：滑动窗口，超出后压缩到中期层            │
│  ─ 来源：chapter-confirmed patch                   │
├─────────────────────────────────────────────────┤
│  Layer 3: Working（当前写作临时层）                  │
│  ─ 当前场景的临时变量、本次对话上下文、               │
│    正在写的场景 outline、用户即时指令                 │
│  ─ 更新频率：每个场景/每次生成                       │
│  ─ 生命周期：单次生成会话，确认后归入短期层           │
│  ─ 来源：用户输入 + 生成过程中的中间状态              │
└─────────────────────────────────────────────────┘
```

### 5.2 各层存储内容与上下文参与方式

| 层 | 存储内容 | Token 预算占比（写章场景） | 压缩策略 |
|----|---------|-------------------------|---------|
| Long-Term | 角色卡（基础属性+弧线）、世界规则、势力关系图、核心道具列表 | ~20% | 几乎不压缩，但字段裁剪（如省略 secrets 细节） |
| Mid-Term | 主线进度摘要、关系矩阵当前值、伏笔状态表、卷级目标剩余项 | ~25% | 每 5 章自动摘要，旧卷只保留 300 字概要 |
| Short-Term | 最近 3-5 章的 ChapterMemorySummary（含状态变化+关键对话+钩子） | ~35% | 最近 2 章保留详细，第 3-5 章只保留结构化摘要 |
| Working | 当前章纲、当前场景 outline、用户 notes、上一场景的尾段 | ~20% | 不压缩，用完即弃 |

### 5.3 压缩与晋升规则

```
Short-Term 窗口管理：
  当 shortTermChapters.length > 5:
    1. 取最旧的章 (chapters[0])
    2. 用 auditorModel 生成 300 字结构化摘要
    3. 将摘要合并到 Mid-Term 的 chapterSummaries
    4. 将 chapters[0] 的状态变化累积到 Mid-Term 的实体当前值
    5. 从 Short-Term 删除 chapters[0]

Mid-Term 卷级压缩：
  当进入新卷时：
    1. 将上一卷的所有 Mid-Term 数据压缩为一份 VolumeSummary（约 500 字）
    2. VolumeSummary 归入 Long-Term 的 volumeArchives
    3. Mid-Term 重置为新卷初始状态
```

## 6. TypeScript 类型草案

```typescript
// ═══════════════════════════════════════════════
// 核心记忆对象
// ═══════════════════════════════════════════════

/** 项目的完整记忆状态（一等公民） */
export interface StoryMemory {
  projectId: string;
  version: number;                          // 每次 applyPatch 递增
  lastUpdatedAt: string;
  
  longTerm: LongTermMemory;
  midTerm: MidTermMemory;
  shortTerm: ShortTermMemory;
  working: WorkingMemory;
  
  patchHistory: AppliedPatch[];             // 最近 N 条（磁盘上保留全量）
  patchHistoryTrimmedBefore?: string;       // 内存中被截断的边界
}

// ── Long-Term Layer ─────────────────────────

export interface LongTermMemory {
  worldRules: WorldRule[];
  characters: CharacterState[];
  factions: FactionState[];
  coreItems: ItemState[];
  volumeArchives: VolumeSummary[];          // 已完成卷的压缩摘要
}

export interface WorldRule {
  id: string;
  layer: string;                            // "表层秩序" / "深层规则"
  content: string;
  constraints: string[];
  addedAt: string;                          // 首次添加的章节引用
  lastVerifiedAt: string;                   // 最后一次审计确认
}

export interface CharacterState {
  id: string;
  name: string;
  role: string;                             // "主角" / "搭档" / "反派" / "NPC"
  baseProfile: {
    goal: string;
    conflict: string;
    arc: string;
    secrets: string[];
  };
  currentStatus: string;                    // 当前状态的自然语言描述
  currentAbilities: string[];               // 当前已知能力
  currentKnowledge: string[];               // 当前已知信息（info asymmetry tracking）
  currentLocation: string;
  alive: boolean;
  lastUpdatedChapter: string;
}

export interface FactionState {
  id: string;
  name: string;
  agenda: string;
  resources: string[];
  stance: string;                           // 对主角的当前立场
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
  summary: string;                          // 约 500 字的卷级摘要
  keyEvents: string[];
  stateAtEnd: string;                       // 卷末世界状态概要
  completedAt: string;
}

// ── Mid-Term Layer ──────────────────────────

export interface MidTermMemory {
  currentVolume: number;
  plotThreads: PlotThread[];
  relationships: RelationshipState[];
  foreshadows: ForeshadowState[];
  locationStates: LocationState[];
  chapterSummaries: ChapterMemorySummary[]; // 被压缩到中期层的旧章摘要
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
  tension: number;                          // 0-10 张力指数，供节奏分析用
}

export interface RelationshipState {
  id: string;
  characterA: string;                       // 角色 ID
  characterB: string;
  currentLabel: string;                     // "深度绑定" / "敌对" / "暗中监视"
  trust: number;                            // -10 到 10
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
  targetPayoffChapter?: string;             // 预期揭晓章节
  actualPayoffChapter?: string;             // 实际揭晓章节
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
  currentCondition: string;                 // "已封锁" / "正常运作" / "已摧毁"
  occupants: string[];                      // 当前在此处的角色 ID
  significance: string;                     // 对剧情的意义
  lastEventChapter: string;
}

export interface VolumeGoalProgress {
  volumeNumber: number;
  volumeGoal: string;
  completedMilestones: string[];
  remainingMilestones: string[];
  estimatedCompletion: number;              // 0-100
}

// ── Short-Term Layer ────────────────────────

export interface ShortTermMemory {
  recentChapters: ChapterMemorySnapshot[];  // 最近 3-5 章的详细快照
  pendingHooks: string[];                   // 最近章末钩子（待回收）
  activeSceneThreads: string[];             // 当前活跃的场景线索
}

export interface ChapterMemorySnapshot {
  chapterId: string;
  chapterNumber: number;
  chapterTitle: string;
  /** 300-500 字的结构化摘要 */
  narrativeSummary: string;
  /** 状态变更列表 */
  stateChanges: StateChangeEntry[];
  /** 关键对话摘录（保留原文） */
  keyDialogues: Array<{
    speaker: string;
    line: string;
    significance: string;
  }>;
  /** 章末钩子 */
  endHook: string;
  /** 新引入的未解问题 */
  openQuestions: string[];
  /** 新植入/推进的伏笔 */
  foreshadowActivity: string[];
  /** 本章涉及的角色 */
  involvedCharacters: string[];
  /** 本章涉及的地点 */
  involvedLocations: string[];
  createdAt: string;
}

// ── Working Layer ───────────────────────────

export interface WorkingMemory {
  /** 当前正在写的章节/场景 ID */
  activeChapterId: string | null;
  activeSceneIndex: number | null;
  /** 当前章纲 */
  currentOutline: OutlinePacket | null;
  /** 用户即时指令 */
  userNotes: string;
  /** 当前场景之前的场景草稿尾段（续写用） */
  previousSceneTail: string;
  /** 本次生成会话中的临时状态 */
  tempStateOverrides: Record<string, unknown>;
}

// ═══════════════════════════════════════════════
// Patch 系统
// ═══════════════════════════════════════════════

export type PatchSource =
  | "chapter-confirmed"
  | "state-update"
  | "audit-repair"
  | "manual-edit"
  | "bible-sync";

export type PatchStatus = "draft" | "pending" | "confirmed" | "applied" | "rejected";

export type PatchOperationType = "set" | "merge" | "append" | "remove" | "increment";

export type MemoryLayer = "long-term" | "mid-term" | "short-term" | "working";

export type MemoryEntityType =
  | "character" | "relationship" | "location" | "item"
  | "timeline" | "plot-thread" | "foreshadow"
  | "world-rule" | "faction" | "chapter-summary";

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

// ═══════════════════════════════════════════════
// 上下文装配
// ═══════════════════════════════════════════════

export interface WritingPosition {
  volumeNumber: number;
  chapterNumber?: number;
  sceneIndex?: number;
}

export interface ContextBudget {
  /** 可用于记忆上下文的最大 token 数 */
  maxTokens: number;
  /** 各层的预算分配比例（0-1，和为 1） */
  layerWeights: {
    longTerm: number;
    midTerm: number;
    shortTerm: number;
    working: number;
  };
}

export interface AssembledMemoryContext {
  /** 组装后的结构化文本，可直接嵌入 prompt */
  longTermContext: string;
  midTermContext: string;
  shortTermContext: string;
  workingContext: string;
  /** 合并后的完整上下文文本 */
  fullContext: string;
  /** 实际使用的估算 token 数 */
  estimatedTokens: number;
  /** 被截断的信息列表 */
  truncations: string[];
}

export interface SceneMemoryContext {
  /** 当前场景写作所需的精简上下文包 */
  protagonistSnapshot: string;
  activeRelationships: string;
  sceneLocation: string;
  recentPlotProgress: string;
  pendingHooks: string[];
  previousSceneTail: string;
  sceneOutline: string;
}

// ═══════════════════════════════════════════════
// 配置
// ═══════════════════════════════════════════════

export interface RetentionPolicy {
  shortTermWindowSize: number;             // 短期层保留章数，默认 5
  midTermSummaryInterval: number;          // 中期层摘要间隔章数，默认 5
  patchHistoryInMemory: number;            // 内存中保留的 patch 数，默认 50
  volumeArchiveMaxWords: number;           // 卷摘要最大字数，默认 500
  chapterSummaryMaxWords: number;          // 章摘要最大字数，默认 300
}

export interface MemoryAutoApplyPolicy {
  enabled: boolean;                        // 是否自动应用 patch
  autoApplyThreshold: number;              // 冲突数低于此值时自动应用
  requireHumanForSeverity: PatchConflict["type"][];  // 这些冲突类型必须人工确认
}
```

## 7. 上下文装配规则

### 7.1 各 Action 的记忆装配策略

| Action | Long-Term | Mid-Term | Short-Term | Working | 总预算参考 |
|--------|-----------|----------|------------|---------|-----------|
| `generate-story-bible` | 无（正在生成） | 无 | 无 | premiseCard + manifest | 2K tokens |
| `generate-volume-outline` | 世界规则 + 角色基础卡 + 已归档卷摘要 | 无（正在规划） | 无 | planCard + bible 摘要 | 4K tokens |
| `generate-chapter-outline` | 角色卡（裁剪版）+ 世界规则摘要 | 当前卷进度 + 活跃伏笔 + 主线进度 | 最近 2 章摘要 | 卷纲 + 用户 notes | 6K tokens |
| **`write-chapter`** | 角色卡 + 世界规则 + 核心道具 | 关系矩阵 + 活跃伏笔 + 主线进度 | 最近 3 章详细快照 | 章纲 + notes + 上一章尾段 | **8K tokens** |
| **`write-scene`** | 角色卡（当前场景涉及角色） | 相关关系 + 相关伏笔 | 最近 2 章 + 当前章前序场景 | scene outline + 上一场景尾段 | **6K tokens** |
| `update-chapter-state` | 角色卡骨架（仅 name+status） | 最新关系矩阵 | 最近 1 章详细 | 当前章草稿全文 | 8K tokens |
| `run-audit` | 完整长期层 | 完整中期层 | 全部短期层 | 审计范围指令 | **12K tokens** |
| `repair` | 被修复实体的完整上下文 | 相关线索链 | 相关章节摘要 | 修复指令 | 6K tokens |

### 7.2 write-chapter 装配详解（核心场景）

```
[Long-Term: ~1600 tokens]
  - 世界规则摘要（每条 1 行，约 200 tokens）
  - 出场角色的 CharacterState（name, role, currentStatus, 
    currentKnowledge, currentLocation；省略 baseProfile.secrets 
    除非本章需要揭示）
  - 核心道具中 currentOwner 变化过的（约 100 tokens）

[Mid-Term: ~2000 tokens]
  - 主线 PlotThread（title, status, lastMilestone）
  - 活跃 subplots 的一行摘要
  - 关系矩阵：只含本章出场角色间的关系（currentLabel + trust）
  - 活跃伏笔：status=planted/hinted 的条目（clue + progressNotes 最后一条）
  - 当前卷目标进度（一行摘要）

[Short-Term: ~2800 tokens]
  - 最近 3 章 ChapterMemorySnapshot：
    - chapter[-1]: 完整 narrativeSummary + 全部 stateChanges + keyDialogues + endHook
    - chapter[-2]: narrativeSummary + endHook + openQuestions
    - chapter[-3]: 仅 narrativeSummary + endHook
  - pendingHooks 列表

[Working: ~1600 tokens]
  - 当前章纲（OutlinePacket 完整内容）
  - 用户 notes
  - 上一章最后 500 字正文（续写语感衔接）
```

### 7.3 什么时候不应该带太多信息

1. **generate-project-setup / generate-story-bible**：这是创世阶段，此时记忆系统为空或应为空，不需要上下文。
2. **write-scene**：比 write-chapter 更窄聚焦，只需当前场景涉及的角色和地点，不需要全局视角。关键原则：**场景级 prompt 越精练越好**，避免上下文竞争导致 AI 试图在单个场景中推进过多线索。
3. **run-audit**：反直觉地，这是唯一可以带"全量"的 action，因为审计的目的就是全局比对。

### 7.4 避免上下文污染与冗余

| 污染类型 | 防御策略 |
|---------|---------|
| **重复信息** | assembleContext 对四层做去重：如果 Short-Term 中已包含某角色的最新 status，Long-Term 中省略该角色的 currentStatus |
| **过时信息** | Long-Term 的 `lastVerifiedAt` 字段用于检测是否需要刷新；超过 10 章未验证的世界规则降低优先级 |
| **语义噪声** | 对话摘录只保留 `significance` 为"信息差/关系转折/伏笔"的条目，不保留日常对话 |
| **未来泄漏** | 严格只传"当前章之前"的信息，伏笔的 `targetPayoffChapter` 不传给 writer（只传给 planner/auditor） |
| **token 超限** | assembleContext 内置 token 估算（按中文约 1 字符 = 1.5 token），超限时按优先级裁剪 |

## 8. 与现有仓库模块的整合建议

### 8.1 与 WorkflowService 整合

**改造点：**workflow-service.ts 和 workflow-service.ts

```typescript
// 改造前（workflow-service.ts L112-117）：
const context: Record<string, string> = {
  storyBibleJson: JSON.stringify(snapshot.storyBible),
  latestStatesJson: JSON.stringify(snapshot.chapterStates.slice(-6)),
  // ... 大量 JSON.stringify 
};

// 改造后：
const memoryContext = this.storyMemoryService.assembleContext(
  memory,
  input.action,
  { volumeNumber: input.volumeNumber ?? 1, chapterNumber: input.chapterNumber },
  this.getContextBudget(input.action)
);
const context: Record<string, string> = {
  // ... 保留 manifest/meta 相关不变
  memoryLongTerm: memoryContext.longTermContext,
  memoryMidTerm: memoryContext.midTermContext,
  memoryShortTerm: memoryContext.shortTermContext,
  memoryWorking: memoryContext.workingContext,
  // storyBibleJson / latestStatesJson 降级为 fallback
};
```

关键约束：**渐进式改造**。在 prompt 模板中新增 `{{memoryLongTerm}}` 等变量，旧变量 `{{storyBibleJson}}` 保留但内容改为仅在 memory 为空时回退使用。这样未迁移的项目仍可正常工作。

### 8.2 与 AiOrchestrator / Provider 层整合

**无需侵入修改**。StoryMemoryService 在 prompt 组装层工作，产出纯文本注入到 `promptTrace.userPrompt`，不触碰 Provider 抽象。

唯一新增：当 `extractPatch` 需要让 AI 提取记忆变更时，通过现有 `aiOrchestrator.executeJson` 调用即可。

### 8.3 与 PreviewSession 整合

在 `confirmCandidate` 之后新增 patch 提取步骤：

```typescript
// generation-coordinator.ts 或 workbench-service.ts
async confirmCandidate(sessionId, candidateId) {
  // ... 现有保存逻辑 ...
  
  // 新增：提取 memory patch
  const memory = await this.storyMemoryService.loadMemory(rootPath);
  const patch = await this.storyMemoryService.extractPatch(
    "chapter-confirmed",
    memory,
    candidate.structuredPayload
  );
  
  if (this.memoryAutoApplyPolicy.enabled && patch.conflicts.length === 0) {
    const newMemory = this.storyMemoryService.applyPatch(patch, memory);
    await this.storyMemoryService.saveMemory(rootPath, newMemory);
  } else {
    // 存入待审阅队列
    await this.storyMemoryService.savePendingPatch(rootPath, patch);
    // 通知 UI
    this.emitter.emit("event", { type: "memory-patch-pending", patch });
  }
}
```

### 8.4 与 ProjectRepository 整合

新增记忆相关的磁盘路径和读写方法：

```typescript
// project-repository.ts 新增
private getPaths(root: string): ProjectPaths {
  return {
    // ... 现有路径 ...
    memoryDir: join(root, "08-记忆"),          // 新增
  };
}

// 新增文件结构：
// 08-记忆/
//   memory.yaml              ← StoryMemory 主文件
//   patches/
//     patch-{id}.yaml        ← 每个 patch 单独一个文件
//     pending/               ← 待确认的 patch
//   snapshots/
//     memory-v{version}.yaml ← 版本快照（回滚用，按策略保留最近 N 个）
```

### 8.5 与 AuditService（run-audit）整合

审计报告新增记忆一致性维度：

```typescript
// 扩展 AuditReport
export interface AuditReport {
  // ... 现有字段 ...
  memoryFindings: AuditFinding[];            // 新增：记忆一致性审计
}

// 审计时，将完整 StoryMemory 传入 prompt，让 AI 检查：
// - 角色 currentStatus 是否与最近草稿一致
// - 伏笔 status 是否正确
// - 关系矩阵是否反映了最新剧情
// - 是否有"幽灵实体"（记忆中存在但草稿中从未出场的角色）
```

### 8.6 与 Editor / Outline / Database 视图整合

| 视图 | 整合方式 |
|------|---------|
| **DatabaseView** | 新增"记忆总览"标签页，展示四层记忆的结构化视图（角色状态表、关系图、伏笔追踪表、时间线） |
| **EditorView** | 侧边栏新增"写作上下文"面板，实时展示 WorkingMemory 中 AI 将使用的上下文预览 |
| **OutlineView** | 章纲节点上标注涉及的伏笔和角色，hover 弹出相关记忆摘要 |
| **DashboardView** | 新增"待审阅 patch"计数 badge，pending patch 列表入口 |

### 8.7 新增 IPC 通道

```typescript
// 新增 IPC 调用
ipcMain.handle("workbench:getStoryMemory", (_e, projectId) => service.getStoryMemory(projectId));
ipcMain.handle("workbench:getPendingPatches", (_e, projectId) => service.getPendingPatches(projectId));
ipcMain.handle("workbench:reviewPatch", (_e, projectId, patchId, decision) => service.reviewPatch(projectId, patchId, decision));
ipcMain.handle("workbench:rollbackMemory", (_e, projectId, targetVersion) => service.rollbackMemory(projectId, targetVersion));
ipcMain.handle("workbench:compactMemory", (_e, projectId) => service.compactMemory(projectId));
```

## 9. 推荐优先实现顺序

```
Phase 2.1 — 基础骨架（1 周）
  ├─ 定义所有 TypeScript 类型（types.ts 扩展）
  ├─ 实现 StoryMemoryService 核心：load / save / applyPatch
  ├─ 扩展 ProjectRepository 支持 08-记忆 目录
  └─ 单元测试：patch apply / rollback / validation

Phase 2.2 — Patch 提取与集成（1 周）
  ├─ 实现 extractPatch：将 ChapterStateDelta 转换为 MemoryPatch
  ├─ 实现 bible-sync：StoryBible 初始导入到 Long-Term
  ├─ 改造 confirmCandidate 流程：确认后自动提取 patch
  └─ 补充新 WorkflowAction: "extract-memory-patch"

Phase 2.3 — 上下文装配（1 周）
  ├─ 实现 assembleContext：四层裁剪 + token 预算
  ├─ 改造 buildPromptPayload 使用 assembledContext
  ├─ 更新 prompt 模板支持 {{memoryLongTerm}} 等变量
  └─ 集成测试：验证 20 章场景下的上下文质量

Phase 2.4 — 压缩与晋升（0.5 周）
  ├─ 实现 compactMemory：Short→Mid 压缩
  ├─ 实现卷级归档：Mid→Long 压缩
  └─ 自动触发机制（章数阈值 / 卷切换）

Phase 2.5 — UI 与用户交互（1 周）
  ├─ DatabaseView 新增记忆总览面板
  ├─ Patch 审阅面板（diff 预览 + 确认/拒绝）
  ├─ DashboardView 待审阅 badge
  └─ EditorView 写作上下文侧边栏
```

## 10. 第二阶段最值得先落地的 5 个任务

| 优先级 | 任务 | 为什么先做 | 产出物 |
|-------|------|----------|-------|
| **P0** | **定义 StoryMemory + MemoryPatch 类型并扩展 ProjectRepository** | 所有后续工作的类型基础；不改现有逻辑，纯新增 | types.ts 扩展 + project-repository.ts 新增 `08-记忆` 目录读写 |
| **P0** | **实现 StoryMemoryService.applyPatch + validatePatch + rollback** | patch 是整个记忆系统的核心原语；有了它才能做增量更新 | 新文件 `src/main/services/story-memory-service.ts` + 测试 |
| **P1** | **实现 bible-sync：StoryBible → LongTermMemory 初始导入** | 让现有项目能无缝迁移到记忆系统；不依赖 AI 调用 | `StoryMemoryService.initFromBible()` 方法 |
| **P1** | **改造 buildPromptPayload 接入 assembleContext** | 最核心的用户价值：写作时 AI 拿到的上下文从"全量 dump"变为"分层精选" | workflow-service.ts 改造 |
| **P2** | **实现 confirmCandidate 后自动提取 patch 并存入 pending 队列** | 闭环：写完一章 → 自动产出 patch → 等待确认 → 记忆更新 | workbench-service.ts `confirmCandidate` 改造 |

---

### 关键权衡记录

| 决策点 | 推荐方案 | 可选方案 | 推荐理由 |
|-------|---------|---------|---------|
| Patch 默认行为 | **pending + 人工确认** | 自动应用 + 事后审阅 | 长篇中设定漂移的修复成本远高于每章 30 秒的确认成本 |
| 记忆持久化格式 | **YAML 文件（与现有一致）** | SQLite 表 | 保持与现有仓库一致的"文件可回滚、可版本管理"模式；未来数据量大了可加 SQLite 索引层 |
| token 估算方式 | **中文字符数 × 1.5** | 调用 tokenizer 精确计算 | 精确 tokenizer 需要依赖具体模型，本地估算对预算分配足够准确，且零延迟 |
| 短期层窗口大小 | **5 章** | 3 章 / 动态调整 | 5 章是网文"一个小节奏回环"的典型长度，太少丢信息，太多浪费 budget |
| 卷级归档触发 | **进入新卷时手动触发 + 系统提示** | 全自动 | 卷的边界往往需要用户确认（可能修改前卷结尾），全自动有误触风险 |
| extractPatch 的 AI 调用角色 | **auditorModel**（低温度） | writerModel | 提取状态变化是分析任务，需要精确性而非创造性 |

--- 

已完成: *输出完整第二阶段设计方案* (5/5)

以上是完整的第二阶段设计方案。核心思路总结：

1. **StoryMemory 是独立的一等对象**，不是 `chapterStates` 的衍生物——它有自己的四层结构、独立持久化目录（`08-记忆`）、独立服务类
2. **Patch 是唯一的变更通道**——所有对记忆的修改都必须经过 `MemoryPatch → validate → confirm → apply` 流程，保证可审计、可回滚
3. **渐进式改造**——通过在 prompt 模板中新增变量（`{{memoryLongTerm}}`）而非替换旧变量来保持向后兼容，未迁移的项目仍可正常工作
4. **上下文组装是分层裁剪**——不再全量 `JSON.stringify(storyBible)`，而是按 action 类型和 token 预算从四层中精选最相关的信息

如果需要，我可以立即开始实现 P0 任务（类型定义 + StoryMemoryService 核心代码）。