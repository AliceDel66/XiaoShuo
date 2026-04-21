import type {
  CreateDramaProjectInput,
  CreateProjectInput,
  DramaBible,
  DramaCategoryTemplate,
  DramaImageModelConfig,
  DramaWorkbenchSettings,
  DramaWorkflowAction,
  ExportFormat,
  GenrePreset,
  ModelProfile,
  PromptTemplateMap,
  WorkbenchSettings,
  WorkflowAction
} from "./types";

const promptTemplate = (systemTemplate: string, userTemplate: string) => ({
  systemTemplate,
  userTemplate
});

export const DEFAULT_MODEL_PROFILE: ModelProfile = {
  baseUrl: "",
  apiKey: "",
  plannerModel: "",
  writerModel: "",
  auditorModel: "",
  embeddingModel: "",
  temperaturePolicy: {
    planner: 0.4,
    writer: 0.8,
    auditor: 0.2
  }
};

export const DEFAULT_PROMPT_TEMPLATES: PromptTemplateMap = {
  "generate-project-setup": promptTemplate(
    [
      "你是一名资深中文网络小说策划编辑，擅长分析市场趋势和类型小说的核心卖点。",
      "你需要基于用户提供的一句话构思和项目元信息（类型、目标字数、卷数、结局类型），生成一份完整的立项卡。",
      "要求：",
      "1. 核心卖点必须具有可执行性，不能是空泛描述，每条卖点需指向具体的叙事策略或钩子机制。",
      "2. 卷数规划要按照起承转合的节奏分配，每卷有明确的阶段目标和升级方向。",
      "3. 主角成长曲线要可量化，从起点到终点需有清晰的能力/认知/关系变化。",
      "4. 主线矛盾必须能持续驱动至少全部卷的叙事。",
      "请输出严格 JSON，不要附带 Markdown 代码块或任何额外解释文字。"
    ].join("\n"),
    ["请完成立项卡生成。", "{{payload}}"].join("\n")
  ),
  "generate-story-bible": promptTemplate(
    [
      "你是一名专业的长篇小说世界观架构师和资料库设计师。",
      "请基于已有的立项卡和项目元信息，生成一份完整的故事资料库。",
      "要求：",
      "1. 世界观：至少包含 2 层（表层秩序 + 深层规则），每层有明确的运作逻辑和限制条件。",
      "2. 角色：主角、至少 1 名关键搭档、至少 1 名阶段反派。每个角色需有目标、冲突、弧线、秘密。角色间需形成动态张力。",
      "3. 势力：至少 2 个，需与主角形成三角博弈关系。",
      "4. 物品/关键道具：与剧情推进挂钩，不是装饰。",
      "5. 时间线：标记故事起点前的关键事件。",
      "6. 伏笔表：至少 2 条跨卷伏笔，标明埋设位置和预期揭晓时机。",
      "所有内容必须与立项卡的主线矛盾和成长曲线一致。",
      "请输出严格 JSON，不要附带 Markdown 代码块或任何额外解释文字。"
    ].join("\n"),
    ["请根据项目资料生成故事资料库。", "{{payload}}"].join("\n")
  ),
  "generate-volume-outline": promptTemplate(
    [
      "你是一名资深长篇网文分卷策划师。",
      "请基于立项卡、资料库和项目元信息，为整部小说生成分卷纲要。",
      "要求：",
      "1. 每卷必须有独立可成立的阶段目标、核心冲突、升级方向和卷末钩子。",
      "2. 卷与卷之间的依赖关系需要明确，后一卷的压力源自前一卷的遗留问题。",
      "3. 参考成熟网文的节奏模型：开局建立世界和主要角色 → 中期升级对手和赌注 → 后期收束伏笔、主线对决。",
      "4. 每卷的场景数估算需要合理（通常 20-30 个场景）。",
      "5. 每卷必须明确指定 chapterCount（该卷计划的章节总数）。请根据该卷的目标字数和平均每章 3000-5000 字来计算合理的 chapterCount，不要使用固定值。例如：若某卷目标字数 50万字、平均每章 4000 字，则 chapterCount ≈ 125。",
      "请输出严格 JSON 数组，每个对象都是一个 OutlinePacket，不要附带 Markdown 代码块或额外解释。"
    ].join("\n"),
    ["请生成完整卷纲。", "{{payload}}"].join("\n")
  ),
  "generate-chapter-outline": promptTemplate(
    [
      "你是一名精通节奏控制和读者留存的小说章节策划师。",
      "请基于卷纲、资料库、既有章纲和参考素材，为指定卷生成接下来的章纲。",
      "要求：",
      "1. 每章需有目标（推进什么信息或关系）、冲突（阻碍/反转/升级）、钩子（章末抓手）。",
      "2. 章节间要形成「推进 → 升级 → 反转 → 呼吸」的节奏波动，不能连续数章平铺。",
      "3. 场景数通常 2-4 个，每个场景承担不同的叙事功能。",
      "4. 新章纲的编号应紧接该卷已有章纲，不要重复。必须严格按照指定的生成章数生成，不多不少。",
      "5. 如有参考书的结构/语感分析，请参考其节奏密度和钩子策略。",
      "6. 如果卷纲指定了该卷的总章节数，必须在该约束内生成，确保整卷章节完整。",
      "请输出严格 JSON 数组，每个对象都是一个 OutlinePacket，不要附带 Markdown 代码块或额外解释。"
    ].join("\n"),
    ["请为指定卷生成章纲。", "{{payload}}"].join("\n")
  ),
  "write-scene": promptTemplate(
    [
      "你是一名专业的中文长篇网络小说作者，擅长用紧凑的场景推进节奏和塑造人物。",
      "请根据章纲、资料库和参考语感，写出一个完整场景的正文。",
      "写作要求：",
      "1. 开场迅速切入冲突或行动，不要大段背景铺设。如果提供了上一章/场景结尾内容，必须自然承接，保证阅读时不出现断裂感。",
      "2. 对话必须推进信息或关系，禁止无意义寒暄。每段对话后接动作、表情或心理反应。",
      "3. 描写以功能性为主：环境描写服务于氛围和暗示，动作描写服务于节奏加速。",
      "4. 场景结尾必须有钩子或悬念，吸引读者继续阅读。",
      "5. 如提供了参考书的对话比例和叙事偏向，请尽量匹配该风格。",
      "6. markdown 字段直接写正文，用 ## 标记场景标题，不要包含 YAML 或 JSON 格式。",
      "7. 角色的位置、心理、已知信息必须与上一章/场景结束时完全一致，不能凭空改变。",
      "请输出严格 JSON，不要附带 Markdown 代码块或额外解释。"
    ].join("\n"),
    ["请写一个场景草稿。", "{{payload}}"].join("\n")
  ),
  "write-chapter": promptTemplate(
    [
      "你是一名专业的中文长篇网络小说作者，擅长节奏控制、人物塑造和伏笔管理。",
      "请根据章纲、资料库、近期草稿和参考语感，写出一章完整的正文。",
      "写作要求：",
      "1. 章首需在 200 字内建立本章核心冲突或悬念。如果提供了上一章结尾内容，本章开头必须自然承接，保持时间、地点、情绪的连贯性，不能出现突兀跳跃。",
      "2. 每个场景承担不同功能：信息推进 / 关系变化 / 冲突升级 / 氛围铺垫。",
      "3. 对话占比建议 25%-40%，对话必须有信息差或情感张力，杜绝无意义对话。",
      "4. 避免上帝视角泄露悬念，保持信息差制造的紧张感。",
      "5. 章末必须有钩子：可以是新信息、新危机、角色决断或反转暗示。",
      "6. 全章字数建议 3000-5000 字（中文），节奏紧凑不灌水。",
      "7. 如提供了参考书分析，请参考其段落长度、对话比例和叙事风格。",
      "8. markdown 字段写完整章节正文，用 # 标记章节标题，## 标记场景分隔。不要包含 YAML。",
      "9. 所有角色的行为必须符合资料库中的设定，不能出现设定外的能力或信息。",
      "10. 章节衔接核心原则：上一章的钩子/悬念必须在本章前1/3得到回应；角色的物理位置、心理状态、已知信息必须与上一章结束时完全一致；如果上一章末尾有未完成的行动或对话，本章必须延续而非跳过。",
      "请输出严格 JSON，不要附带 Markdown 代码块或额外解释。"
    ].join("\n"),
    ["请写一个章节草稿。", "{{payload}}"].join("\n")
  ),
  "update-chapter-state": promptTemplate(
    [
      "你是一名精通长篇连载状态管理的编辑助手。",
      "请仔细阅读最新的章节草稿，对照资料库和上一次状态记录，精确提取本章发生的所有变化。",
      "要求：",
      "1. 角色状态：记录每个出场角色的状态变化（认知、能力、关系、情感），before/after 必须具体。",
      "2. 时间线：标记本章新增的事件节点。",
      "3. 伏笔变化：检查是否有伏笔被推进、揭晓或延迟。",
      "4. 关系变化：记录角色之间关系的具体变化。",
      "5. 地点变化：记录主要场景地点的变化。",
      "6. 未解决问题：列出本章遗留的悬念和待回答的问题。",
      "请输出严格 JSON，不要附带 Markdown 代码块或额外解释。"
    ].join("\n"),
    ["请更新章节状态。", "{{payload}}"].join("\n")
  ),
  "run-audit": promptTemplate(
    [
      "你是一名专业的长篇连载总审编辑，擅长发现连续性漏洞、节奏问题和人设崩塌。",
      "请对项目的近期章纲、草稿和状态记录进行全面审计。",
      "审计维度：",
      "1. 连续性：检查角色能力/信息是否与前文矛盾，时间线是否有缺口或冲突。",
      "2. 节奏：分析近几章是否存在连续平铺、缺乏高潮点、钩子失效等问题。",
      "3. 人设一致性：角色的行为动机是否偏离资料库设定，是否出现不合理的突然转变。",
      "4. 主线推进：核心矛盾是否在持续推进，是否有偏离主线的水章。",
      "5. 阻塞问题必须标记为 blocking，建议性问题标记为 warning 或 info。",
      "6. 每个问题需提供具体的章节引用和修复建议。",
      "请输出严格 JSON，不要附带 Markdown 代码块或额外解释。"
    ].join("\n"),
    ["请对当前项目执行总审。", "{{payload}}"].join("\n")
  ),
  "export-project": promptTemplate(
    "你是一名小说导出助手。",
    "当前导出由本地服务执行。"
  )
};

export const DEFAULT_WORKBENCH_SETTINGS: WorkbenchSettings = {
  editorPreferences: {
    autoSaveMs: 1200,
    editorWidth: 920,
    fontSize: 20,
    lineHeight: 1.9
  },
  startupPreferences: {
    reopenLastProject: true,
    lastOpenedProjectId: null
  },
  projectDefaults: {
    genre: "悬疑成长",
    targetWords: 1_000_000,
    plannedVolumes: 6,
    endingType: "阶段胜利后的开放式结局",
    workflowMode: "strict",
    defaultRootDirectory: ""
  },
  promptTemplates: DEFAULT_PROMPT_TEMPLATES,
  exportPreferences: {
    preferredFormat: "markdown",
    lastExportedFormat: null,
    lastExportedPath: "",
    lastExportedAt: null
  }
};

export function createProjectInputFromDefaults(): CreateProjectInput {
  return {
    title: "",
    premise: "",
    genre: DEFAULT_WORKBENCH_SETTINGS.projectDefaults.genre,
    targetWords: DEFAULT_WORKBENCH_SETTINGS.projectDefaults.targetWords,
    plannedVolumes: DEFAULT_WORKBENCH_SETTINGS.projectDefaults.plannedVolumes,
    endingType: DEFAULT_WORKBENCH_SETTINGS.projectDefaults.endingType,
    workflowMode: DEFAULT_WORKBENCH_SETTINGS.projectDefaults.workflowMode,
    rootDirectory: DEFAULT_WORKBENCH_SETTINGS.projectDefaults.defaultRootDirectory || undefined
  };
}

export const WORKFLOW_ACTION_LABELS: Record<WorkflowAction, string> = {
  "generate-project-setup": "生成立项",
  "generate-story-bible": "生成资料库",
  "generate-volume-outline": "生成卷纲",
  "generate-chapter-outline": "生成章纲",
  "write-scene": "写场景",
  "write-chapter": "写章节",
  "update-chapter-state": "同步章节状态",
  "run-audit": "运行总审",
  "export-project": "导出项目"
};

export const EXPORT_FORMAT_LABELS: Record<ExportFormat, string> = {
  markdown: "Markdown",
  txt: "TXT",
  epub: "EPUB"
};

/* ───────────────────────────────────────────────────
 * 9 种类型预设 — 基于知名网文写作手法提炼
 * ─────────────────────────────────────────────────── */

export const DEFAULT_GENRE_PRESETS: GenrePreset[] = [
  /* ① 都市小说 ──────────────────────────────────── */
  {
    id: "urban",
    label: "都市小说",
    description:
      "以现代都市为背景，融合职场、商战、异能等元素，强调信息差与认知翻转驱动悬念。",
    defaults: {
      genre: "都市小说",
      targetWords: 1_500_000,
      plannedVolumes: 6,
      endingType: "阶段胜利后的开放式结局"
    },
    premiseGuidelines: [
      "【都市类型策略】",
      "1. 卖点应聚焦「普通人卷入非日常事件」的反差张力，核心钩子是日常→异常的渐变侵蚀。",
      "2. 主角初始身份宜设定为普通都市人（白领/学生/小商贩），让读者有代入感。",
      "3. 成长曲线围绕\"认知升级\"设计：从不知情→半知情→掌握真相→参与博弈→主导格局。",
      "4. 卷规划以\"圈层扩大\"为骨架：个人危机→公司/学校→城市→国家/世界，每卷赌注递增。",
      "5. 核心矛盾应兼顾\"外部势力威胁\"与\"内部人际关系裂痕\"双线驱动。"
    ]
  },
  /* ② 玄幻小说 ──────────────────────────────────── */
  {
    id: "xuanhuan",
    label: "玄幻小说",
    description:
      "以东方修炼体系为核心，包含功法境界、宗门势力、天材地宝等元素，核心驱动力为实力进阶与秘境探索。",
    defaults: {
      genre: "玄幻小说",
      targetWords: 3_000_000,
      plannedVolumes: 10,
      endingType: "登峰封神式终极胜利"
    },
    premiseGuidelines: [
      "【玄幻类型策略】",
      "1. 必须设计清晰的修炼境界体系（至少6级），每级附带可感知的能力跃迁。",
      "2. 主角需有独特的金手指/传承，但要有限制条件（代价、冷却、副作用）。",
      "3. 宗门/势力架构以\"金字塔\"模型设计：底层散修→小宗门→大世家→超级势力→远古存在。",
      "4. 每卷应围绕一个\"地图\"/秘境展开，通过空间转移自然提升对手等级。",
      "5. 伏笔以\"身世之谜\"和\"远古秘辛\"两条暗线贯穿，交替揭晓维持长期期待。"
    ]
  },
  /* ③ 仙侠小说 ──────────────────────────────────── */
  {
    id: "xianxia",
    label: "仙侠小说",
    description:
      "融合道法、天劫、飞升等仙道元素，强调求道之心与天道规则的博弈，注重角色的心境成长。",
    defaults: {
      genre: "仙侠小说",
      targetWords: 2_500_000,
      plannedVolumes: 8,
      endingType: "飞升/证道式开放结局"
    },
    premiseGuidelines: [
      "【仙侠类型策略】",
      "1. 修炼体系融入\"道\"的哲学：练气→筑基→金丹→元婴→化神→渡劫→飞升，每级对应心境突破。",
      "2. 核心矛盾应融入\"天道与人道\"的对立——遵天道则失自我，逆天道则遭天劫。",
      "3. 主角的成长曲线不只是实力提升，更应体现\"道心\"的磨砺与坚定。",
      "4. 势力格局采用\"仙凡分界\"模式：凡间→修真界→仙界→更高位面。",
      "5. 情感线以\"千年之约\"或\"道侣双修\"为钩子，强调缘与执念的碰撞。"
    ]
  },
  /* ④ 悬疑/推理小说 ──────────────────────────────── */
  {
    id: "mystery",
    label: "悬疑推理",
    description:
      "以案件或谜题为核心驱动，讲究线索布局与逻辑推理，强调读者与主角同步解谜的参与感。",
    defaults: {
      genre: "悬疑推理",
      targetWords: 1_000_000,
      plannedVolumes: 6,
      endingType: "真相大白式终局"
    },
    premiseGuidelines: [
      "【悬疑推理类型策略】",
      "1. 必须遵循\"公平推理\"原则：所有关键线索在揭晓前已呈现给读者。",
      "2. 叙事结构采用\"洋葱剥层\"模式：每解一谜必引出更深一层的谜团。",
      "3. 嫌疑人设计遵循\"三三制\"：1/3 明显嫌疑（障眼法）、1/3 隐藏嫌疑、1/3 意外关联。",
      "4. 主角的推理能力应有独特的方法论（如犯罪心理画像/物证微表情等）。",
      "5. 每卷的案件应独立可成立，同时通过暗线连接主线阴谋。"
    ]
  },
  /* ⑤ 科幻小说 ──────────────────────────────────── */
  {
    id: "scifi",
    label: "科幻小说",
    description:
      "以科技设定或未来世界观为核心，探讨科技与人性的关系，包含星际、末日、赛博朋克等子类型。",
    defaults: {
      genre: "科幻小说",
      targetWords: 1_500_000,
      plannedVolumes: 6,
      endingType: "开放式哲理结局"
    },
    premiseGuidelines: [
      "【科幻类型策略】",
      "1. 核心科技设定必须自洽：选定1-2个核心黑科技，围绕其建立世界规则。",
      "2. 科技应服务于人性冲突：每个科技突破都应引发新的道德困境。",
      "3. 世界观采用\"层级发现\"模式：局部→星球→星系→文明→宇宙规则。",
      "4. 主角的成长线围绕\"认知边界突破\"：从技术使用者→原理理解者→规则改写者。",
      "5. 反派应代表\"科技的另一种可能\"，与主角形成路线之争而非简单善恶对立。"
    ]
  },
  /* ⑥ 历史/架空历史 ──────────────────────────────── */
  {
    id: "historical",
    label: "历史架空",
    description:
      "以真实历史或架空王朝为背景，融合权谋、军事、变革等元素，核心在于历史逻辑的合理推演。",
    defaults: {
      genre: "历史架空",
      targetWords: 2_000_000,
      plannedVolumes: 8,
      endingType: "王朝兴替式终局"
    },
    premiseGuidelines: [
      "【历史架空类型策略】",
      "1. 选定关键历史节点作为故事起点，主角介入后形成\"蝴蝶效应\"式连锁反应。",
      "2. 权谋博弈采用\"棋局\"模式：明棋（军事）、暗棋（间谍）、活棋（外交）三线交织。",
      "3. 主角的现代知识应有边界限制——不能无所不知，要有信息获取和应用的过程。",
      "4. 势力格局应体现\"三角制衡\"——至少三方势力互相牵制，避免简单二元对立。",
      "5. 每卷以\"一场关键战役/政变\"为支点，串联前因后果。"
    ]
  },
  /* ⑦ 游戏/系统流 ──────────────────────────────── */
  {
    id: "game-system",
    label: "游戏系统流",
    description:
      "主角获得游戏系统/面板，通过完成任务、升级属性、获取技能在现实或异世界中成长。",
    defaults: {
      genre: "游戏系统流",
      targetWords: 2_000_000,
      plannedVolumes: 8,
      endingType: "终极真相揭晓式结局"
    },
    premiseGuidelines: [
      "【游戏系统流策略】",
      "1. 系统规则第一卷必须交代清楚：属性面板、技能树、任务机制、升级曲线。",
      "2. 系统应有\"隐藏机制\"——读者和主角同步发现系统深层规则，制造发现式爽感。",
      "3. 任务设计遵循\"推拉节奏\"：主线任务推动剧情，支线任务提供升级资源。",
      "4. 每卷应引入新的系统功能/解锁新面板，避免玩法单一化。",
      "5. 系统背后应有更深层的秘密——\"谁创造了系统？目的是什么？\"作为长线悬念。"
    ]
  },
  /* ⑧ 末日/废土 ──────────────────────────────────── */
  {
    id: "apocalypse",
    label: "末日废土",
    description:
      "文明崩塌后的生存求索，融合变异、资源争夺、据点建设等元素，核心在于极端环境下的人性考验。",
    defaults: {
      genre: "末日废土",
      targetWords: 1_500_000,
      plannedVolumes: 6,
      endingType: "重建希望式结局"
    },
    premiseGuidelines: [
      "【末日废土策略】",
      "1. 灾难设定需明确且自洽：是什么导致末日？残余规则是什么？变异/异化的逻辑？",
      "2. 生存压力是核心驱动力：食物/水/药品/弹药的稀缺性必须贯穿始终。",
      "3. 势力格局以\"据点\"为单位：流浪→小据点→城镇→城市联盟，主角的影响力逐步扩大。",
      "4. 人性考验是深层主题：每卷应设置一个\"电车难题\"式的道德抉择。",
      "5. 末日真相应作为暗线推进——灾难不是终点，而是某种更大计划的一部分。"
    ]
  },
  /* ⑨ 悬疑成长 ──────────────────────────────────── */
  {
    id: "suspense-growth",
    label: "悬疑成长",
    description:
      "将悬疑解谜与主角能力成长相融合，每解一案主角获得新认知或能力，强调智力博弈与成长双线并进。",
    defaults: {
      genre: "悬疑成长",
      targetWords: 1_000_000,
      plannedVolumes: 6,
      endingType: "阶段胜利后的开放式结局"
    },
    premiseGuidelines: [
      "【悬疑成长类型策略】",
      "1. 卖点应聚焦「普通人卷入非日常事件」的反差张力，核心钩子是日常→异常的渐变侵蚀。",
      "2. 主角每次解谜后应获得可量化的「成长」——新能力/新认知/新人脉/新资源。",
      "3. 成长曲线围绕\"认知升级\"设计：从不知情→半知情→掌握真相→参与博弈→主导格局。",
      "4. 悬念层级递进：单集悬念（1章）→短期悬念（1卷）→长期悬念（全书暗线）。",
      "5. 核心矛盾应兼顾\"外部势力威胁\"与\"内部人际关系裂痕\"双线驱动。"
    ]
  }
];

// ───────────────────────────────────────
//  短剧 (Drama) 默认配置
// ───────────────────────────────────────

export const EMPTY_DRAMA_BIBLE: DramaBible = {
  locations: [],
  propsCostumes: [],
  characters: [],
  hooks: [],
  worldSetting: "",
  toneStyle: ""
};

export const DRAMA_WORKFLOW_ACTION_LABELS: Record<DramaWorkflowAction, string> = {
  "generate-drama-setup": "生成短剧立项",
  "generate-drama-bible": "生成剧本资料库",
  "generate-drama-episode-outline": "生成分集大纲",
  "write-drama-scene": "写剧本场景",
  "generate-storyboard": "生成分镜表",
  "generate-character-three-view": "生成人物三视图"
};

export const DRAMA_PROMPT_TEMPLATES: Record<DramaWorkflowAction, { systemTemplate: string; userTemplate: string }> = {
  "generate-drama-setup": promptTemplate(
    [
      "你是一名资深短剧策划编辑，擅长分析短视频平台爆款短剧的核心钩子和节奏模型。",
      "你需要基于用户提供的一句话构思和项目元信息（类型、集数、单集时长），生成一份完整的短剧立项卡。",
      "要求：",
      "1. 核心钩子必须在前3秒抓住观众（悬念/冲突/反转预告）。",
      "2. 每集必须有至少一个反转或情绪高潮点。",
      "3. 整剧要有清晰的「起承转合」节奏弧线。",
      "4. 需考虑短剧的竖屏拍摄特性和观众注意力特点。",
      "请输出严格 JSON，不要附带 Markdown 代码块或任何额外解释文字。"
    ].join("\n"),
    ["请完成短剧立项卡生成。", "{{payload}}"].join("\n")
  ),
  "generate-drama-bible": promptTemplate(
    [
      "你是一名专业的短剧世界观架构师和剧本资料库设计师。",
      "请基于已有的短剧立项卡，生成一份完整的剧本资料库（Drama Bible）。",
      "必须包含以下维度：",
      "1. 场地规划（Locations）：每个场景的氛围、灯光建议、出现集数。",
      "2. 服化道设定（Props & Costumes）：关键道具和服装设定，标明使用场景。",
      "3. 核心人物卡：包含性格、口头禅、服装风格、外貌特征、目标、冲突、弧线。",
      "4. 反转/钩子清单（Hooks）：每集的反转点和钩子设计，标明类型和状态。",
      "5. 世界观设定和基调风格描述。",
      "请输出严格 JSON，不要附带 Markdown 代码块或任何额外解释文字。"
    ].join("\n"),
    ["请根据项目资料生成短剧资料库。", "{{payload}}"].join("\n")
  ),
  "generate-drama-episode-outline": promptTemplate(
    [
      "你是一名资深短剧分集策划师，精通短剧的节奏控制和观众留存。",
      "请基于剧本资料库和项目设定，为短剧生成分集大纲。",
      "要求：",
      "1. 每集必须有明确的核心冲突、情绪弧线和结尾钩子。",
      "2. 前3集必须建立世界、角色和核心矛盾。",
      "3. 中间集数需持续升级对手和赌注。",
      "4. 结局集需收束所有伏笔。",
      "5. 每集时长控制在2-5分钟的叙事量。",
      "请输出严格 JSON 数组，不要附带 Markdown 代码块或额外解释。"
    ].join("\n"),
    ["请生成短剧分集大纲。", "{{payload}}"].join("\n")
  ),
  "write-drama-scene": promptTemplate(
    [
      "你是一名专业的短剧编剧，擅长写紧凑高效的短剧剧本。",
      "请根据分集大纲和资料库，写出一集完整的剧本场景。",
      "格式要求：",
      "1. 使用标准剧本格式：场景标题（INT./EXT. 地点 - 时间）。",
      "2. 角色对话标注角色名。",
      "3. 动作/表情/镜头提示用括号标注。",
      "4. 每个场景开头标注景别建议。",
      "5. 对话必须简洁有力，每句不超过15字。",
      "6. 结尾必须有反转或悬念钩子。",
      "请输出严格 JSON，不要附带 Markdown 代码块或额外解释。"
    ].join("\n"),
    ["请写一集短剧剧本。", "{{payload}}"].join("\n")
  ),
  "generate-storyboard": promptTemplate(
    [
      "你是一名专业的短剧分镜师，擅长将剧本文本转化为拍摄可用的分镜表。",
      "请将提供的剧本文本拆解为详细的分镜镜头表。",
      "每个镜头需包含：",
      "1. 景别：远景(extreme-wide)/全景(wide)/中景(medium)/近景(close)/特写(extreme-close)",
      "2. 运镜方式：推(push)/拉(pull)/摇(pan)/移(tilt)/跟(track)/升降(crane)/固定(static)/手持(handheld)",
      "3. 机位角度：平视/俯视/仰视/斜角等",
      "4. 画面描述：具体的视觉内容",
      "5. 对白内容",
      "6. 动作指示",
      "7. 音效/BGM 提示",
      "8. 预估时长",
      "请输出严格 JSON，不要附带 Markdown 代码块或额外解释。"
    ].join("\n"),
    ["请将剧本拆解为分镜表。", "{{payload}}"].join("\n")
  ),
  "generate-character-three-view": promptTemplate(
    [
      "你是一名专业的角色设计师，请根据人物设定生成人物的三视图描述Prompt。",
      "需要为文生图模型提供精确的外貌描述，确保三视图风格一致。"
    ].join("\n"),
    ["角色设定：{{payload}}"].join("\n")
  )
};

// ───────────────────────────────────────
//  短剧类别模板
// ───────────────────────────────────────

export const DRAMA_CATEGORY_TEMPLATES: DramaCategoryTemplate[] = [
  {
    category: "霸总",
    label: "霸道总裁",
    description: "强势男主 × 倔强女主，身份悬殊、契约关系、先婚后爱",
    defaultEpisodes: 80,
    defaultEpisodeDuration: "1-2分钟",
    samplePremise: "落魄千金为救父被迫嫁给冷面总裁，却发现他竟是当年救过自己的少年",
    typicalHooks: ["身份反转", "契约到期抉择", "前任搅局", "隐藏身世揭晓"]
  },
  {
    category: "穿越",
    label: "穿越",
    description: "现代人穿越到古代/异世，利用现代知识逆袭翻盘",
    defaultEpisodes: 80,
    defaultEpisodeDuration: "1-2分钟",
    samplePremise: "外卖小哥意外穿越成亡国太子，靠现代商业思维重建帝国",
    typicalHooks: ["身份暴露危机", "现代物品引发轰动", "蝴蝶效应改变历史", "回到现代的抉择"]
  },
  {
    category: "重生",
    label: "重生复仇",
    description: "主角重生回到关键时间点，逆转命运、复仇翻盘",
    defaultEpisodes: 100,
    defaultEpisodeDuration: "1-2分钟",
    samplePremise: "被丈夫和闺蜜联手害死的女CEO重生回到婚前，这次她要让所有人付出代价",
    typicalHooks: ["预知未来精准打击", "前世仇人的怀疑", "命运线偏移", "终极真相揭晓"]
  },
  {
    category: "战神",
    label: "战神归来",
    description: "隐藏身份的绝世强者回归都市，打脸装逼一路碾压",
    defaultEpisodes: 100,
    defaultEpisodeDuration: "1-2分钟",
    samplePremise: "五年前被赶出家族的废物少爷，如今以全球最强战神身份回归",
    typicalHooks: ["身份逐步揭晓", "打脸反派", "旧情人重逢", "终极boss登场"]
  },
  {
    category: "甜宠",
    label: "甜蜜宠爱",
    description: "高甜低虐，男主宠女主上天，重点在甜蜜互动和撒糖",
    defaultEpisodes: 60,
    defaultEpisodeDuration: "1-2分钟",
    samplePremise: "假结婚变真恋爱，高冷男神每天变着法宠妻",
    typicalHooks: ["误会造成分离危机", "吃醋名场面", "公开恋情", "双向暗恋揭晓"]
  },
  {
    category: "虐恋",
    label: "虐心恋爱",
    description: "深爱却不能在一起，误解、牺牲、错过构成情感张力",
    defaultEpisodes: 80,
    defaultEpisodeDuration: "1-2分钟",
    samplePremise: "他以为她背叛了自己，却不知她是为了救他才离开",
    typicalHooks: ["真相即将揭晓时被打断", "为对方牺牲", "第三者误导", "终极和解"]
  },
  {
    category: "悬疑",
    label: "悬疑推理",
    description: "层层反转的悬疑故事，真凶难猜，每集都有新线索",
    defaultEpisodes: 60,
    defaultEpisodeDuration: "2-3分钟",
    samplePremise: "密室中六人醒来，每小时淘汰一人，唯一的线索是彼此的秘密",
    typicalHooks: ["新证据推翻旧推理", "嫌疑人被害", "双重身份揭露", "最终反转"]
  },
  {
    category: "宫斗",
    label: "宫廷权谋",
    description: "后宫/朝堂权谋博弈，步步为营、智斗升级",
    defaultEpisodes: 100,
    defaultEpisodeDuration: "1-2分钟",
    samplePremise: "入宫为婢的将军之女，用智谋一步步走上权力巅峰",
    typicalHooks: ["计中计反转", "盟友背叛", "新势力入局", "终极对决"]
  },
  {
    category: "都市逆袭",
    label: "都市逆袭",
    description: "小人物在都市中从被看不起到逆袭翻盘的爽文路线",
    defaultEpisodes: 80,
    defaultEpisodeDuration: "1-2分钟",
    samplePremise: "被公司开除的小职员，意外获得神秘系统，从此商界封神",
    typicalHooks: ["实力碾压打脸", "隐藏金手指升级", "旧识震惊", "终极商战"]
  },
  {
    category: "复仇",
    label: "复仇逆袭",
    description: "主角遭受重大冤屈后精心策划复仇，一步步扳倒仇人",
    defaultEpisodes: 80,
    defaultEpisodeDuration: "1-2分钟",
    samplePremise: "被陷害入狱十年的天才医生出狱，用精妙计划让仇人跪地求饶",
    typicalHooks: ["复仇计划被识破", "意外同盟", "仇人反击", "最终审判"]
  },
  {
    category: "赘婿",
    label: "赘婿逆袭",
    description: "上门女婿被全家看不起，实则身份尊贵实力惊人",
    defaultEpisodes: 100,
    defaultEpisodeDuration: "1-2分钟",
    samplePremise: "三年赘婿受尽屈辱，当他亮出真实身份，所有人都跪了",
    typicalHooks: ["身份线索泄露", "打脸岳家人", "真实势力出手", "终极身份曝光"]
  },
  {
    category: "闪婚",
    label: "闪婚惊喜",
    description: "闪婚后发现对方隐藏身份，从排斥到真爱的过程",
    defaultEpisodes: 60,
    defaultEpisodeDuration: "1-2分钟",
    samplePremise: "相亲闪婚的平凡丈夫，竟是隐藏的千亿财阀继承人",
    typicalHooks: ["身份差距冲击", "前任纠缠", "家族考验", "真心告白"]
  },
  {
    category: "萌宝",
    label: "萌宝助攻",
    description: "可爱萌娃撮合父母，萌宝是推动剧情的关键人物",
    defaultEpisodes: 60,
    defaultEpisodeDuration: "1-2分钟",
    samplePremise: "天才萌宝在线找爹，帮单亲妈妈锁定高冷总裁亲爹",
    typicalHooks: ["萌宝认亲名场面", "萌宝神助攻", "亲子鉴定风波", "一家团圆"]
  },
  {
    category: "其他",
    label: "自定义类型",
    description: "不属于以上类别的短剧类型，自由发挥",
    defaultEpisodes: 60,
    defaultEpisodeDuration: "1-2分钟",
    samplePremise: "",
    typicalHooks: []
  }
];

// ───────────────────────────────────────
//  短剧独立项目默认设置
// ───────────────────────────────────────

/** 短剧独立的大语言模型默认配置（与小说版块完全分离，支持独立填写 API 凭证与模型名） */
export const DEFAULT_DRAMA_MODEL_PROFILE: ModelProfile = {
  baseUrl: "",
  apiKey: "",
  plannerModel: "",
  writerModel: "",
  auditorModel: "",
  embeddingModel: "",
  temperaturePolicy: {
    planner: 0.5,
    writer: 0.85,
    auditor: 0.3
  }
};

/** 短剧人物三视图文生图模型默认配置 */
export const DEFAULT_DRAMA_IMAGE_MODEL_CONFIG: DramaImageModelConfig = {
  apiUrl: "",
  apiKey: "",
  model: "",
  size: "1024x1024"
};

export const DEFAULT_DRAMA_WORKBENCH_SETTINGS: DramaWorkbenchSettings = {
  startupPreferences: {
    reopenLastProject: true,
    lastOpenedProjectId: null
  },
  projectDefaults: {
    category: "霸总",
    totalEpisodes: 80,
    episodeDuration: "1-2分钟",
    toneStyle: "紧凑爽感",
    targetAudience: "18-35岁女性",
    defaultRootDirectory: ""
  },
  promptTemplates: DRAMA_PROMPT_TEMPLATES,
  modelProfile: DEFAULT_DRAMA_MODEL_PROFILE,
  imageModelProfile: DEFAULT_DRAMA_IMAGE_MODEL_CONFIG
};

export function createDramaProjectInputFromDefaults(): CreateDramaProjectInput {
  const d = DEFAULT_DRAMA_WORKBENCH_SETTINGS.projectDefaults;
  return {
    title: "",
    premise: "",
    category: d.category,
    totalEpisodes: d.totalEpisodes,
    episodeDuration: d.episodeDuration,
    toneStyle: d.toneStyle,
    targetAudience: d.targetAudience,
    rootDirectory: d.defaultRootDirectory || undefined
  };
}
