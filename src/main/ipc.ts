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
}

export { generationEventChannel };
