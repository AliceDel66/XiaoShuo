import { app, BrowserWindow } from "electron";
import { join } from "node:path";
import { registerIpc } from "./ipc";
import { WorkbenchService } from "./services/workbench-service";

let mainWindow: BrowserWindow | null = null;
let workbenchService: WorkbenchService | null = null;

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1560,
    height: 960,
    minWidth: 1280,
    minHeight: 820,
    backgroundColor: "#f3ece3",
    title: "番茄作家助手",
    webPreferences: {
      preload: join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    await mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    await mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(async () => {
  const dataDirectory = join(app.getPath("userData"), "fanqie-writer-workbench");
  const projectsDirectory = join(app.getPath("documents"), "番茄作家助手项目");
  const builtinCorpusDirectory = app.isPackaged
    ? join(process.resourcesPath, "builtin-corpora")
    : join(process.cwd(), "resources", "builtin-corpora");

  workbenchService = new WorkbenchService(dataDirectory, projectsDirectory, builtinCorpusDirectory);
  await workbenchService.init();
  registerIpc(workbenchService);
  await createWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  workbenchService?.dispose();
});
