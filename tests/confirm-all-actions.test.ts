import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PreviewSession } from "../src/shared/types";
import { WorkbenchService } from "../src/main/services/workbench-service";

describe("Confirm candidate for all workflow actions", () => {
  let tempRoot = "";
  let service: WorkbenchService;

  beforeEach(async () => {
    tempRoot = await mkdtemp(join(tmpdir(), "fanqie-confirm-all-"));
    service = new WorkbenchService(join(tempRoot, "data"), join(tempRoot, "projects"), join(tempRoot, "builtin"));
    await service.init();
  });

  afterEach(async () => {
    service.dispose();
    await rm(tempRoot, { recursive: true, force: true });
  });

  async function setupProjectWithPremise() {
    const project = await service.createProject({
      title: "测试全流程",
      premise: "主角陈默在灵异世界中不断成长。",
      genre: "悬疑成长",
      targetWords: 800000,
      plannedVolumes: 6,
      endingType: "开放式结局",
      workflowMode: "flexible"
    });

    // First confirm premise card
    const started = await service.startGeneration({
      projectId: project.manifest.projectId,
      action: "generate-project-setup"
    });
    const session = await waitForSession(service, started.sessionId, (s) => s.candidates.length > 0);
    const snapshot = await service.confirmCandidate(started.sessionId, session.candidates[0].candidateId);
    expect(snapshot.premiseCard).not.toBeNull();
    return snapshot;
  }

  it("confirms story-bible and saves it correctly", async () => {
    const base = await setupProjectWithPremise();

    const started = await service.startGeneration({
      projectId: base.manifest.projectId,
      action: "generate-story-bible"
    });
    const session = await waitForSession(service, started.sessionId, (s) => s.candidates.length > 0);
    expect(session.candidates[0].structuredPayload).toBeTruthy();

    const confirmed = await service.confirmCandidate(started.sessionId, session.candidates[0].candidateId);
    expect(confirmed.storyBible).not.toBeNull();
    expect(confirmed.storyBible?.characters.length).toBeGreaterThan(0);
  });

  it("confirms volume-outline and saves it correctly", async () => {
    const base = await setupProjectWithPremise();

    const started = await service.startGeneration({
      projectId: base.manifest.projectId,
      action: "generate-volume-outline"
    });
    const session = await waitForSession(service, started.sessionId, (s) => s.candidates.length > 0);
    expect(session.candidates[0].structuredPayload).toBeTruthy();

    const confirmed = await service.confirmCandidate(started.sessionId, session.candidates[0].candidateId);
    const volumeOutlines = confirmed.outlines.filter((o) => o.level === "volume");
    expect(volumeOutlines.length).toBeGreaterThan(0);
  });

  it("confirms chapter-outline and saves it correctly", async () => {
    const base = await setupProjectWithPremise();

    // Generate volume outlines first
    let started = await service.startGeneration({
      projectId: base.manifest.projectId,
      action: "generate-volume-outline"
    });
    let session = await waitForSession(service, started.sessionId, (s) => s.candidates.length > 0);
    await service.confirmCandidate(started.sessionId, session.candidates[0].candidateId);

    // Now generate chapter outlines
    await waitForIdle(service);
    started = await service.startGeneration({
      projectId: base.manifest.projectId,
      action: "generate-chapter-outline",
      volumeNumber: 1
    } as any);
    session = await waitForSession(service, started.sessionId, (s) => s.candidates.length > 0);
    expect(session.candidates[0].structuredPayload).toBeTruthy();

    const confirmed = await service.confirmCandidate(started.sessionId, session.candidates[0].candidateId);
    const chapterOutlines = confirmed.outlines.filter((o) => o.level === "chapter");
    expect(chapterOutlines.length).toBeGreaterThan(0);
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
