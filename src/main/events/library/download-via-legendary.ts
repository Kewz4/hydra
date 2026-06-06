import { registerEvent } from "../register-event";
import { WindowManager, logger } from "@main/services";
import { db, downloadsSublevel, gamesSublevel, levelKeys } from "@main/level";
import type { UserPreferences } from "@types";
import { spawnLegendaryInstall, findLegendaryBinary } from "@main/services/legendary";
import { getDownloadsPath } from "../helpers/get-downloads-path";

// Track active legendary downloads by gameId
const activeLegendaryDownloads = new Map<string, () => void>();

const downloadViaLegendary = async (
  _event: Electron.IpcMainInvokeEvent,
  objectId: string, // Legendary app_name
  customDownloadPath?: string
) => {
  const prefs = await db.get<string, UserPreferences | null>(levelKeys.userPreferences, { valueEncoding: "json" }).catch(() => null);
  const binary = findLegendaryBinary(prefs?.legendaryBinaryPath);
  if (!binary) throw new Error("Legendary binary not found");

  const downloadPath = customDownloadPath ?? await getDownloadsPath();
  const gameKey = levelKeys.game("epic", objectId);

  // Mark download as active in downloads sublevel so the UI tracks it
  const existingDownload = await downloadsSublevel.get(gameKey).catch(() => null);
  await downloadsSublevel.put(gameKey, {
    ...(existingDownload ?? {}),
    shop: "epic",
    objectId,
    uri: `legendary://install/${objectId}`,
    folderName: null,
    downloadPath,
    progress: 0,
    downloader: "Legendary" as any,
    bytesDownloaded: 0,
    fileSize: null,
    shouldSeed: false,
    status: "active",
    queued: false,
    timestamp: Date.now(),
    extracting: false,
    automaticallyExtract: false,
  });

  const cancel = spawnLegendaryInstall(
    objectId,
    downloadPath,
    prefs?.legendaryBinaryPath,
    (progress, downloadedMB, totalMB, speedMBs) => {
      gamesSublevel.get(gameKey).catch(() => null);
      WindowManager.sendToAppWindows("on-download-progress", {
        gameId: gameKey,
        progress,
        downloadSpeed: speedMBs * 1024 * 1024,
        timeRemaining: speedMBs > 0 ? ((totalMB - downloadedMB) / speedMBs) * 1000 : 0,
        numPeers: 0,
        numSeeds: 0,
        isDownloadingMetadata: false,
        isCheckingFiles: false,
        download: { shop: "epic", objectId, downloadPath, status: "active" },
      });
    },
    async () => {
      // On complete: update game executablePath and clear download
      activeLegendaryDownloads.delete(gameKey);
      const game = await gamesSublevel.get(gameKey).catch(() => null);
      if (game) {
        await gamesSublevel.put(gameKey, {
          ...game,
          executablePath: `legendary://run/${objectId}`,
        });
      }
      await downloadsSublevel.del(gameKey).catch(() => {});
      WindowManager.sendToAppWindows("on-download-progress", {
        gameId: gameKey,
        progress: 1,
        downloadSpeed: 0,
        timeRemaining: 0,
        numPeers: 0,
        numSeeds: 0,
        isDownloadingMetadata: false,
        isCheckingFiles: false,
        download: { shop: "epic", objectId, downloadPath, status: "complete" },
      });
    },
    async (err) => {
      activeLegendaryDownloads.delete(gameKey);
      logger.error("Legendary download failed", { objectId, err });
      await downloadsSublevel.del(gameKey).catch(() => {});
    }
  );

  activeLegendaryDownloads.set(gameKey, cancel);
  return { ok: true };
};

registerEvent("downloadViaLegendary", downloadViaLegendary);
