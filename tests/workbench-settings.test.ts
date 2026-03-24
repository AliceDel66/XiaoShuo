import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_PROMPT_TEMPLATES } from "../src/shared/defaults";
import type { PreviewSession } from "../src/shared/types";
import { WorkbenchService } from "../src/main/services/workbench-service";

describe("Workbench settings and prompt templates", () => {
  let tempRoot = "";
  let service: WorkbenchService;

  beforeEach(async () => {
    tempRoot = await mkdtemp(join(tmpdir(), "fanqie-settings-"));
    service = new WorkbenchService(join(tempRoot, "data"), join(tempRoot, "projects"), join(tempRoot, "builtin"));
    await service.init();
  });

  afterEach(async () => {
    service.dispose();
    await rm(tempRoot, { recursive: true, force: true });
  });

  it("persists workbench settings and restores the configured last project after restart", async () => {
    const first = await service.createProject({
      title: "灰炉时钟",
      premise: "主角在每次倒计时结束后都会失去一段身份记忆。",
      genre: "悬疑成长",
      targetWords: 800000,
      plannedVolumes: 6,
      endingType: "阶段性胜利后的开放结局",
      workflowMode: "strict"
    });

    await service.createProject({
      title: "静默档案",
      premise: "一座城市的失踪人口会提前出现在档案库里。",
      genre: "都市悬疑",
      targetWords: 600000,
      plannedVolumes: 4,
      endingType: "阶段性收束",
      workflowMode: "strict"
    });

    const dashboard = await service.getDashboardData();
    await service.saveWorkbenchSettings({
      ...dashboard.settings,
      editorPreferences: {
        ...dashboard.settings.editorPreferences,
        autoSaveMs: 900,
        fontSize: 22
      },
      startupPreferences: {
        ...dashboard.settings.startupPreferences,
        reopenLastProject: true,
        lastOpenedProjectId: first.manifest.projectId
      },
      projectDefaults: {
        ...dashboard.settings.projectDefaults,
        defaultRootDirectory: join(tempRoot, "custom-projects")
      }
    });

    service.dispose();
    service = new WorkbenchService(join(tempRoot, "data"), join(tempRoot, "projects"), join(tempRoot, "builtin"));
    await service.init();

    const reopened = await service.getDashboardData();
    expect(reopened.settings.editorPreferences.autoSaveMs).toBe(900);
    expect(reopened.settings.editorPreferences.fontSize).toBe(22);
    expect(reopened.settings.projectDefaults.defaultRootDirectory).toBe(join(tempRoot, "custom-projects"));
    expect(reopened.selectedProject?.manifest.projectId).toBe(first.manifest.projectId);
  });

  it("renders saved prompt templates in promptTrace and can reset them to defaults", async () => {
    const project = await service.createProject({
      title: "潮汐档案",
      premise: "沿海城的失踪案会在退潮时留下未来碎片。",
      genre: "悬疑成长",
      targetWords: 700000,
      plannedVolumes: 5,
      endingType: "阶段性胜利",
      workflowMode: "strict"
    });

    const dashboard = await service.getDashboardData();
    await service.saveWorkbenchSettings({
      ...dashboard.settings,
      promptTemplates: {
        ...dashboard.settings.promptTemplates,
        "generate-project-setup": {
          systemTemplate: "自定义 System 模板\n{{payload}}",
          userTemplate: "自定义 User 模板\n{{payload}}"
        }
      }
    });

    const customStarted = await service.startGeneration({
      projectId: project.manifest.projectId,
      action: "generate-project-setup"
    });
    const customSession = await waitForSession(service, customStarted.sessionId, (session) => session.candidates.length > 0);
    await waitForIdle(service);

    expect(customSession.promptTrace?.systemPrompt).toContain("自定义 System 模板");
    expect(customSession.promptTrace?.userPrompt).toContain("自定义 User 模板");

    await service.saveWorkbenchSettings({
      ...dashboard.settings,
      promptTemplates: DEFAULT_PROMPT_TEMPLATES
    });

    const resetStarted = await service.startGeneration({
      projectId: project.manifest.projectId,
      action: "generate-project-setup"
    });
    const resetSession = await waitForSession(service, resetStarted.sessionId, (session) => session.candidates.length > 0);

    expect(resetSession.promptTrace?.systemPrompt).toContain("中文网络小说策划编辑");
    expect(resetSession.promptTrace?.systemPrompt).not.toContain("自定义 System 模板");
  });
});

async function waitForSession(
  service: WorkbenchService,
  sessionId: string,
  predicate: (session: PreviewSession) => boolean,
  timeoutMs = 5000
): Promise<PreviewSession> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const session = await service.getPreviewSession(sessionId);
      if (predicate(session)) {
        return session;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("Preview session not found")) {
        throw error;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Timed out waiting for preview session ${sessionId}`);
}

async function waitForIdle(service: WorkbenchService, timeoutMs = 5000): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const dashboard = await service.getDashboardData();
    if (!dashboard.activeJob) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("Timed out waiting for generation job to clear");
}
