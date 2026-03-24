# 番茄作家助手 —— 长篇小说创作工作台

> 一站式桌面端长篇网络小说创作工具，覆盖 **立项 → 资料库 → 卷纲/章纲 → 写作 → 状态同步 → 总审 → 导出** 全流程。

![Electron](https://img.shields.io/badge/Electron-41-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4-06B6D4?logo=tailwindcss&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

---

## ✨ 功能特性

| 功能模块              | 说明                                                             |
| --------------------- | ---------------------------------------------------------------- |
| **立项卡生成**        | 基于一句话构思自动生成核心卖点、卷数规划、主角成长曲线、主线矛盾 |
| **故事资料库**        | 自动构建世界观、角色卡、势力、关键道具、时间线、伏笔表           |
| **卷纲 / 章纲**       | 逐卷逐章生成大纲，支持因果递进和节奏波动控制                     |
| **场景 / 章节写作**   | AI 辅助生成正文草稿，支持按场景或按章写作粒度                    |
| **章节状态同步**      | 每章写完自动提取角色状态变化、时间线事件、伏笔进展               |
| **总审系统**          | 全局审计连续性、节奏、人设一致性和主线推进情况                   |
| **参考语料库**        | 导入 TXT 参考书，分析语感、对话比例、叙事偏向，辅助风格化写作    |
| **语义检索**          | 对参考语料库进行向量化检索，为生成提供上下文匹配片段             |
| **多格式导出**        | 支持导出为 Markdown / TXT / EPUB                                 |
| **候选预览**          | 每次生成产出候选版本，支持预览、重新生成、确认写回               |
| **严格流 / 自由流**   | 严格流按步骤执行，自由流允许跳步操作                             |
| **Prompt 模板可编辑** | 内置全套 Prompt 模板，可在设置中自定义调整                       |

## 🏗️ 技术架构

```
┌─────────────────────────────────────────────┐
│                  Renderer (React 19)        │
│  ┌─────────┐ ┌────────┐ ┌───────────────┐  │
│  │Dashboard│ │ Editor │ │  Outline View │  │
│  │  Cards  │ │  View  │ │  & Database   │  │
│  └────┬────┘ └───┬────┘ └──────┬────────┘  │
│       └──────────┴─────────────┘            │
│              useWorkbenchState              │
│                  (AppApi)                   │
├─────────────── IPC Bridge ──────────────────┤
│                  Main Process               │
│  ┌───────────────┐  ┌────────────────────┐  │
│  │ WorkflowService│  │  AiOrchestrator   │  │
│  │ (工作流引擎)   │  │  (AI 调度 / 解析) │  │
│  └───────┬───────┘  └────────┬───────────┘  │
│  ┌───────┴───────┐  ┌────────┴───────────┐  │
│  │ ProjectRepo   │  │  CorpusService     │  │
│  │ (项目持久化)   │  │  (语料分析/检索)   │  │
│  └───────────────┘  └────────────────────┘  │
│  ┌───────────────┐  ┌────────────────────┐  │
│  │ ExportService │  │ PreviewSession     │  │
│  │ (多格式导出)   │  │  (候选管理)       │  │
│  └───────────────┘  └────────────────────┘  │
└─────────────────────────────────────────────┘
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
│       ├── ai-orchestrator.ts    # AI 模型调度与 JSON 解析
│       ├── corpus-service.ts     # 参考语料导入、分析与检索
│       ├── export-service.ts     # Markdown/TXT/EPUB 导出
│       ├── generation-coordinator.ts # 生成任务协调器
│       ├── library-database.ts   # 本地数据库管理
│       ├── preview-session-service.ts # 候选预览会话管理
│       ├── project-repository.ts # 项目数据持久化
│       ├── workbench-service.ts  # 工作台顶层服务
│       └── workflow-service.ts   # 工作流引擎（核心）
├── renderer/                     # React 渲染进程
│   └── src/
│       ├── App.tsx
│       ├── main.tsx
│       ├── styles.css
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
    ├── types.ts                  # 全局共享类型定义
    └── defaults.ts               # 默认配置与 Prompt 模板
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

## 📝 许可证

[MIT License](LICENSE)

---

> 🍅 **番茄作家助手** —— 让长篇创作有章可循，让 AI 成为你的编辑搭档。
