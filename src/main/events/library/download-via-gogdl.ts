import { registerEvent } from "../register-event";
import { WindowManager, logger } from "@main/services";
import { db, downloadsSublevel, gamesSublevel, levelKeys } from "@main/level";
import type { UserPreferences } from "@types";
import { spawnGogdlInstall } from "@main/services/gogdl";
import { refreshGogToken } from "@main/services/gog-account";
import { getDownloadsPath } from "../helpers/get-downloads-path";
import { Downloader } from "@shared";

// Track active gogdl downloads by gameKey
const activeGogdlDownloads = new Map<string, () => void>();

const downloadViaGogdl = async (
  _event: Electron.IpcMainInvokeEvent,
  objectId: string,
  customDownloadPath?: string
) => {
  const prefs = await db.get<string, UserPreferences | null>(levelKeys.userPreferences, { valueEncoding: "json" }).catch(() => null);

  const gogRefreshToken = prefs?.gogRefreshToken;
  if (!gogRefreshToken) throw new Error("GOG account not authenticated");

  // Refresh token to get a fresh access token
  const tokens = await refreshGogToken(gogRefreshToken);
  const { access_token: accessToken, refresh_token: newRefreshToken } = tokens;

  const downloadPath = customDownloadPath ?? await getDownloadsPath();
  const gameKey = levelKeys.game("gog", objectId);

  const existingDownload = await downloadsSublevel.get(gameKey).catch(() => null);
  const initialRecord = {
    ...(existingDownload ?? {}),
    shop: "gog",
    objectId,
    uri: `gogdl://install/${objectId}`,
    folderName: null,
    downloadPath,
    progress: 0,
    downloader: Downloader.Gogdl,
    bytesDownloaded: 0,
    fileSize: null,
    shouldSeed: false,
    status: "active",
    queued: false,
    timestamp: Date.now(),
    extracting: false,
    automaticallyExtract: false,
  };
  await downloadsSublevel.put(gameKey, initialRecord);

  let currentRecord = { ...initialRecord };

  const cancel = spawnGogdlInstall(
    objectId,
    downloadPath,
    accessToken,
    newRefreshToken,
    null,
    async (progress, downloadedMB, totalMB, speedMBs) => {
      currentRecord = {
        ...currentRecord,
        progress,
        bytesDownloaded: downloadedMB * 1024 * 1024,
        fileSize: totalMB * 1024 * 1024,
        status: "active",
      };
      await downloadsSublevel.put(gameKey, currentRecord).catch(() => {});
      WindowManager.sendToAppWindows("on-download-progress", {
        gameId: gameKey,
        progress,
        downloadSpeed: speedMBs * 1024 * 1024,
        timeRemaining: speedMBs > 0 ? ((totalMB - downloadedMB) / speedMBs) * 1000 : 0,
        numPeers: 0,
        numSeeds: 0,
        isDownloadingMetadata: false,
        isCheckingFiles: false,
        download: { shop: "gog", objectId, downloadPath, status: "active" },
      });
    },
    async () => {
      // On complete: update game executablePath and set status to complete
      activeGogdlDownloads.delete(gameKey);
      const game = await gamesSublevel.get(gameKey).catch(() => null);
      if (game) {
        await gamesSublevel.put(gameKey, {
          ...game,
          executablePath: `goggalaxy://openGame/${objectId}`,
        });
      }
      await downloadsSublevel.put(gameKey, {
        ...currentRecord,
        progress: 1,
        status: "complete",
      }).catch(() => {});
      WindowManager.sendToAppWindows("on-download-progress", {
        gameId: gameKey,
        progress: 1,
        downloadSpeed: 0,
        timeRemaining: 0,
        numPeers: 0,
        numSeeds: 0,
        isDownloadingMetadata: false,
        isCheckingFiles: false,
        download: { shop: "gog", objectId, downloadPath, status: "complete" },
      });
    },
    async (err) => {
      activeGogdlDownloads.delete(gameKey);
      logger.error("gogdl download failed", { objectId, err });
      await downloadsSublevel.del(gameKey).catch(() => {});
    }
  );

  activeGogdlDownloads.set(gameKey, cancel);
  return { ok: true };
};

registerEvent("downloadViaGogdl", downloadViaGogdl);

const cancelGogdlDownload = async (
  _event: Electron.IpcMainInvokeEvent,
  objectId: string
) => {
  const gameKey = levelKeys.game("gog", objectId);
  activeGogdlDownloads.get(gameKey)?.();
  activeGogdlDownloads.delete(gameKey);
  await downloadsSublevel.del(gameKey).catch(() => {});
  return { ok: true };
};

registerEvent("cancelGogdlDownload", cancelGogdlDownload);
