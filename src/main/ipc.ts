import { BrowserWindow, dialog, ipcMain } from "electron";
import type { AppApi } from "../shared/types";
import { WorkbenchService } from "./services/workbench-service";

const generationEventChannel = "workbench:generation-event";

export function registerIpc(service: WorkbenchService): void {
  service.onGenerationEvent((event) => {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send(generationEventChannel, event);
      }
    }
  });

  ipcMain.handle("workbench:getDashboardData", () => service.getDashboardData());
  ipcMain.handle("workbench:saveModelProfile", (_event, profile: Parameters<AppApi["saveModelProfile"]>[0]) =>
    service.saveModelProfile(profile)
  );
  ipcMain.handle(
    "workbench:testModelProfileConnection",
    (_event, profile: Parameters<AppApi["testModelProfileConnection"]>[0]) => service.testModelProfileConnection(profile)
  );
  ipcMain.handle(
    "workbench:saveWorkbenchSettings",
    (_event, settings: Parameters<AppApi["saveWorkbenchSettings"]>[0]) => service.saveWorkbenchSettings(settings)
  );
  ipcMain.handle("workbench:createProject", (_event, input: Parameters<AppApi["createProject"]>[0]) =>
    service.createProject(input)
  );
  ipcMain.handle("workbench:getProject", (_event, projectId: string) => service.getProject(projectId));
  ipcMain.handle("workbench:archiveProject", (_event, projectId: string) => service.archiveProject(projectId));
  ipcMain.handle("workbench:restoreProject", (_event, projectId: string) => service.restoreProject(projectId));
  ipcMain.handle("workbench:deleteProject", (_event, projectId: string) => service.deleteProject(projectId));
  ipcMain.handle("workbench:executeWorkflow", (_event, input: Parameters<AppApi["executeWorkflow"]>[0]) =>
    service.executeWorkflow(input)
  );
  ipcMain.handle("workbench:importCorpus", (_event, input: Parameters<AppApi["importCorpus"]>[0]) =>
    service.importCorpus(input)
  );
  ipcMain.handle("workbench:searchCorpus", (_event, input: Parameters<AppApi["searchCorpus"]>[0]) =>
    service.searchCorpus(input)
  );
  ipcMain.handle("workbench:exportProject", (_event, input: Parameters<AppApi["exportProject"]>[0]) =>
    service.exportProject(input)
  );
  ipcMain.handle("workbench:startGeneration", (_event, input: Parameters<AppApi["startGeneration"]>[0]) =>
    service.startGeneration(input)
  );
  ipcMain.handle("workbench:getPreviewSession", (_event, sessionId: string) => service.getPreviewSession(sessionId));
  ipcMain.handle("workbench:regenerateCandidate", (_event, sessionId: string) =>
    service.regenerateCandidate(sessionId)
  );
  ipcMain.handle("workbench:confirmCandidate", (_event, sessionId: string, candidateId: string) =>
    service.confirmCandidate(sessionId, candidateId)
  );
  ipcMain.handle("workbench:discardPreviewSession", (_event, sessionId: string) =>
    service.discardPreviewSession(sessionId)
  );
  ipcMain.handle("workbench:openArtifactEditor", (_event, artifactRef: Parameters<AppApi["openArtifactEditor"]>[0]) =>
    service.openArtifactEditor(artifactRef)
  );
  ipcMain.handle("workbench:saveArtifactEdits", (_event, document: Parameters<AppApi["saveArtifactEdits"]>[0]) =>
    service.saveArtifactEdits(document)
  );
  ipcMain.handle("workbench:createEmptyDraft", (_event, projectId: string, volumeNumber: number, chapterNumber: number, chapterTitle: string) =>
    service.createEmptyDraft(projectId, volumeNumber, chapterNumber, chapterTitle)
  );
  ipcMain.handle("workbench:pickCorpusFile", async () => {
    const result = await dialog.showOpenDialog({
      title: "导入 TXT 参考书",
      filters: [{ name: "Text", extensions: ["txt"] }],
      properties: ["openFile"]
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  // Phase 2: Story Memory IPC channels
  ipcMain.handle("workbench:getStoryMemory", (_event, projectId: string) =>
    service.getStoryMemory(projectId)
  );
  ipcMain.handle("workbench:getPendingPatches", (_event, projectId: string) =>
    service.getPendingPatches(projectId)
  );
  ipcMain.handle(
    "workbench:reviewPatch",
    (_event, projectId: string, patchId: string, decision: "confirm" | "reject") =>
      service.reviewPatch(projectId, patchId, decision)
  );
  ipcMain.handle("workbench:rollbackMemory", (_event, projectId: string, count: number) =>
    service.rollbackMemory(projectId, count)
  );
  ipcMain.handle("workbench:compactMemory", (_event, projectId: string) =>
    service.compactMemory(projectId)
  );

  // Drama (短剧) IPC channels
  ipcMain.handle("workbench:saveDramaBible", (_event, projectId: string, bible: Parameters<AppApi["saveDramaBible"]>[1]) =>
    service.saveDramaBible(projectId, bible)
  );
  ipcMain.handle("workbench:getDramaBible", (_event, projectId: string) =>
    service.getDramaBible(projectId)
  );
  ipcMain.handle("workbench:generateCharacterThreeView", (_event, projectId: string, characterId: string) =>
    service.generateCharacterThreeView(projectId, characterId)
  );
  ipcMain.handle("workbench:getCharacterThreeViews", (_event, projectId: string, characterId: string) =>
    service.getCharacterThreeViews(projectId, characterId)
  );
  ipcMain.handle("workbench:exportDramaAssets", (_event, input: Parameters<AppApi["exportDramaAssets"]>[0]) =>
    service.exportDramaAssets(input)
  );
  ipcMain.handle("workbench:generateStoryboard", (_event, input: Parameters<AppApi["generateStoryboard"]>[0]) =>
    service.generateStoryboard(input)
  );
  ipcMain.handle("workbench:getStoryboard", (_event, projectId: string, episodeId: string) =>
    service.getStoryboard(projectId, episodeId)
  );
  ipcMain.handle("workbench:startDramaGeneration", (_event, input: Parameters<AppApi["startDramaGeneration"]>[0]) =>
    service.startDramaGeneration(input)
  );

  // Drama project CRUD
  ipcMain.handle("workbench:getDramaDashboardData", () => service.getDramaDashboardData());
  ipcMain.handle("workbench:createDramaProject", (_event, input: Parameters<AppApi["createDramaProject"]>[0]) =>
    service.createDramaProject(input)
  );
  ipcMain.handle("workbench:getDramaProject", (_event, projectId: string) =>
    service.getDramaProject(projectId)
  );
  ipcMain.handle("workbench:archiveDramaProject", (_event, projectId: string) =>
    service.archiveDramaProject(projectId)
  );
  ipcMain.handle("workbench:restoreDramaProject", (_event, projectId: string) =>
    service.restoreDramaProject(projectId)
  );
  ipcMain.handle("workbench:deleteDramaProject", (_event, projectId: string) =>
    service.deleteDramaProject(projectId)
  );
  ipcMain.handle("workbench:saveDramaSettings", (_event, settings: Parameters<AppApi["saveDramaSettings"]>[0]) =>
    service.saveDramaSettings(settings)
  );
  ipcMain.handle(
    "workbench:testDramaModelProfileConnection",
    (_event, profile: Parameters<AppApi["testDramaModelProfileConnection"]>[0]) =>
      service.testDramaModelProfileConnection(profile)
  );

  ipcMain.handle(
    "auth:login",
    async (_event, payload: { code: string; hwid: string; deviceName: string; clientVersion: string }) => {
      const url = "http://auth.agentskill.asia/api/authorization-codes/login";
      const body = JSON.stringify(payload);
      const { default: http } = await import("node:http");
      return new Promise<unknown>((resolve, reject) => {
        const req = http.request(url, { method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } }, (res) => {
          let data = "";
          res.on("data", (chunk: Buffer) => { data += chunk.toString(); });
          res.on("end", () => {
            try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
            catch { resolve({ status: res.statusCode, body: data }); }
          });
        });
        req.on("error", (err) => reject(err));
        req.write(body);
        req.end();
      });
    }
  );
}

export { generationEventChannel };
