# 番茄作家助手 —— 长篇小说 & 短剧创作工作台

> 一站式桌面端创作工具，覆盖 **长篇网络小说** 全流程（立项 → 资料库 → 卷纲/章纲 → 写作 → 状态同步 → 总审 → 导出）以及 **短剧 Pro** 四大高阶模块（短剧圣经 → 角色三视图 → 分镜表 → 资产导出）。

![Electron](https://img.shields.io/badge/Electron-41-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4-06B6D4?logo=tailwindcss&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

---

## ✨ 功能特性

### 📖 长篇小说模块

| 功能模块              | 说明                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------ |
| **立项卡生成**        | 基于一句话构思自动生成核心卖点、卷数规划、主角成长曲线、主线矛盾                     |
| **故事资料库**        | 自动构建世界观、角色卡、势力、关键道具、时间线、伏笔表                               |
| **卷纲 / 章纲**       | 逐卷逐章生成大纲，支持因果递进和节奏波动控制；卷纲约束每卷章数，章纲按剩余量续接生成 |
| **场景 / 章节写作**   | AI 辅助生成正文草稿，支持按场景或按章写作粒度                                        |
| **章节状态同步**      | 每章写完自动提取角色状态变化、时间线事件、伏笔进展                                   |
| **总审系统**          | 全局审计连续性、节奏、人设一致性和主线推进情况                                       |
| **参考语料库**        | 导入 TXT 参考书，分析语感、对话比例、叙事偏向，辅助风格化写作                        |
| **语义检索**          | 对参考语料库进行向量化检索，为生成提供上下文匹配片段                                 |
| **多格式导出**        | 支持导出为 Markdown / TXT / EPUB                                                     |
| **候选预览**          | 每次生成产出候选版本，支持预览、重新生成、确认保存到正式文档（章纲为续接模式）       |
| **候选版本累积**      | 重新生成时保留所有历史候选，支持多版本对比选择                                       |
| **上一章结尾衔接**    | 编辑器标题上方自动展示上一章结尾片段，帮助章节间无缝衔接写作                         |
| **大纲卷展开/收起**   | 大纲视图中各卷支持单击展开/收起，双击查看卷详情                                      |
| **严格流 / 自由流**   | 严格流按步骤执行，自由流允许跳步操作                                                 |
| **首页生成控制**      | 首页仅展示规划阶段动作（立项/资料库/卷纲/章纲），写作操作在编辑页面                  |
| **卷纲章数约束**      | 卷纲明确指定每卷 chapterCount，章纲生成自动受限于剩余量，UI 实时显示约束状态         |
| **Prompt 模板可编辑** | 内置全套 Prompt 模板，可在设置中自定义调整                                           |
| **SSE 流式传输**      | AI 调用默认启用流式传输，避免反向代理 504 网关超时                                   |
| **模型连通性测试**    | 设置页一键测试 Provider / 各角色模型 / Embedding 是否正常                            |
| **长篇记忆系统**      | 四层分层记忆（长期/中期/短期/工作层）+ MemoryPatch 变更追踪                          |

### 🎬 短剧 Pro 模块（新增）

| 功能模块                    | 说明                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------- |
| **授权码登录**              | 首次使用需输入授权码，绑定机器码实现一码一机保护                                      |
| **短剧圣经（Drama Bible）** | 世界观设定、基调风格，统一管理角色、场地、服化道、钩子/反转                           |
| **角色三视图生成器**        | 基于角色卡描述，AI 一键生成正面/侧面/背面三视图参考图（支持 DALL·E 3 等图像 API）     |
| **场地规划**                | 管理拍摄场地信息，包含名称、氛围描述、灯光备注、出现集数                              |
| **服化道管理**              | 统一管理道具、服装、化妆项目，关联角色与场次                                          |
| **反转/钩子管理**           | 逐集管理 cliffhanger、反转、reveal、伏笔的埋设与回收状态                              |
| **AI 分镜表**               | 输入剧本文本，AI 自动拆解为完整分镜表（景别、运镜、机位、画面描述、对白、音效、时长） |
| **资产打包导出**            | 一键导出为 ZIP（全资产）、PDF（纯文本设定）、PNG（三视图图片）                        |
| **AI 一键生成**             | 一键生成完整短剧圣经资料库，包括角色、场景、道具、钩子                                |

## 🏗️ 技术架构

```
┌──────────────────────────────────────────────────────┐
│                  Renderer (React 19)                 │
│  ┌─────────┐ ┌────────┐ ┌───────────────┐           │
│  │Dashboard│ │ Editor │ │  Outline View │           │
│  │  Cards  │ │  View  │ │  & Database   │           │
│  └────┬────┘ └───┬────┘ └──────┬────────┘           │
│       └──────────┴─────────────┘                     │
│              useWorkbenchState                       │
│  ┌───────────────────────────────┐                   │
│  │     DramaApp (短剧工作台)      │                   │
│  │  Bible │ Characters │ Storyboard│                  │
│  │  Locs  │  Props     │ Export    │                  │
│  └────────────┬──────────────────┘                   │
│               useDramaState                          │
│                  (AppApi)                             │
├──────────────── IPC Bridge ──────────────────────────┤
│                  Main Process                        │
│  ┌───────────────┐  ┌────────────────────┐           │
│  │ WorkflowService│  │  AiOrchestrator   │           │
│  │ (工作流引擎)   │  │  (AI 调度 / 解析) │           │
│  └───────┬───────┘  └────────┬───────────┘           │
│  ┌───────┴───────┐  ┌────────┴───────────┐           │
│  │ ProjectRepo   │  │  CorpusService     │           │
│  │ (项目持久化)   │  │  (语料分析/检索)   │           │
│  └───────────────┘  └────────────────────┘           │
│  ┌───────────────┐  ┌────────────────────┐           │
│  │ ExportService │  │ PreviewSession     │           │
│  │ (多格式导出)   │  │  (候选管理)       │           │
│  └───────────────┘  └────────────────────┘           │
│  ┌───────────────┐  ┌────────────────────┐           │
│  │StoryMemory    │  │ GenerationCoord    │           │
│  │  Service      │  │  (生成任务协调)    │           │
│  └───────────────┘  └────────────────────┘           │
│  ┌───────────────┐                                   │
│  │ ImageGeneration│  (角色三视图生成)                  │
│  │  Service      │                                   │
│  └───────────────┘                                   │
└──────────────────────────────────────────────────────┘
```

- **前端**：React 19 + TailwindCSS 4，组件位于 `src/renderer/`
- **主进程**：Electron 41 + TypeScript，服务层位于 `src/main/services/`
- **构建工具**：electron-vite + Vite 7
- **测试**：Vitest + Testing Library
- **类型系统**：全量 TypeScript，共享类型位于 `src/shared/types.ts`

## 📁 项目结构

```
src/
├── main/                         # Electron 主进程
│   ├── index.ts                  # 主入口
│   ├── ipc.ts                    # IPC 通信注册
│   ├── preload.ts                # 预加载脚本
│   └── services/
│       ├── ai-orchestrator.ts    # AI 模型调度、SSE 流式传输与 JSON 解析
│       ├── corpus-service.ts     # 参考语料导入、分析与检索
│       ├── export-service.ts     # Markdown/TXT/EPUB/短剧资产导出
│       ├── generation-coordinator.ts # 生成任务协调器（支持取消与重生成）
│       ├── image-generation-service.ts # 角色三视图图像生成（DALL·E 3 等）
│       ├── library-database.ts   # 本地数据库管理
│       ├── preview-session-service.ts # 候选预览会话管理
│       ├── project-repository.ts # 项目数据持久化
│       ├── story-memory-service.ts # 长篇记忆系统（四层分层+Patch 管理）
│       ├── workbench-service.ts  # 工作台顶层服务
│       └── workflow-service.ts   # 工作流引擎（核心）
├── renderer/                     # React 渲染进程
│   └── src/
│       ├── App.tsx               # 根组件（含授权码门控）
│       ├── main.tsx
│       ├── styles.css
│       ├── components/auth/
│       │   └── AuthPage.tsx      # 授权码登录页面（一码一机）
│       ├── components/drama/     # 短剧 Pro 模块
│       │   ├── DramaApp.tsx      # 短剧工作台根组件（7 Tab 导航）
│       │   ├── DramaBibleOverview.tsx # 短剧圣经总览
│       │   ├── DramaLocationsPanel.tsx # 场地规划面板
│       │   ├── DramaCharactersPanel.tsx # 人物卡管理 + 三视图
│       │   ├── DramaPropsPanel.tsx # 服化道管理面板
│       │   ├── DramaHooksPanel.tsx # 反转/钩子管理面板
│       │   ├── DramaStoryboardPanel.tsx # AI 分镜表面板
│       │   ├── DramaExportPanel.tsx # 资产打包导出面板
│       │   └── useDramaState.ts  # 短剧状态管理 Hook
│       └── components/workbench/
│           ├── WorkbenchApp.tsx   # 工作台根组件
│           ├── DashboardView.tsx  # 仪表盘视图
│           ├── EditorView.tsx    # 编辑器视图
│           ├── OutlineView.tsx   # 大纲视图
│           ├── DatabaseView.tsx  # 资料库视图
│           ├── SettingsView.tsx  # 设置视图
│           ├── useWorkbenchState.ts # 全局状态 Hook
│           ├── view-model.ts     # 视图模型与常量
│           └── dashboard/        # 仪表盘子组件
└── shared/
    ├── types.ts                  # 全局共享类型定义（含短剧类型）
    ├── memory-types.ts           # 长篇记忆系统类型定义
    └── defaults.ts               # 默认配置与 Prompt 模板（含短剧模板）
```

## 🚀 快速开始

### 环境要求

- **Node.js** >= 18
- **npm** >= 9

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

启动后会打开 Electron 窗口，支持热更新。

### 构建生产版本

```bash
npm run build
```

### 运行测试

```bash
npm test
```

### 类型检查

```bash
npm run typecheck
```

## 📖 工作流说明

番茄作家助手采用分阶段工作流设计，每个阶段产出特定的结构化文档：

```
立项 (initiative)
  └──▶ 资料库 (bible)
         └──▶ 卷纲 (outlining)
                └──▶ 章纲 (outlining)
                       └──▶ 写作 (drafting)
                              └──▶ 状态同步 (state-sync)
                                     └──▶ 总审 (audit)
                                            └──▶ 导出 (export)
```

- **严格流模式**：按顺序执行，前置阶段未完成时后续操作会被阻塞
- **自由流模式**：允许跳步，但会显示警告提示

## ⚙️ AI 模型配置

在设置页面中配置你的 OpenAI 兼容 API：

| 配置项               | 说明                       |
| -------------------- | -------------------------- |
| API Base URL         | 模型服务地址               |
| API Key              | 鉴权密钥                   |
| 策划模型 (Planner)   | 用于立项、资料库、大纲生成 |
| 写作模型 (Writer)    | 用于场景和章节正文生成     |
| 审计模型 (Auditor)   | 用于章节状态同步和总审     |
| 嵌入模型 (Embedding) | 用于参考书语义检索         |

每个角色可独立设置温度参数（Temperature）。

### 流式传输

AI 调用默认启用 **SSE 流式传输**（`stream: true`），可有效避免使用反向代理时因长时间等待模型响应而触发 **504 Gateway Timeout**。流式模式下，数据以增量 chunk 持续到达，保持连接活跃。

### 连通性测试

设置页面提供一键「测试连通性」功能，依次检测：

- Provider 配置（URL + Key 是否填写）
- Planner / Writer / Auditor 模型（发送极简探测请求验证可达性）
- Embedding 模型（可选，未配置时自动跳过）

相同模型名称的探测结果会自动复用，避免重复请求。

## 🧠 长篇记忆系统（Phase 2）

为解决长篇创作（20+ 章）场景下的上下文爆炸和状态累积问题，引入了独立的 **StoryMemory** 系统：

### 四层分层架构

| 层级       | 内容                                       | 更新频率     |
| ---------- | ------------------------------------------ | ------------ |
| **长期层** | 世界规则、角色基础设定、势力结构、核心道具 | 极低（跨卷） |
| **中期层** | 主线进度、关系矩阵、伏笔状态、卷级目标     | 每 3-5 章    |
| **短期层** | 最近 3-5 章详细快照、章末钩子、未解问题    | 每章         |
| **工作层** | 当前章纲、用户指令、上一场景尾段           | 每次生成     |

### MemoryPatch 变更追踪

所有记忆变更通过 `MemoryPatch → validate → confirm → apply` 管道，支持：

- 冲突检测（stale-before / entity-not-found / duplicate-update）
- 人工确认或自动应用
- 完整 patch 历史与回滚
- 从 `ChapterStateDelta` / `StoryBible` 自动提取 patch

详细设计方案见 [section2.md](section2.md)。

## 📝 许可证

[MIT License](LICENSE)

---

> 🍅 **番茄作家助手** —— 让长篇创作有章可循，让 AI 成为你的编辑搭档。
