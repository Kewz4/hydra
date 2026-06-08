import { registerEvent } from "../register-event";
import { shell } from "electron";
import path from "node:path";
import fs from "node:fs";
import axios from "axios";
import { SystemPath } from "@main/services/system-path";
import { logger } from "@main/services";
import { WindowManager } from "@main/services";

const BATTLENET_INSTALLER_URLS: Partial<Record<NodeJS.Platform, string>> = {
  win32:
    "https://www.battle.net/download/getInstallerForGame?os=win&locale=enUS&version=LIVE&gameProgram=BATTLENET_APP",
  darwin:
    "https://www.battle.net/download/getInstallerForGame?os=mac&locale=enUS&version=LIVE&gameProgram=BATTLENET_APP",
};

const installBattleNet = async (_event: Electron.IpcMainInvokeEvent) => {
  const url = BATTLENET_INSTALLER_URLS[process.platform as NodeJS.Platform];

  if (!url) {
    throw new Error(
      `Battle.net installer not available for ${process.platform}`
    );
  }

  const tmpDir = path.join(SystemPath.getPath("userData"), "tmp");
  fs.mkdirSync(tmpDir, { recursive: true });

  const ext = process.platform === "win32" ? ".exe" : ".dmg";
  const destPath = path.join(tmpDir, `Battle.net-Setup${ext}`);

  logger.log("Downloading Battle.net installer...");

  const response = await axios.get<ArrayBuffer>(url, {
    responseType: "arraybuffer",
    onDownloadProgress: (evt) => {
      if (evt.total) {
        const pct = Math.round((evt.loaded / evt.total) * 100);
        WindowManager.sendToAppWindows("on-battlenet-install-progress", pct);
      }
    },
  });

  fs.writeFileSync(destPath, Buffer.from(response.data));
  logger.log(`Battle.net installer saved to ${destPath}`);

  // Launch the installer — user completes the setup wizard
  shell.openPath(destPath);

  return { path: destPath };
};

registerEvent("installBattleNet", installBattleNet);
