import type {
  CreateProjectInput,
  ExportFormat,
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
      "4. 新章纲的编号应紧接已有章纲，不要重复。",
      "5. 如有参考书的结构/语感分析，请参考其节奏密度和钩子策略。",
      "请输出严格 JSON 数组，每个对象都是一个 Outlin