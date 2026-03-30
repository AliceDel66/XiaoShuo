import { contextBridge, ipcRenderer } from "electron";
import type { AppApi } from "../shared/types";
import { generationEventChannel } from "./ipc";

const api: AppApi = {
  getDashboardData: () => ipcRenderer.invoke("workbench:getDashboardData"),
  saveModelProfile: (profile) => ipcRenderer.invoke("workbench:saveModelProfile", profile),
  testModelProfileConnection: (profile) => ipcRenderer.invoke("workbench:testModelProfileConnection", profile),
  saveWorkbenchSettings: (settings) => ipcRenderer.invoke("workbench:saveWorkbenchSettings", settings),
  createProject: (input) => ipcRenderer.invoke("workbench:createProject", input),
  getProject: (projectId) => ipcRenderer.invoke("workbench:getProject", projectId),
  archiveProject: (projectId) => ipcRenderer.invoke("workbench:archiveProject", projectId),
  restoreProject: (projectId) => ipcRenderer.invoke("workbench:restoreProject", projectId),
  deleteProject: (projectId) => ipcRenderer.invoke("workbench:deleteProject", projectId),
  executeWorkflow: (input) => ipcRenderer.invoke("workbench:executeWorkflow", input),
  importCorpus: (input) => ipcRenderer.invoke("workbench:importCorpus", input),
  searchCorpus: (input) => ipcRenderer.invoke("workbench:searchCorpus", input),
  exportProject: (input) => ipcRenderer.invoke("workbench:exportProject", input),
  pickCorpusFile: () => ipcRenderer.invoke("workbench:pickCorpusFile"),
  startGeneration: (input) => ipcRenderer.invoke("workbench:startGeneration", input),
  subscribeGenerationEvents: (listener) => {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: Parameters<typeof listener>[0]) => {
      listener(payload);
    };
    ipcRenderer.on(generationEventChannel, wrapped);
    return () => {
      ipcRenderer.off(generationEventChannel, wrapped);
    };
  },
  getPreviewSession: (sessionId) => ipcRenderer.invoke("workbench:getPreviewSession", sessionId),
  regenerateCandidate: (sessionId) => ipcRenderer.invoke("workbench:regenerateCandidate", sessionId),
  confirmCandidate: (sessionId, candidateId) => ipcRenderer.invoke("workbench:confirmCandidate", sessionId, candidateId),
  discardPreviewSession: (sessionId) => ipcRenderer.invoke("workbench:discardPreviewSession", sessionId),
  openArtifactEditor: (artifactRef) => ipcRenderer.invoke("workbench:openArtifactEditor", artifactRef),
  saveArtifactEdits: (document) => ipcRenderer.invoke("workbench:saveArtifactEdits", document),
  createEmptyDraft: (projectId, volumeNumber, chapterNumber, chapterTitle) =>
    ipcRenderer.invoke("workbench:createEmptyDraft", projectId, volumeNumber, chapterNumber, chapterTitle),

  // Drama (短剧) APIs
  saveDramaBible: (projectId, bible) => ipcRenderer.invoke("workbench:saveDramaBible", projectId, bible),
  getDramaBible: (projectId) => ipcRenderer.invoke("workbench:getDramaBible", projectId),
  generateCharacterThreeView: (projectId, characterId) =>
    ipcRenderer.invoke("workbench:generateCharacterThreeView", projectId, characterId),
  getCharacterThreeViews: (projectId, characterId) =>
    ipcRenderer.invoke("workbench:getCharacterThreeViews", projectId, characterId),
  exportDramaAssets: (input) => ipcRenderer.invoke("workbench:exportDramaAssets", input),
  generateStoryboard: (input) => ipcRenderer.invoke("workbench:generateStoryboard", input),
  getStoryboard: (projectId, episodeId) => ipcRenderer.invoke("workbench:getStoryboard", projectId, episodeId),
  startDramaGeneration: (input) => ipcRenderer.invoke("workbench:startDramaGeneration", input)
};

contextBridge.exposeInMainWorld("workbench", api);
