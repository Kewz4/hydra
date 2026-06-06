import {
  CloudSync,
  UploadcareSync,
  logger,
  WindowManager,
  Wine,
} from "@main/services";
import fs from "node:fs";
import * as tar from "tar";
import { registerEvent } from "../register-event";
import path from "node:path";
import { backupsPath, publicProfilePath } from "@main/constants";
import type { GameShop, LudusaviBackupMapping, UserPreferences } from "@types";
import { db, levelKeys } from "@main/level";

import YAML from "yaml";
import { addTrailingSlash, normalizePath } from "@main/helpers";
import { SystemPath } from "@main/services/system-path";

export const transformLudusaviBackupPathIntoWindowsPath = (
  backupPath: string,
  winePrefixPath?: string | null
) => {
  return backupPath
    .replace(winePrefixPath ? addTrailingSlash(winePrefixPath) : "", "")
    .replace("drive_c", "C:");
};

export const addWinePrefixToWindowsPath = (
  windowsPath: string,
  winePrefixPath?: string | null
) => {
  if (!winePrefixPath) return windowsPath;
  return path.join(winePrefixPath, windowsPath.replace("C:", "drive_c"));
};

const restoreLudusaviBackup = (
  backupPath: string,
  title: string,
  homeDir: string,
  winePrefixPath?: string | null,
  artifactWinePrefixPath?: string | null
) => {
  const gameBackupPath = path.join(backupPath, title);
  const mappingYamlPath = path.join(gameBackupPath, "mapping.yaml");

  const data = fs.readFileSync(mappingYamlPath, "utf8");
  const manifest = YAML.parse(data) as {
    backups: LudusaviBackupMapping[];
    drives: Record<string, string>;
  };

  const userProfilePath =
    CloudSync.getWindowsLikeUserProfilePath(winePrefixPath);

  manifest.backups.forEach((backup) => {
    Object.keys(backup.files).forEach((key) => {
      const sourcePathWithDrives = Object.entries(manifest.drives).reduce(
        (prev, [driveKey, driveValue]) => prev.replace(driveValue, driveKey),
        key
      );

      const sourcePath = path.join(gameBackupPath, sourcePathWithDrives);
      logger.info(`Source path: ${sourcePath}`);

      const destinationPath = transformLudusaviBackupPathIntoWindowsPath(
        key,
        artifactWinePrefixPath
      )
        .replace(
          homeDir,
          addWinePrefixToWindowsPath(userProfilePath, winePrefixPath)
        )
        .replace(
          publicProfilePath,
          addWinePrefixToWindowsPath(publicProfilePath, winePrefixPath)
        );

      logger.info(`Moving ${sourcePath} to ${destinationPath}`);
      fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
      if (fs.existsSync(destinationPath)) fs.unlinkSync(destinationPath);
      fs.renameSync(sourcePath, destinationPath);
    });
  });
};

const downloadGameArtifact = async (
  _event: Electron.IpcMainInvokeEvent,
  objectId: string,
  shop: GameShop,
  gameArtifactId: string  // Uploadcare UUID
) => {
  try {
    const prefs = await db.get<string, UserPreferences>(levelKeys.userPreferences, { valueEncoding: "json" });
    UploadcareSync.configure(prefs?.uploadcarePublicKey ?? null, prefs?.uploadcareSecretKey ?? null);

    const game = await gamesSublevel.get(levelKeys.game(shop, objectId));
    const effectiveWinePrefixPath = Wine.getEffectivePrefixPath(
      game?.winePrefixPath,
      objectId
    );

    const zipLocation = path.join(
      SystemPath.getPath("userData"),
      `${gameArtifactId}.tar`
    );
    const backupPath = path.join(backupsPath, `${shop}-${objectId}`);

    if (fs.existsSync(backupPath)) {
      fs.rmSync(backupPath, { recursive: true, force: true });
    }

    WindowManager.mainWindow?.webContents.send(
      `on-backup-download-progress-${objectId}-${shop}`,
      { loaded: 0, total: 1 }
    );

    await UploadcareSync.downloadFile(gameArtifactId, zipLocation);

    WindowManager.mainWindow?.webContents.send(
      `on-backup-download-progress-${objectId}-${shop}`,
      { loaded: 1, total: 1 }
    );

    fs.mkdirSync(backupPath, { recursive: true });

    await tar.x({ file: zipLocation, cwd: backupPath });

    // Determine homeDir and winePrefix from the artifact's metadata
    // (stored when uploading; we use a best-effort restore with local paths)
    restoreLudusaviBackup(
      backupPath,
      objectId,
      normalizePath(CloudSync.getWindowsLikeUserProfilePath(effectiveWinePrefixPath)),
      effectiveWinePrefixPath,
      effectiveWinePrefixPath
    );

    fs.unlinkSync(zipLocation);

    WindowManager.mainWindow?.webContents.send(
      `on-backup-download-complete-${objectId}-${shop}`,
      true
    );
  } catch (err) {
    logger.error("Failed to download game artifact", err);
    WindowManager.mainWindow?.webContents.send(
      `on-backup-download-complete-${objectId}-${shop}`,
      false
    );
  }
};

registerEvent("downloadGameArtifact", downloadGameArtifact);
