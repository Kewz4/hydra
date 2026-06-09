import { registerEvent } from "../register-event";
import { DownloadOrchestrator, logger } from "@main/services";
import { downloadsSublevel, levelKeys } from "@main/level";
import { Downloader } from "@shared";
import type { GameShop } from "@types";

const cancelGameDownload = async (
  _event: Electron.IpcMainInvokeEvent,
  shop: GameShop,
  objectId: string
) => {
  logger.log(`[Downloads] Cancel requested for ${shop}:${objectId}`);

  const gameKey = levelKeys.game(shop, objectId);
  const download = await downloadsSublevel.get(gameKey).catch(() => null);

  if (download?.downloader === Downloader.Gogdl) {
    const { cancelGogdlDownloadByKey } = await import(
      "../library/download-via-gogdl"
    );
    return cancelGogdlDownloadByKey(gameKey);
  }

  if (download?.downloader === Downloader.Legendary) {
    const { cancelLegendaryDownloadByKey } = await import(
      "../library/download-via-legendary"
    );
    return cancelLegendaryDownloadByKey(gameKey);
  }

  return DownloadOrchestrator.cancelDownloadById(shop, objectId);
};

registerEvent("cancelGameDownload", cancelGameDownload);
