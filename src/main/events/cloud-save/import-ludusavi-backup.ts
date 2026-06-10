import { registerEvent } from "../register-event";
import { UploadcareSync } from "@main/services/uploadcare-sync";
import { logger } from "@main/services/logger";
import { db, levelKeys } from "@main/level";
import type { GameShop, UserPreferences } from "@types";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import * as tar from "tar";

const importLudusaviBackup = async (
  _event: Electron.IpcMainInvokeEvent,
  backupFolderPath: string,
  gameName: string,
  objectId: string,
  shop: GameShop
): Promise<{ ok: boolean; artifactId?: string }> => {
  if (!fs.existsSync(backupFolderPath)) {
    throw new Error(`Backup folder not found: ${backupFolderPath}`);
  }

  const prefs = await db
    .get<string, UserPreferences>(levelKeys.userPreferences, {
      valueEncoding: "json",
    })
    .catch(() => ({}) as UserPreferences);

  let userId = prefs?.cloudSyncUserId;
  if (!userId) {
    userId = UploadcareSync.generateUserId();
    await db.put(
      levelKeys.userPreferences,
      { ...prefs, cloudSyncUserId: userId },
      { valueEncoding: "json" }
    );
  }

  // Pack the backup folder into a tar archive
  const tarPath = path.join(os.tmpdir(), `ludusavi-import-${Date.now()}.tar`);
  try {
    const gameBackupDir = path.dirname(backupFolderPath);
    const gameFolder = path.basename(backupFolderPath);

    await tar.create(
      { gzip: false, file: tarPath, cwd: gameBackupDir },
      [gameFolder]
    );

    const artifactId = await UploadcareSync.uploadFile(tarPath, {
      userId,
      shop,
      objectId,
      gameName,
      downloadOptionTitle: `Imported: ${gameName}`,
      hostname: os.hostname(),
      label: "imported",
    });

    logger.log(`importLudusaviBackup: uploaded ${artifactId} for ${gameName}`);
    return { ok: true, artifactId };
  } finally {
    try {
      fs.unlinkSync(tarPath);
    } catch {
      // ignore
    }
  }
};

registerEvent("importLudusaviBackup", importLudusaviBackup);
