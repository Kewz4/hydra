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

// Map from gameKey to the kill function for the active process
const activeLegendaryDownloads = new Map<string, () => void>();

/** Internal: spawns legendary and wires progress/complete/error into the DB + IPC. */
async function startLegendaryDownloadInternal(
  objectId: string,
  downloadPath: string,
  legendaryBinaryPath: string | null | undefined
) {
  const gameKey = levelKeys.game("epic", objectId);

  const existingDownload = await downloadsSublevel
    .get(gameKey)
    .catch(() => null);
  const initialRecord = {
    ...(existingDownload ?? {}),
    shop: "epic" as const,
    objectId,
    uri: `legendary://install/${objectId}`,
    folderName: null,
    downloadPath,
    progress: existingDownload?.progress ?? 0,
    downloader: Downloader.Legendary,
    bytesDownloaded: existingDownload?.bytesDownloaded ?? 0,
    fileSize: existingDownload?.fileSize ?? null,
    shouldSeed: false,
    status: "active" as const,
    queued: false,
    timestamp: existingDownload?.timestamp ?? Date.now(),
    extracting: false,
    automaticallyExtract: false,
    automaticallyDeleteArchiveFiles: false,
  };
  await downloadsSublevel.put(gameKey, initialRecord);
  // Immediately broadcast saved progress so the UI doesn't flash back to 0%
  WindowManager.sendToAppWindows("on-download-progress", {
    gameId: gameKey,
    progress: initialRecord.progress,
    downloadSpeed: 0,
    timeRemaining: 0,
    numPeers: 0,
    numSeeds: 0,
    isDownloadingMetadata: false,
    isCheckingFiles: false,
    download: initialRecord,
  });
  WindowManager.sendToAppWindows("on-downloads-updated");

  let currentRecord = { ...initialRecord };

  sendLog(objectId, `Starting Legendary install for ${objectId}…`);
  sendLog(objectId, `Download path: ${downloadPath}`);

  const cancel = spawnLegendaryInstall(
    objectId,
    downloadPath,
    legendaryBinaryPath,
    async (progress, downloadedMB, totalMB, speedMBs, etaMs) => {
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
          etaMs > 0
            ? etaMs
            : speedMBs > 0
              ? ((totalMB - downloadedMB) / speedMBs) * 1000
              : 0,
        numPeers: 0,
        numSeeds: 0,
        isDownloadingMetadata: false,
        isCheckingFiles: false,
        download: currentRecord,
      });
    },
    async () => {
      sendLog(objectId, "✓ Download complete!");
      activeLegendaryDownloads.delete(gameKey);
      const game = await gamesSublevel.get(gameKey).catch(() => null);
      if (game) {
        await gamesSublevel.put(gameKey, {
          ...game,
          executablePath: `legendary://run/${objectId}`,
        });
      }
      const completeRecord = {
        ...currentRecord,
        progress: 1,
        status: "complete" as const,
      };
      await downloadsSublevel.put(gameKey, completeRecord).catch(() => {});
      WindowManager.sendToAppWindows("on-download-progress", {
        gameId: gameKey,
        progress: 1,
        downloadSpeed: 0,
        timeRemaining: 0,
        numPeers: 0,
        numSeeds: 0,
        isDownloadingMetadata: false,
        isCheckingFiles: false,
        download: completeRecord,
      });
    },
    async (err) => {
      sendLog(objectId, `✗ Error: ${err}`, true);
      activeLegendaryDownloads.delete(gameKey);
      logger.error("Legendary download failed", { objectId, err });
      await downloadsSublevel.del(gameKey).catch(() => {});
      WindowManager.sendToAppWindows("on-downloads-updated");
    },
    (line, isError) => sendLog(objectId, line, isError)
  );

  activeLegendaryDownloads.set(gameKey, cancel);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Pause / resume — exported so pause-game-download / resume-game-download
// can route here when the downloader is Legendary.
// ---------------------------------------------------------------------------

export async function pauseLegendaryDownload(gameKey: string) {
  activeLegendaryDownloads.get(gameKey)?.();
  activeLegendaryDownloads.delete(gameKey);
  const record = await downloadsSublevel.get(gameKey).catch(() => null);
  if (record) {
    await downloadsSublevel
      .put(gameKey, { ...record, status: "paused" })
      .catch(() => {});
  }
  WindowManager.sendToAppWindows("on-downloads-updated");
  return { ok: true };
}

export async function resumeLegendaryDownload(
  objectId: string,
  downloadPath: string,
  legendaryBinaryPath?: string | null
) {
  return startLegendaryDownloadInternal(
    objectId,
    downloadPath,
    legendaryBinaryPath
  );
}

// ---------------------------------------------------------------------------
// IPC events
// ---------------------------------------------------------------------------

const downloadViaLegendary = async (
  _event: Electron.IpcMainInvokeEvent,
  objectId: string,
  customDownloadPath?: string
) => {
  const prefs = await db
    .get<string, UserPreferences | null>(levelKeys.userPreferences, {
      valueEncoding: "json",
    })
    .catch(() => null);
  const binary = findLegendaryBinary(prefs?.legendaryBinaryPath);
  if (!binary) throw new Error("Legendary binary not found");

  const downloadPath = customDownloadPath ?? (await getDownloadsPath());
  return startLegendaryDownloadInternal(
    objectId,
    downloadPath,
    prefs?.legendaryBinaryPath
  );
};

registerEvent("downloadViaLegendary", downloadViaLegendary);

export async function cancelLegendaryDownloadByKey(gameKey: string) {
  activeLegendaryDownloads.get(gameKey)?.();
  activeLegendaryDownloads.delete(gameKey);
  await downloadsSublevel.del(gameKey).catch(() => {});
  WindowManager.sendToAppWindows("on-downloads-updated");
  return { ok: true };
}

const cancelLegendaryDownload = async (
  _event: Electron.IpcMainInvokeEvent,
  objectId: string
) => {
  const gameKey = levelKeys.game("epic", objectId);
  return cancelLegendaryDownloadByKey(gameKey);
};

registerEvent("cancelLegendaryDownload", cancelLegendaryDownload);
