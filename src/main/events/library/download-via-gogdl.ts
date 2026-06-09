import { registerEvent } from "../register-event";
import { DownloadOrchestrator, WindowManager, logger } from "@main/services";
import { db, downloadsSublevel, gamesSublevel, levelKeys } from "@main/level";
import { isActiveLikeDownload } from "../../../types";
import type { UserPreferences } from "@types";
import {
  spawnGogdlInstall,
  findGogdlBinary,
  downloadGogdl,
} from "@main/services/gogdl";
import { refreshGogToken } from "@main/services/gog-account";
import { getDownloadsPath } from "../helpers/get-downloads-path";
import { Downloader } from "@shared";

function sendLog(objectId: string, line: string, isError = false) {
  WindowManager.sendToAppWindows("on-gogdl-process-log", {
    objectId,
    line,
    isError,
  });
}

const activeGogdlDownloads = new Map<string, () => void>();

/** Internal: spawns gogdl and wires progress/complete/error into the DB + IPC. */
async function startGogdlDownloadInternal(
  objectId: string,
  downloadPath: string,
  accessToken: string,
  refreshToken: string,
  binaryPath: string | null
) {
  const gameKey = levelKeys.game("gog", objectId);

  const existingDownload = await downloadsSublevel
    .get(gameKey)
    .catch(() => null);

  // If another download is already active, queue this one instead of overriding
  const allDownloads = await downloadsSublevel.values().all();
  const hasActiveOther = allDownloads.some(
    (d) =>
      isActiveLikeDownload(d) && levelKeys.game(d.shop, d.objectId) !== gameKey
  );
  if (hasActiveOther) {
    const queuedRecord = {
      ...(existingDownload ?? {}),
      shop: "gog" as const,
      objectId,
      uri: `gogdl://install/${objectId}`,
      folderName: null,
      downloadPath,
      progress: existingDownload?.progress ?? 0,
      downloader: Downloader.Gogdl,
      bytesDownloaded: existingDownload?.bytesDownloaded ?? 0,
      fileSize: existingDownload?.fileSize ?? null,
      shouldSeed: false,
      status: "paused" as const,
      queued: true,
      timestamp: existingDownload?.timestamp ?? Date.now(),
      extracting: false,
      automaticallyExtract: false,
      automaticallyDeleteArchiveFiles: false,
    };
    await downloadsSublevel.put(gameKey, queuedRecord);
    WindowManager.sendToAppWindows("on-downloads-updated");
    return { ok: true };
  }

  const initialRecord = {
    ...(existingDownload ?? {}),
    shop: "gog" as const,
    objectId,
    uri: `gogdl://install/${objectId}`,
    folderName: null,
    downloadPath,
    progress: existingDownload?.progress ?? 0,
    downloader: Downloader.Gogdl,
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

  const savedProgress = existingDownload?.progress ?? 0;
  let currentRecord = { ...initialRecord };
  // alive is set to false on pause/cancel so pending async callbacks don't
  // write stale data back to the DB or re-broadcast stale progress events.
  let alive = true;

  sendLog(objectId, `Binary: ${binaryPath}`);
  sendLog(objectId, `Download path: ${downloadPath}`);

  const cancel = spawnGogdlInstall(
    objectId,
    downloadPath,
    accessToken,
    refreshToken,
    binaryPath,
    async (progress, downloadedMB, totalMB, speedMBs, etaMs) => {
      if (!alive) return;
      // Don't let progress go backward (gogdl re-verifies files on resume)
      const effectiveProgress = Math.max(
        progress,
        savedProgress,
        currentRecord.progress
      );
      sendLog(
        objectId,
        `Progress: ${(effectiveProgress * 100).toFixed(2)}% (${downloadedMB.toFixed(1)}/${totalMB.toFixed(1)} MiB) @ ${speedMBs.toFixed(2)} MiB/s`
      );
      currentRecord = {
        ...currentRecord,
        progress: effectiveProgress,
        bytesDownloaded: Math.max(
          downloadedMB * 1024 * 1024,
          currentRecord.bytesDownloaded
        ),
        fileSize: Math.max(totalMB * 1024 * 1024, currentRecord.fileSize ?? 0),
        status: "active",
      };
      await downloadsSublevel.put(gameKey, currentRecord).catch(() => {});
      if (!alive) return;
      WindowManager.sendToAppWindows("on-download-progress", {
        gameId: gameKey,
        progress: effectiveProgress,
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
      if (!alive) return;
      sendLog(objectId, "✓ Download complete!");
      activeGogdlDownloads.delete(gameKey);
      const game = await gamesSublevel.get(gameKey).catch(() => null);
      if (game) {
        await gamesSublevel.put(gameKey, {
          ...game,
          executablePath: `goggalaxy://openGame/${objectId}`,
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
      DownloadOrchestrator.startNextQueuedDownload().catch(() => {});
    },
    async (err) => {
      if (!alive) return;
      sendLog(objectId, `✗ Error: ${err}`, true);
      activeGogdlDownloads.delete(gameKey);
      logger.error("gogdl download failed", { objectId, err });
      await downloadsSublevel.del(gameKey).catch(() => {});
      WindowManager.sendToAppWindows("on-downloads-updated");
      DownloadOrchestrator.startNextQueuedDownload().catch(() => {});
    },
    (line, isError) => sendLog(objectId, line, isError)
  );

  activeGogdlDownloads.set(gameKey, () => {
    alive = false;
    cancel();
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Pause / resume
// ---------------------------------------------------------------------------

export async function cancelGogdlDownloadByKey(gameKey: string) {
  activeGogdlDownloads.get(gameKey)?.();
  activeGogdlDownloads.delete(gameKey);
  await downloadsSublevel.del(gameKey).catch(() => {});
  WindowManager.sendToAppWindows("on-downloads-updated");
  DownloadOrchestrator.startNextQueuedDownload().catch(() => {});
  return { ok: true };
}

export async function pauseGogdlDownload(gameKey: string) {
  activeGogdlDownloads.get(gameKey)?.();
  activeGogdlDownloads.delete(gameKey);
  const record = await downloadsSublevel.get(gameKey).catch(() => null);
  if (record) {
    await downloadsSublevel
      .put(gameKey, { ...record, status: "paused" })
      .catch(() => {});
  }
  WindowManager.sendToAppWindows("on-downloads-updated");
  return { ok: true };
}

export async function resumeGogdlDownload(
  objectId: string,
  downloadPath: string,
  gogRefreshToken: string
) {
  const tokens = await refreshGogToken(gogRefreshToken);
  return startGogdlDownloadInternal(
    objectId,
    downloadPath,
    tokens.access_token,
    tokens.refresh_token,
    findGogdlBinary(null)
  );
}

// ---------------------------------------------------------------------------
// IPC events
// ---------------------------------------------------------------------------

const downloadViaGogdl = async (
  _event: Electron.IpcMainInvokeEvent,
  objectId: string,
  customDownloadPath?: string
) => {
  const prefs = await db
    .get<string, UserPreferences | null>(levelKeys.userPreferences, {
      valueEncoding: "json",
    })
    .catch(() => null);

  const gogRefreshToken = prefs?.gogRefreshToken;
  if (!gogRefreshToken) {
    sendLog(
      objectId,
      "✗ Error: GOG account not authenticated. Please connect your GOG account in Settings.",
      true
    );
    throw new Error("GOG account not authenticated");
  }

  const tokens = await refreshGogToken(gogRefreshToken);
  const downloadPath = customDownloadPath ?? (await getDownloadsPath());

  let binary = findGogdlBinary(null);
  sendLog(objectId, `Starting gogdl download for game ID ${objectId}…`);

  if (!binary) {
    sendLog(objectId, "gogdl not found — downloading automatically…");
    try {
      binary = await downloadGogdl((pct) => {
        sendLog(objectId, `Downloading gogdl: ${pct}%`);
      });
      sendLog(objectId, `✓ gogdl installed at ${binary}`);
    } catch (err: any) {
      sendLog(
        objectId,
        `✗ Failed to auto-install gogdl: ${err?.message ?? err}`,
        true
      );
      throw new Error("gogdl auto-install failed");
    }
  }

  return startGogdlDownloadInternal(
    objectId,
    downloadPath,
    tokens.access_token,
    tokens.refresh_token,
    binary
  );
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
  WindowManager.sendToAppWindows("on-downloads-updated");
  return { ok: true };
};

registerEvent("cancelGogdlDownload", cancelGogdlDownload);
