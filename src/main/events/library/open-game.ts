import { registerEvent } from "../register-event";
import { shell } from "electron";
import { GameShop } from "@types";
import { launchGame } from "@main/helpers";
import { WindowManager } from "@main/services";

const openGame = async (
  _event: Electron.IpcMainInvokeEvent,
  shop: GameShop,
  objectId: string,
  executablePath: string,
  launchOptions?: string | null
) => {
  if (executablePath.startsWith("steam://")) {
    await WindowManager.createGameLauncherWindow(shop, objectId);
    shell.openExternal(executablePath);
    return;
  }

  await launchGame({ shop, objectId, executablePath, launchOptions });
};

registerEvent("openGame", openGame);
