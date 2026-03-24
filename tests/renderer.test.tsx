// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkbenchApp } from "../src/renderer/src/components/workbench/WorkbenchApp";
import { DEFAULT_MODEL_PROFILE, DEFAULT_WORKBENCH_SETTINGS } from "../src/shared/defaults";
import type {
  AppApi,
  ArtifactEditorDocument,
  DashboardData,
  OutlinePacket,
  PreviewSession,
  ProjectManifest,
  ProjectSnapshot
} from "../src/shared/types";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("WorkbenchApp renderer", () => {
  it("switches across all five views and still triggers dashboard workflows", async () => {
    const snapshot = createSnapshot();
    const api = createApi(snapshot);

    render(<WorkbenchApp api={api} />);

    await screen.findByText("创建小说项目");
    fireEvent.click(screen.getByTitle("沉浸写作"));
    expect(await screen.findByText(snapshot.manifest.title)).toBeInTheDocument();

    fireEvent.click(screen.getByTitle("大纲与时间轴"));
    expect(await screen.findByText("大纲结构")).toBeInTheDocument();

    fireEvent.click(screen.getByTitle("资料库"));
    expect(await screen.findByPlaceholderText("检索设定库...")).toBeInTheDocument();

    fireEvent.click(screen.getByTitle("设置"));
    expect(await screen.findByText("首选项")).toBeInTheDocument();

    fireEvent.click(screen.getByTitle("连载控制台"));
    const writeChapterButton = await screen.findByRole("button", { name: "写章节" });
    fireEvent.click(writeChapterButton);

    await waitFor(() => {
      expect(api.startGeneration).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: snapshot.manifest.projectId,
          action: "write-chapter"
        })
      );
    });
  });

  it("loads the current draft in editor view and auto-saves debounced edits", async () => {
    const snapshot = createSnapshot();
    const api = createApi(snapshot, { autoSaveMs: 20 });

    render(<WorkbenchApp api={api} />);

    fireEvent.click(screen.getByTitle("沉浸写作"));
    const titleInput = await screen.findByDisplayValue("第一章：坠落");
    const bodyInput = screen.getByDisplayValue("空气中弥漫着刺鼻的臭氧味。") as HTMLTextAreaElement;

    fireEvent.change(titleInput, { target: { value: "第一章：改写" } });
    fireEvent.change(bodyInput, { target: { value: "新的正文内容" } });

    await waitFor(() => {
      expect(api.saveArtifactEdits).toHaveBeenCalledWith(
        expect.objectContaining({
          displayTitle: "第一章：改写",
          rawText: "新的正文内容"
        })
      );
    });
  });

  it("falls back to chapter outline when no draft exists", async () => {
    const snapshot = createSnapshot({ withDraft: false });
    const api = createApi(snapshot);

    render(<WorkbenchApp api={api} />);

    fireEvent.click(screen.getByTitle("沉浸写作"));
    expect(await screen.findByText("生成本章草稿")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "生成本章草稿" }));
    await waitFor(() => {
      expect(api.startGeneration).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "write-chapter",
          chapterNumber: 1,
          volumeNumber: 1
        })
      );
    });
  });
});

function createApi(
  snapshot: ProjectSnapshot,
  options: { autoSaveMs?: number } = {}
): AppApi & {
  startGeneration: ReturnType<typeof vi.fn>;
  saveArtifactEdits: ReturnType<typeof vi.fn>;
} {
  const dashboardData: DashboardData = {
    modelProfile: DEFAULT_MODEL_PROFILE,
    settings: {
      ...DEFAULT_WORKBENCH_SETTINGS,
      editorPreferences: {
        ...DEFAULT_WORKBENCH_SETTINGS.editorPreferences,
        autoSaveMs: options.autoSaveMs ?? DEFAULT_WORKBENCH_SETTINGS.editorPreferences.autoSaveMs
      }
    },
    projects: [snapshot.manifest],
    archivedProjects: [],
    corpora: [],
    selectedProject: snapshot,
    activeJob: null,
    activePreviewSession: null
  };

  const openArtifactEditor = vi.fn(async (artifactRef) => createDocument(snapshot, artifactRef.artifactType));
  const saveArtifactEdits = vi.fn(async (document: ArtifactEditorDocument) => {
    if (document.artifactRef.artifactType === "draft") {
      return {
        ...snapshot,
        drafts: snapshot.drafts.map((draft) =>
          draft.id === document.artifactRef.artifactId
            ? {
                ...draft,
                title: document.displayTitle,
                markdown: document.rawText
              }
            : draft
        )
      };
    }
    return snapshot;
  });

  return {
    getDashboardData: vi.fn(async () => dashboardData),
    saveModelProfile: vi.fn(async (profile) => profile),
    saveWorkbenchSettings: vi.fn(async (settings) => settings),
    createProject: vi.fn(async () => snapshot),
    getProject: vi.fn(async () => snapshot),
    archiveProject: vi.fn(async () => dashboardData),
    restoreProject: vi.fn(async () => dashboardData),
    importCorpus: vi.fn(async () => {
      throw new Error("not needed");
    }),
    searchCorpus: vi.fn(async () => []),
    exportProject: vi.fn(async () => "F:/exports/mock.md"),
    pickCorpusFile: vi.fn(async () => null),
    startGeneration: vi.fn(async () => ({ jobId: "job-1", sessionId: "session-1" })),
    subscribeGenerationEvents: vi.fn(() => () => {}),
    getPreviewSession: vi.fn(async () => emptySession(snapshot.manifest.projectId)),
    regenerateCandidate: vi.fn(async () => ({ jobId: "job-2" })),
    confirmCandidate: vi.fn(async () => snapshot),
    discardPreviewSession: vi.fn(async () => undefined),
    openArtifactEditor,
    saveArtifactEdits,
    executeWorkflow: vi.fn(async () => {
      throw new Error("not needed");
    })
  };
}

function createSnapshot({ withDraft = true }: { withDraft?: boolean } = {}): ProjectSnapshot {
  const manifest: ProjectManifest = {
    projectId: "project-1",
    title: "星界边境：尘埃与光",
    premise: "主角在废墟中触碰晶体后，记忆和现实开始错位。",
    genre: "科幻悬疑",
    targetWords: 500000,
    plannedVolumes: 3,
    endingType: "开放式结局",
    workflowMode: "strict",
    currentStage: "drafting",
    currentChapter: "chapter-001",
    rootPath: "F:/mock-project",
    createdAt: "2026-03-20T00:00:00.000Z",
    updatedAt: "2026-03-24T00:00:00.000Z",
    archivedAt: null
  };

  const chapterOutline: OutlinePacket = {
    id: "volume-01-chapter-001",
    level: "chapter",
    title: "第一章：坠落",
    summary: "主角在废墟巡逻时发现异常晶体。",
    goal: "建立危机和世界观",
    conflict: "他必须在被追兵发现前带走晶体。",
    hook: "晶体开始与左臂共振。",
    sceneCount: 6,
    dependencies: [],
    references: [],
    children: [],
    chapterNumber: 1,
    volumeNumber: 1
  };

  const volumeOutline: OutlinePacket = {
    id: "volume-01",
    level: "volume",
    title: "第一卷：陨星之夜",
    summary: "围绕异常晶体展开第一阶段冲突。",
    goal: "建立主线危机",
    conflict: "主角在多个势力夹击中寻找答案。",
    hook: "更大的文明真相正在靠近。",
    sceneCount: 24,
    dependencies: [],
    references: [],
    children: [chapterOutline.id],
    volumeNumber: 1
  };

  return {
    manifest,
    premiseCard: null,
    storyBible: {
      world: [{ title: "黑流城", summary: "建立在地下暗河上的聚居地。", rules: ["上层由财阀控制"] }],
      characters: [
        {
          id: "char-1",
          name: "林克",
          role: "主角",
          goal: "活下去并搞清晶体来源",
          conflict: "能力失控正在侵蚀身体",
          arc: "从谨慎求生到主动破局",
          secrets: ["晶体与他失去的过去有关"],
          currentStatus: "刚刚被晶体选中"
        }
      ],
      factions: [],
      items: [],
      timeline: [],
      foreshadows: []
    },
    outlines: [volumeOutline, chapterOutline],
    drafts: withDraft
      ? [
          {
            id: "chapter-001",
            title: "第一章：坠落",
            chapterNumber: 1,
            volumeNumber: 1,
            scope: "chapter",
            markdown: "空气中弥漫着刺鼻的臭氧味。",
            createdAt: "2026-03-24T00:00:00.000Z",
            updatedAt: "2026-03-24T00:00:00.000Z"
          }
        ]
      : [],
    chapterStates: [],
    audits: [],
    unresolvedWarnings: []
  };
}

function createDocument(snapshot: ProjectSnapshot, artifactType: "draft" | "story-bible" | "volume-outline" | "chapter-outline") {
  if (artifactType === "draft") {
    const draft = snapshot.drafts[0]!;
    return {
      artifactRef: {
        artifactType: "draft",
        artifactId: draft.id,
        projectId: snapshot.manifest.projectId
      },
      mode: "form",
      displayTitle: draft.title,
      format: "markdown",
      rawText: draft.markdown,
      structuredPayload: {
        title: draft.title,
        chapterNumber: draft.chapterNumber,
        volumeNumber: draft.volumeNumber,
        scope: draft.scope
      },
      isDirty: false
    } satisfies ArtifactEditorDocument;
  }

  return {
    artifactRef: {
      artifactType,
      artifactId: artifactType,
      projectId: snapshot.manifest.projectId
    },
    mode: "form",
    displayTitle: artifactType,
    format: "yaml",
    rawText: "",
    structuredPayload:
      artifactType === "story-bible"
        ? snapshot.storyBible
        : snapshot.outlines.filter((outline) => (artifactType === "volume-outline" ? outline.level === "volume" : outline.level === "chapter")),
    isDirty: false
  } satisfies ArtifactEditorDocument;
}

function emptySession(projectId: string): PreviewSession {
  return {
    sessionId: "session-1",
    projectId,
    action: "write-chapter",
    artifactRef: {
      artifactType: "draft",
      artifactId: "chapter-001",
      projectId
    },
    request: {
      projectId,
      action: "write-chapter",
      volumeNumber: 1,
      chapterNumber: 1,
      scope: "chapter"
    },
    status: "candidate-ready",
    warnings: [],
    candidates: [],
    selectedCandidateId: null,
    trace: [],
    promptTrace: null,
    createdAt: "2026-03-24T00:00:00.000Z",
    updatedAt: "2026-03-24T00:00:00.000Z"
  };
}
