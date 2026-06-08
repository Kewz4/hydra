import { registerEvent } from "../register-event";
import { DownloadOrchestrator } from "@main/services";
import { downloadsSublevel, levelKeys } from "@main/level";
import { Downloader } from "@shared";
import type { GameShop } from "@types";

const pauseGameDownload = async (
  _event: Electron.IpcMainInvokeEvent,
  shop: GameShop,
  objectId: string
) => {
  const gameKey = levelKeys.game(shop, objectId);
  const download = await downloadsSublevel.get(gameKey).catch(() => null);

  if (download?.downloader === Downloader.Legendary) {
    const { pauseLegendaryDownload } = await import(
      "../library/download-via-legendary"
    );
    return pauseLegendaryDownload(gameKey);
  }

  if (download?.downloader === Downloader.Gogdl) {
    const { pauseGogdlDownload } = await import(
      "../library/download-via-gogdl"
    );
    return pauseGogdlDownload(gameKey);
  }

  return DownloadOrchestrator.pauseDownloadById(shop, objectId);
};

registerEvent("pauseGameDownload", pauseGameDownload);
