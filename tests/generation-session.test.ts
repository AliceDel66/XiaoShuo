import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PreviewSession } from "../src/shared/types";
import { WorkbenchService } from "../src/main/services/workbench-service";

describe("Generation preview workflow", () => {
  let tempRoot = "";
  let service: WorkbenchService;

  beforeEach(async () => {
    tempRoot = await mkdtemp(join(tmpdir(), "fanqie-generation-"));
    service = new WorkbenchService(join(tempRoot, "data"), join(tempRoot, "projects"), join(tempRoot, "builtin"));
    await service.init();
  });

  afterEach(async () => {
    service.dispose();
    await rm(tempRoot, { recursive: true, force: true });
  });

  it("keeps generated content in preview until the user confirms it", async () => {
    const project = await service.createProject({
      title: "灰烬时钟",
      premise: "主角每次使用能力都会改写别人记忆里的身份。",
      genre: "悬疑成长",
      targetWords: 800000,
      plannedVolumes: 6,
      endingType: "开放式结局",
      workflowMode: "strict"
    });

    const started = await service.startGeneration({
      projectId: project.manifest.projectId,
      action: "generate-project-setup"
    });
    const session = await waitForSession(service, started.sessionId, (current) => current.candidates.length > 0);

    const beforeConfirm = await service.getProject(project.manifest.projectId);
    expect(beforeConfirm.premiseCard).toBeNull();

    const confirmed = await service.confirmCandidate(started.sessionId, session.candidates[0].candidateId);
    expect(confirmed.premiseCard?.coreSellingPoints.length).toBeGreaterThan(0);
  });

  it("enforces a single active generation task and retains candidate history on regenerate", async () => {
    const project = await service.createProject({
      title: "静默档案",
      premise: "主角在城市档案库里发现未来死亡记录。",
      genre: "都市悬疑",
      targetWords: 600000,
      plannedVolumes: 5,
      endingType: "阶段收束后继续升级",
      workflowMode: "strict"
    });

    const first = await service.startGeneration({
      projectId: project.manifest.projectId,
      action: "generate-project-setup"
    });

    // Calling startGeneration again while the first job is still running
    // should cancel the old job and start a new one (not throw).
    const second = await service.startGeneration({
      projectId: project.manifest.projectId,
      action: "generate-project-setup"
    });

    expect(second.jobId).not.toBe(first.jobId);

    await waitForSession(service, second.sessionId, (current) => current.candidates.length === 1);
    await service.regenerateCandidate(second.sessionId);
    const regenerated = await waitForSession(service, second.sessionId, (current) => current.candidates.length === 2);

    expect(regenerated.candidates).toHaveLength(2);
    expect(regenerated.candidates[0].candidateId).not.toBe(regenerated.candidates[1].candidateId);
  });

  it("discarding a preview session does not change formal project files", async () => {
    const project = await service.createProject({
      title: "钢雨城",
      premise: "一场失控暴雨让城市每晚重置一小时。",
      genre: "末日悬疑",
      targetWords: 900000,
      plannedVolumes: 6,
      endingType: "开放式结局",
      workflowMode: "strict"
    });

    const started = await service.startGeneration({
      projectId: project.manifest.projectId,
      action: "generate-project-setup"
    });

    await waitForSession(service, started.sessionId, (current) => current.candidates.length > 0);
    await service.discardPreviewSession(started.sessionId);

    const snapshot = await service.getProject(project.manifest.projectId);
    expect(snapshot.premiseCard).toBeNull();
    await expect(service.getPreviewSession(started.sessionId)).rejects.toThrow(/Preview session not found/);
  });

  it("allows manual artifact edits and rejects invalid YAML saves", async () => {
    const project = await service.createProject({
      title: "潮汐档案",
      premise: "沿海城市的失踪案会在退潮时留下未来片段。",
      genre: "悬疑成长",
      targetWords: 700000,
      plannedVolumes: 5,
      endingType: "阶段性胜利",
      workflowMode: "strict"
    });

    const started = await service.startGeneration({
      projectId: project.manifest.projectId,
      action: "generate-project-setup"
    });
    const session = await waitForSession(service, started.sessionId, (current) => current.candidates.length > 0);
    await service.confirmCandidate(started.sessionId, session.candidates[0].candidateId);

    const editor = await service.openArtifactEditor({
      artifactType: "premise-card",
      artifactId: "premise-card",
      projectId: project.manifest.projectId
    });
    const structured = (editor.structuredPayload as Record<string, unknown>) ?? {};

    const saved = await service.saveArtifactEdits({
      ...editor,
      mode: "form",
      structuredPayload: {
        ...structured,
        mainConflict: "新的主线冲突：主角必须在真相曝光前抢先掌握潮汐规律。"
      },
      isDirty: true
    });
    expect(saved.premiseCard?.mainConflict).toContain("新的主线冲突");

    await expect(
      service.saveArtifactEdits({
        ...editor,
        mode: "raw",
        rawText: "mainConflict: [broken",
        isDirty: true
      })
    ).rejects.toThrow();
  });

  it("propagates source=fallback on candidates when model is not configured", async () => {
    const project = await service.createProject({
      title: "来源追踪",
      premise: "主角每次做选择都会让时间线产生分裂。",
      genre: "科幻悬疑",
      targetWords: 500000,
      plannedVolumes: 4,
      endingType: "开放式结局",
      workflowMode: "strict"
    });

    const started = await service.startGeneration({
      projectId: project.manifest.projectId,
      action: "generate-project-setup"
    });
    const session = await waitForSession(service, started.sessionId, (s) => s.candidates.length > 0);

    // With no model configured, the candidate should carry source=fallback
    expect(session.candidates[0].source).toBe("fallback");

    // The trace should mention fallback
    const modelTrace = session.trace.find((t) => t.phase === "model-running");
    expect(modelTrace?.title).toContain("回退");
  });

  it("retains all candidate history across multiple regenerations", async () => {
    const project = await service.createProject({
      title: "历史保持",
      premise: "在循环世界中主角尝试打破时间锁。",
      genre: "奇幻",
      targetWords: 400000,
      plannedVolumes: 3,
      endingType: "开放",
      workflowMode: "strict"
    });

    const started = await service.startGeneration({
      projectId: project.manifest.projectId,
      action: "generate-project-setup"
    });
    await waitForSession(service, started.sessionId, (s) => s.candidates.length === 1);
    await waitForIdle(service);

    await service.regenerateCandidate(started.sessionId);
    await waitForSession(service, started.sessionId, (s) => s.candidates.length === 2);
    await waitForIdle(service);

    await service.regenerateCandidate(started.sessionId);
    const final = await waitForSession(service, started.sessionId, (s) => s.candidates.length === 3);

    expect(final.candidates).toHaveLength(3);
    // Each candidate should have a unique candidateId
    const ids = new Set(final.candidates.map((c) => c.candidateId));
    expect(ids.size).toBe(3);
    // Version numbers should be sequential
    expect(final.candidates.map((c) => c.versionNumber)).toEqual([1, 2, 3]);
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
