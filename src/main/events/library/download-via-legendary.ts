import { registerEvent } from "../register-event";
import { WindowManager, logger } from "@main/services";
import { db, downloadsSublevel, gamesSublevel, levelKeys } from "@main/level";
import type { UserPreferences } from "@types";
import {
  spawnLegendaryInstall,
  findLegendaryBinary,
} from "@main/services/legendary";
import { getDownloadsPath } from "../helpers/get-downloads-path";
import { Downloader } from "@shared";

function sendLog(objectId: string, line: string, isError = false) {
  WindowManager.sendToAppWindows("on-legendary-process-log", {
    objectId,
    line,
    isError,
  });
}

// Track active legendary downloads by gameId
const activeLegendaryDownloads = new Map<string, () => void>();

const downloadViaLegendary = async (
  _event: Electron.IpcMainInvokeEvent,
  objectId: string, // Legendary app_name
  customDownloadPath?: string
) => {
  const prefs = await db
    .get<
      string,
      UserPreferences | null
    >(levelKeys.userPreferences, { valueEncoding: "json" })
    .catch(() => null);
  const binary = findLegendaryBinary(prefs?.legendaryBinaryPath);
  if (!binary) throw new Error("Legendary binary not found");

  const downloadPath = customDownloadPath ?? (await getDownloadsPath());
  const gameKey = levelKeys.game("epic", objectId);

  // Mark download as active in downloads sublevel so the UI tracks it
  const existingDownload = await downloadsSublevel
    .get(gameKey)
    .catch(() => null);
  const initialRecord = {
    ...(existingDownload ?? {}),
    shop: "epic",
    objectId,
    uri: `legendary://install/${objectId}`,
    folderName: null,
    downloadPath,
    progress: 0,
    downloader: Downloader.Legendary,
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
  // Notify renderer to refresh library so the download appears in the downloads tab
  WindowManager.sendToAppWindows("on-downloads-updated");

  // Keep a mutable reference for progress updates
  let currentRecord = { ...initialRecord };

  sendLog(objectId, `Starting Legendary install for ${objectId}…`);
  sendLog(objectId, `Binary: ${binary}`);
  sendLog(objectId, `Download path: ${downloadPath}`);

  const cancel = spawnLegendaryInstall(
    objectId,
    downloadPath,
    prefs?.legendaryBinaryPath,
    async (progress, downloadedMB, totalMB, speedMBs) => {
      sendLog(
        objectId,
        `↓ ${(progress * 100).toFixed(1)}% (${downloadedMB.toFixed(1)}/${totalMB.toFixed(1)} MiB) @ ${speedMBs.toFixed(2)} MiB/s`
      );
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
        timeRemaining:
          speedMBs > 0 ? ((totalMB - downloadedMB) / speedMBs) * 1000 : 0,
        numPeers: 0,
        numSeeds: 0,
        isDownloadingMetadata: false,
        isCheckingFiles: false,
        download: { shop: "epic", objectId, downloadPath, status: "active" },
      });
    },
    async () => {
      sendLog(objectId, "✓ Download complete!");
      // On complete: update game executablePath and set status to complete
      activeLegendaryDownloads.delete(gameKey);
      const game = await gamesSublevel.get(gameKey).catch(() => null);
      if (game) {
        await gamesSublevel.put(gameKey, {
          ...game,
          executablePath: `legendary://run/${objectId}`,
        });
      }
      await downloadsSublevel
        .put(gameKey, {
          ...currentRecord,
          progress: 1,
          status: "complete",
        })
        .catch(() => {});
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
      sendLog(objectId, `✗ Error: ${err}`, true);
      activeLegendaryDownloads.delete(gameKey);
      logger.error("Legendary download failed", { objectId, err });
      await downloadsSublevel.del(gameKey).catch(() => {});
    },
    (line, isError) => sendLog(objectId, line, isError)
  );

  activeLegendaryDownloads.set(gameKey, cancel);
  return { ok: true };
};

registerEvent("downloadViaLegendary", downloadViaLegendary);

const cancelLegendaryDownload = async (
  _event: Electron.IpcMainInvokeEvent,
  objectId: string
) => {
  const gameKey = levelKeys.game("epic", objectId);
  activeLegendaryDownloads.get(gameKey)?.();
  activeLegendaryDownloads.delete(gameKey);
  await downloadsSublevel.del(gameKey).catch(() => {});
  return { ok: true };
};

registerEvent("cancelLegendaryDownload", cancelLegendaryDownload);
