import { nanoid } from "nanoid";
import type {
  AuditReport,
  ChapterDraft,
  ChapterStateDelta,
  ChunkScope,
  GenerationPromptTrace,
  ModelProfile,
  OutlinePacket,
  PremiseCard,
  ProjectManifest,
  ProjectSnapshot,
  ReferenceCorpusManifest,
  StoryBible,
  WorkflowExecutionInput
} from "../../shared/types";
import { excerpt, nowIso, stripMarkdown } from "./helpers";

export type ModelRole = "plannerModel" | "writerModel" | "auditorModel";

export interface AiExecutionResult<T> {
  data: T;
  source: "model" | "fallback";
  rawText: string;
}

interface JsonCallOptions<T> {
  role: ModelRole;
  promptTrace: GenerationPromptTrace;
  fallback: () => T;
}

export class AiOrchestrator {
  constructor(private readonly getModelProfile: () => Promise<ModelProfile>) {}

  async executeJson<T>(options: JsonCallOptions<T>): Promise<AiExecutionResult<T>> {
    const profile = await this.getModelProfile();
    const model = profile[options.role];
    if (!profile.baseUrl || !profile.apiKey || !model) {
      const fallback = options.fallback();
      return {
        data: fallback,
        source: "fallback",
        rawText: JSON.stringify(fallback, null, 2)
      };
    }

    try {
      const response = await fetch(joinApiUrl(profile.baseUrl, "chat/completions"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${profile.apiKey}`
        },
        body: JSON.stringify({
          model,
          temperature: profile.temperaturePolicy[toTemperatureKey(options.role)],
          messages: [
            { role: "system", content: options.promptTrace.systemPrompt },
            { role: "user", content: options.promptTrace.userPrompt }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`Chat request failed: ${response.status}`);
      }

      const payload = (await response.json()) as {
        choices?: Array<{
          message?: {
            content?: string | Array<{ type?: string; text?: string }>;
          };
        }>;
      };

      const rawContent = payload.choices?.[0]?.message?.content;
      const text =
        typeof rawContent === "string"
          ? rawContent
          : Array.isArray(rawContent)
            ? rawContent.map((item) => item.text ?? "").join("")
            : "";
      const parsed = parseJsonFromText<T>(text);
      if (!parsed) {
        throw new Error("Failed to parse model JSON response");
      }

      return {
        data: parsed,
        source: "model",
        rawText: text
      };
    } catch {
      const fallback = options.fallback();
      return {
        data: fallback,
        source: "fallback",
        rawText: JSON.stringify(fallback, null, 2)
      };
    }
  }

  async embedTexts(texts: string[]): Promise<number[][] | null> {
    const profile = await this.getModelProfile();
    if (!profile.baseUrl || !profile.apiKey || !profile.embeddingModel || texts.length === 0) {
      return null;
    }

    try {
      const response = await fetch(joinApiUrl(profile.baseUrl, "embeddings"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${profile.apiKey}`
        },
        body: JSON.stringify({
          model: profile.embeddingModel,
          input: texts
        })
      });

      if (!response.ok) {
        throw new Error(`Embeddings request failed: ${response.status}`);
      }

      const payload = (await response.json()) as {
        data?: Array<{ embedding: number[] }>;
      };

      if (!payload.data || payload.data.length === 0) {
        return null;
      }

      return payload.data.map((item) => item.embedding);
    } catch {
      return null;
    }
  }
}

function toTemperatureKey(role: ModelRole): keyof ModelProfile["temperaturePolicy"] {
  switch (role) {
    case "plannerModel":
      return "planner";
    case "writerModel":
      return "writer";
    case "auditorModel":
      return "auditor";
    default:
      return "planner";
  }
}

function joinApiUrl(baseUrl: string, path: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  return `${trimmed}/${path.replace(/^\/+/, "")}`;
}

function parseJsonFromText<T>(text: string): T | null {
  const trimmed = text.trim();
  const direct = safeParse<T>(trimmed);
  if (direct) {
    return direct;
  }

  const markers = [trimmed.indexOf("{"), trimmed.indexOf("[")].filter((value) => value >= 0);
  if (markers.length === 0) {
    return null;
  }

  const firstBrace = Math.min(...markers);
  for (let end = trimmed.length; end > firstBrace; end -= 1) {
    const candidate = safeParse<T>(trimmed.slice(firstBrace, end));
    if (candidate) {
      return candidate;
    }
  }

  return null;
}

function safeParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function mockPremiseCard(manifest: ProjectManifest): PremiseCard {
  const keywords = manifest.premise
    .split(/[，。；、\s]+/)
    .filter((item) => item.length > 1)
    .slice(0, 4);
  const seed = keywords[0] ?? manifest.genre;
  return {
    coreSellingPoints: [
      `${manifest.genre}主线 + ${seed}驱动的强钩子开局`,
      "每卷解决一个阶段危机，同时抬高主角代价",
      "资料库与伏笔表同步驱动，保证长期连载稳定性"
    ],
    targetWords: manifest.targetWords,
    volumePlan: Array.from({ length: manifest.plannedVolumes }, (_, index) => {
      const number = index + 1;
      return `第${number}卷：围绕“${keywords[index % Math.max(1, keywords.length)] ?? "核心危机"}”展开阶段冲突，并在卷末抬升世界真相。`;
    }),
    protagonistGrowthCurve: [
      "从被动卷入到主动理解规则",
      "从局部求生到主动布局反击",
      "从个人成长升级为决定世界走向的关键变量"
    ],
    mainConflict: `主角必须在“${manifest.premise}”带来的持续代价中成长，否则主线危机将全面失控。`,
    endingType: manifest.endingType
  };
}

export function mockStoryBible(snapshot: ProjectSnapshot): StoryBible {
  const protagonistName = snapshot.manifest.title.slice(0, 2) || "主角";
  const genre = snapshot.manifest.genre;
  return {
    world: [
      {
        title: "表层秩序",
        summary: `故事的表层是一套看似稳定的${genre}社会结构，但资源、信息和权力被少数节点掌控。`,
        rules: ["普通人只知其表，不知其里", "每次突破都要付出明确代价", "关键信息只能通过行动获得"]
      },
      {
        title: "深层规则",
        summary: "真正推动情节的，是隐藏在日常之下的规则系统与存量冲突，它们会随着主角推进逐步暴露。",
        rules: ["核心规则必须登记后才能扩写", "新的设定必须与旧规则兼容", "每卷末必须揭露一层更大的真相"]
      }
    ],
    characters: [
      {
        id: "char-protagonist",
        name: protagonistName,
        role: "主角",
        goal: "在不断升级的危机中活下来并夺回主动权",
        conflict: "想保护重要的人，但自身能力和信息始终不足",
        arc: "从谨慎试探到建立自己的行动规则",
        secrets: ["与主线危机存在天然关联", "真正的成长代价还未完全显现"],
        currentStatus: "刚刚意识到世界规则并不正常"
      },
      {
        id: "char-ally",
        name: "林照",
        role: "关键搭档",
        goal: "帮助主角完成第一次真正意义上的破局",
        conflict: "立场并非绝对稳定，掌握一部分真相却不愿全说",
        arc: "从观察者转变为行动同盟",
        secrets: ["曾经属于对立阵营", "知道主角身上的隐藏变量"],
        currentStatus: "与主角建立有限信任"
      },
      {
        id: "char-antagonist",
        name: "闻司辰",
        role: "阶段反派",
        goal: "利用主角触发更深层的计划",
        conflict: "必须在控制风险与加快进度之间做选择",
        arc: "从幕后操盘到被迫亲自下场",
        secrets: ["早已监视主角", "与最终主线有直接关联"],
        currentStatus: "处于试探布局阶段"
      }
    ],
    factions: [
      {
        id: "faction-watchers",
        name: "观测署",
        agenda: "维持表层秩序，封存过于危险的真相",
        resources: ["人手网络", "档案权限", "紧急封锁手段"],
        relationshipToProtagonist: "一边利用，一边限制"
      },
      {
        id: "faction-underground",
        name: "灰巷同盟",
        agenda: "用非常规手段争夺规则解释权",
        resources: ["黑市情报", "地下通道", "灰色交易"],
        relationshipToProtagonist: "可合作也可反噬"
      }
    ],
    items: [
      {
        id: "item-core",
        name: "灰烬刻印",
        purpose: "作为主角成长和规则交互的关键媒介",
        owner: protagonistName,
        status: "已觉醒但未完全理解"
      },
      {
        id: "item-key",
        name: "静默档案盒",
        purpose: "揭示卷与卷之间隐藏联系",
        owner: "观测署",
        status: "待夺取"
      }
    ],
    timeline: [
      {
        id: "timeline-001",
        timeLabel: "故事开始前一周",
        description: "主角接触到第一条异常线索，生活开始失衡。",
        relatedCharacters: [protagonistName],
        chapterRef: "前史"
      }
    ],
    foreshadows: [
      {
        id: "foreshadow-001",
        clue: "主角身上的异常反应在第一次危机中被他人注意到。",
        plantedAt: "第一卷",
        payoffPlan: "中后期揭示主角与主线危机之间的历史联系。",
        status: "open"
      },
      {
        id: "foreshadow-002",
        clue: "灰巷同盟刻意引导主角看到不完整真相。",
        plantedAt: "第一卷",
        payoffPlan: "第二卷反转搭档关系与阵营边界。",
        status: "open"
      }
    ]
  };
}

export function mockVolumeOutlines(snapshot: ProjectSnapshot): OutlinePacket[] {
  return Array.from({ length: snapshot.manifest.plannedVolumes }, (_, index) => {
    const volumeNumber = index + 1;
    return {
      id: `volume-${String(volumeNumber).padStart(2, "0")}`,
      level: "volume",
      title: `第${volumeNumber}卷：${volumeTitle(volumeNumber)}`,
      summary: `围绕第${volumeNumber}阶段危机展开，推动主角从“${volumeFocus(volumeNumber)}”进入下一层真相。`,
      goal: `解决第${volumeNumber}阶段的局部危机并取得新的主动权。`,
      conflict: "主角必须在资源不足、规则未知和敌对势力试探之间完成破局。",
      hook: "卷末揭示更大真相，并将上一卷的代价升级为下一卷的主线压力。",
      sceneCount: 24,
      dependencies: volumeNumber === 1 ? [] : [`volume-${String(volumeNumber - 1).padStart(2, "0")}`],
      references: [{ type: "project", id: snapshot.manifest.projectId, title: snapshot.manifest.title, note: "主项目主线" }],
      children: [],
      volumeNumber
    };
  });
}

export function mockChapterOutlines(
  snapshot: ProjectSnapshot,
  volumeNumber: number,
  referenceHints: ReferenceCorpusManifest[]
): OutlinePacket[] {
  const existing = snapshot.outlines.filter((item) => item.level === "chapter" && item.volumeNumber === volumeNumber);
  const start = existing.length + 1;
  const total = 3;
  return Array.from({ length: total }, (_, index) => {
    const chapterNumber = start + index;
    return {
      id: `volume-${String(volumeNumber).padStart(2, "0")}-chapter-${String(chapterNumber).padStart(3, "0")}`,
      level: "chapter",
      title: `第${chapterNumber}章 ${chapterTitle(snapshot.manifest.title, chapterNumber)}`,
      summary: `${chapterNumber}章聚焦于“${chapterBeat(chapterNumber)}”，既推进当前局面，也留下下一章钩子。`,
      goal: "推动主角掌握更多信息，并制造新的行动选择。",
      conflict: "眼前的行动目标与长期风险发生冲突。",
      hook: chapterNumber % 3 === 0 ? "章末抛出更大的谜团。" : "章末给出一个更强的即时压力。",
      sceneCount: 3 + (chapterNumber % 2),
      dependencies: chapterNumber > 1 ? [`volume-${String(volumeNumber).padStart(2, "0")}-chapter-${String(chapterNumber - 1).padStart(3, "0")}`] : [],
      references: [
        { type: "project", id: snapshot.manifest.projectId, title: snapshot.manifest.title, note: "主项目章节推进" },
        ...referenceHints.slice(0, 2).map((corpus) => ({
          type: "corpus" as const,
          id: corpus.corpusId,
          title: corpus.title,
          note: `${corpus.analysisArtifacts.structureProfile.openingHook} / ${corpus.analysisArtifacts.voiceProfile.narrationBias}`
        }))
      ],
      children: Array.from({ length: 3 + (chapterNumber % 2) }, (_, sceneIndex) => `${chapterNumber}-scene-${sceneIndex + 1}`),
      chapterNumber,
      volumeNumber
    };
  });
}

export function mockDraft(
  snapshot: ProjectSnapshot,
  input: WorkflowExecutionInput,
  chapterOutline: OutlinePacket | undefined,
  referenceHints: ReferenceCorpusManifest[]
): Omit<ChapterDraft, "createdAt" | "updatedAt"> {
  const outline = chapterOutline ?? {
    id: `chapter-${String(input.chapterNumber ?? snapshot.drafts.length + 1).padStart(3, "0")}`,
    level: "chapter" as const,
    title: input.chapterTitle ?? `第${input.chapterNumber ?? snapshot.drafts.length + 1}章`,
    summary: "围绕新的局势展开一轮推进。",
    goal: "推进主线",
    conflict: "危机升级",
    hook: "留下下一章钩子",
    sceneCount: input.scope === "scene" ? 1 : 3,
    dependencies: [],
    references: [],
    children: [],
    chapterNumber: input.chapterNumber ?? snapshot.drafts.length + 1,
    volumeNumber: input.volumeNumber ?? 1
  };
  const scope: ChunkScope = input.scope ?? "chapter";
  const sceneCount = scope === "scene" ? 1 : Math.max(2, outline.sceneCount);
  const referenceNote = referenceHints[0]
    ? `参考语感：${referenceHints[0].analysisArtifacts.voiceProfile.narrationBias}，对话占比约 ${Math.round(
        referenceHints[0].analysisArtifacts.voiceProfile.dialogueRatio * 100
      )}%`
    : "参考语感：以信息推进和局势升级为主";

  const markdown = [
    `# ${outline.title}`,
    "",
    `> 目标：${outline.goal}`,
    `> 冲突：${outline.conflict}`,
    `> 钩子：${outline.hook}`,
    `> ${referenceNote}`,
    "",
    ...Array.from({ length: sceneCount }, (_, index) => {
      const sceneNumber = index + 1;
      return [
        `## 场景 ${sceneNumber}`,
        "",
        `${snapshot.storyBible?.characters[0]?.name ?? "主角"}在${sceneSetting(sceneNumber)}里推进当前行动。${outline.summary}`,
        `他/她很快发现，真正的问题不只是眼前的障碍，而是${sceneEscalation(sceneNumber)}。`,
        "",
        `“${dialogueLine(sceneNumber)}”`,
        "",
        `这一幕结束时，${snapshot.storyBible?.characters[1]?.name ?? "搭档"}给出了新的线索，但同时也暴露出更大的代价。`,
        ""
      ].join("\n");
    }),
    "## 章末钩子",
    "",
    outline.hook
  ].join("\n");

  return {
    id: `chapter-${String(outline.chapterNumber ?? 1).padStart(3, "0")}`,
    title: outline.title,
    chapterNumber: outline.chapterNumber ?? 1,
    volumeNumber: outline.volumeNumber ?? 1,
    scope,
    markdown
  };
}

export function mockChapterState(snapshot: ProjectSnapshot, draft: ChapterDraft): ChapterStateDelta {
  const protagonist = snapshot.storyBible?.characters[0];
  const ally = snapshot.storyBible?.characters[1];
  return {
    chapterId: draft.id,
    chapterTitle: draft.title,
    characterStates: protagonist
      ? [
          {
            target: protagonist.name,
            before: protagonist.currentStatus,
            after: `${protagonist.currentStatus}，并在本章中获得了新的判断依据。`,
            reason: "完成一次主动试探，信息获取能力提升。"
          }
        ]
      : [],
    timelineEvents: [
      {
        id: `timeline-${draft.id}`,
        timeLabel: `第${draft.chapterNumber}章后`,
        description: `${draft.title} 的行动结束，局势进入下一阶段。`,
        relatedCharacters: [protagonist?.name ?? "主角", ally?.name ?? "搭档"],
        chapterRef: draft.id
      }
    ],
    foreshadowChanges: [
      {
        target: snapshot.storyBible?.foreshadows[0]?.clue ?? "主角身上的异常仍在扩散",
        before: "open",
        after: "open",
        reason: "本章增加了证据，但仍未揭示真相。"
      }
    ],
    relationshipChanges: ally
      ? [
          {
            target: `${protagonist?.name ?? "主角"} -> ${ally.name}`,
            before: "有限信任",
            after: "共同经历一次危机后形成更强协作",
            reason: "一起完成当前行动并共享线索。"
          }
        ]
      : [],
    locationChanges: [
      {
        target: "当前行动地点",
        before: "未知",
        after: sceneSetting((draft.chapterNumber % 3) + 1),
        reason: "本章主要冲突发生于该地点。"
      }
    ],
    openQuestions: ["真正的幕后推动者为何提前暴露部分线索？", "主角获得的新线索是否带有误导？"],
    updatedAt: nowIso()
  };
}

export function mockAudit(snapshot: ProjectSnapshot): AuditReport {
  const missingStates = snapshot.drafts.filter(
    (draft) => !snapshot.chapterStates.find((state) => state.chapterId === draft.id)
  );
  const continuityFindings = missingStates.map((draft) => ({
    severity: "blocking" as const,
    title: "章节缺少状态同步",
    detail: `${draft.title} 写完后还没有更新人物与时间线状态。`,
    chapterRef: draft.id
  }));

  const pacingFinding = snapshot.drafts.length >= 3
    ? {
        severity: "info" as const,
        title: "节奏形成稳定波峰",
        detail: "近几章保持了信息推进与局势升级并进的结构。",
        chapterRef: snapshot.drafts.at(-1)?.id
      }
    : {
        severity: "warning" as const,
        title: "样本章数偏少",
        detail: "建议至少写满 3 章后再做更可靠的节奏判断。",
        chapterRef: snapshot.drafts.at(-1)?.id
      };

  return {
    id: `audit-${nanoid(6)}`,
    projectId: snapshot.manifest.projectId,
    createdAt: nowIso(),
    continuityFindings,
    pacingFindings: [pacingFinding],
    characterFindings: [
      {
        severity: snapshot.storyBible ? "info" : "warning",
        title: snapshot.storyBible ? "人物目标已建立" : "人物卡仍为空",
        detail: snapshot.storyBible
          ? "主角与关键搭档的目标和冲突已经具备后续延展空间。"
          : "请先生成资料库，再继续审计人物逻辑。"
      }
    ],
    mainlineFindings: [
      {
        severity: "info",
        title: "主线推进存在明确压力源",
        detail: "每章都围绕核心危机的升级展开，没有脱离主线。",
        chapterRef: snapshot.drafts.at(-1)?.id
      }
    ],
    blockingIssues: continuityFindings.map((item) => item.detail),
    suggestedFixes: [
      "保持每章写完后立即更新 ChapterStateDelta。",
      "在下一章章纲中显式使用上一章新增的未解决问题。",
      "每 10 章至少补一次总审，避免中段设定漂移。"
    ]
  };
}

function volumeTitle(volumeNumber: number): string {
  const titles = ["灰烬点火", "暗潮回声", "裂缝扩张", "秩序失衡", "真相逼近", "终局转轴"];
  return titles[(volumeNumber - 1) % titles.length];
}

function volumeFocus(volumeNumber: number): string {
  const focuses = ["求生试探", "规则理解", "资源争夺", "反击布局", "真相对撞", "终局选择"];
  return focuses[(volumeNumber - 1) % focuses.length];
}

function chapterTitle(title: string, number: number): string {
  const seeds = ["雨夜来客", "静默线索", "错位情报", "门后的代价", "火线试探", "局中回声"];
  return `${title.slice(0, 4)}·${seeds[(number - 1) % seeds.length]}`;
}

function chapterBeat(number: number): string {
  const beats = ["建立危机", "误判升级", "信息反转", "关系拉近", "敌意显形", "代价落地"];
  return beats[(number - 1) % beats.length];
}

function sceneSetting(sceneNumber: number): string {
  const locations = ["潮湿的旧楼走廊", "只亮着应急灯的档案室", "临时封锁的街角", "深夜仍在运转的控制室"];
  return locations[(sceneNumber - 1) % locations.length];
}

function sceneEscalation(sceneNumber: number): string {
  const escalations = ["行动目标已经被人提前动过手脚", "搭档隐瞒的部分信息正在反噬", "敌对方并不打算按常规规则出牌", "当前的局部胜利会直接换来更大的代价"];
  return escalations[(sceneNumber - 1) % escalations.length];
}

function dialogueLine(sceneNumber: number): string {
  const lines = [
    "你现在看到的，只是别人想让你看到的那一层。",
    "如果今晚不把这件事做完，明天我们就没有第二次机会了。",
    "线索没有说谎，说谎的是解释线索的人。",
    "你以为自己在追答案，其实答案早就在追你。"
  ];
  return lines[(sceneNumber - 1) % lines.length];
}

export function buildDraftPreviewText(draft: ChapterDraft): string {
  return draft.markdown;
}

export function buildAuditPreviewText(report: AuditReport): string {
  return [
    `# 审计报告 ${report.id}`,
    "",
    "## 阻塞问题",
    ...(report.blockingIssues.length > 0 ? report.blockingIssues.map((item) => `- ${item}`) : ["- 无"]),
    "",
    "## 修复建议",
    ...report.suggestedFixes.map((item) => `- ${item}`)
  ].join("\n");
}

export function buildDraftModelSummary(draft: ChapterDraft): string {
  return excerpt(stripMarkdown(draft.markdown), 2400);
}
