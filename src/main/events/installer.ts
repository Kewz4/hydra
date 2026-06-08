import { ipcMain } from "electron";
import { WindowManager } from "@main/services";
import {
  getInstallerDefaults,
  browseForDirectory,
  setupInstall,
  setupPortable,
  relaunchFrom,
  openInstallFolder,
} from "@main/services/installer";

ipcMain.handle("installer:getDefaults", () => getInstallerDefaults());

ipcMain.handle("installer:browseDirectory", (_e, defaultPath: string) =>
  browseForDirectory(defaultPath)
);

ipcMain.handle(
  "installer:runSetup",
  async (_e, mode: "install" | "portable", destDir?: string) => {
    const win = WindowManager.installerWindow;

    if (mode === "portable") {
      setupPortable();
      win?.webContents.send("installer:progress", 100, "Done");
      return { ok: true };
    }

    if (!destDir) return { ok: false, error: "No destination directory" };

    try {
      await setupInstall(destDir, (pct, file) => {
        win?.webContents.send("installer:progress", pct, file);
      });
      return { ok: true, destDir };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }
);

ipcMain.handle("installer:relaunch", (_e, destDir: string) => {
  relaunchFrom(destDir);
});

ipcMain.handle("installer:openFolder", (_e, destDir: string) => {
  openInstallFolder(destDir);
});

ipcMain.handle("installer:closeAndLaunch", () => {
  WindowManager.installerWindow?.close();
  WindowManager.installerWindow = null;
  WindowManager.createMainWindow();
});
