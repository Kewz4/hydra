import { registerEvent } from "../register-event";
import { DownloadOrchestrator, logger } from "@main/services";
import { db, downloadsSublevel, levelKeys } from "@main/level";
import { Downloader } from "@shared";
import type { GameShop, UserPreferences } from "@types";

const resumeGameDownload = async (
  _event: Electron.IpcMainInvokeEvent,
  shop: GameShop,
  objectId: string,
  strategy: "interruptActive" | "queueIfActive" = "interruptActive"
) => {
  logger.log(
    `[Downloads] Resume requested for ${shop}:${objectId} (strategy=${strategy})`
  );

  const gameKey = levelKeys.game(shop, objectId);
  const download = await downloadsSublevel.get(gameKey).catch(() => null);

  if (
    download?.downloader === Downloader.Legendary &&
    (download?.status === "paused" || download?.status === "active")
  ) {
    const { resumeLegendaryDownload } = await import(
      "../library/download-via-legendary"
    );
    const prefs = await db
      .get<string, UserPreferences | null>(levelKeys.userPreferences, {
        valueEncoding: "json",
      })
      .catch(() => null);
    return resumeLegendaryDownload(
      objectId,
      download.downloadPath,
      prefs?.legendaryBinaryPath
    );
  }

  if (
    download?.downloader === Downloader.Gogdl &&
    (download?.status === "paused" || download?.status === "active")
  ) {
    const { resumeGogdlDownload } = await import(
      "../library/download-via-gogdl"
    );
    const prefs = await db
      .get<string, UserPreferences | null>(levelKeys.userPreferences, {
        valueEncoding: "json",
      })
      .catch(() => null);
    if (!prefs?.gogRefreshToken) {
      throw new Error("GOG account not authenticated");
    }
    return resumeGogdlDownload(
      objectId,
      download.downloadPath,
      prefs.gogRefreshToken
    );
  }

  return DownloadOrchestrator.resumeDownload(shop, objectId, strategy);
};

registerEvent("resumeGameDownload", resumeGameDownload);
