import { CloudSync, UploadcareSync } from "@main/services";
import { registerEvent } from "../register-event";
import { db, levelKeys } from "@main/level";
import type { GameShop, UserPreferences } from "@types";

const uploadSaveGame = async (
  _event: Electron.IpcMainInvokeEvent,
  objectId: string,
  shop: GameShop,
  downloadOptionTitle: string | null
) => {
  const prefs = await db.get<string, UserPreferences>(levelKeys.userPreferences, {
    valueEncoding: "json",
  });

  // Ensure Uploadcare is configured
  UploadcareSync.configure(prefs?.uploadcarePublicKey ?? null, prefs?.uploadcareSecretKey ?? null);

  // Ensure a stable cloud sync user ID exists
  let userId = prefs?.cloudSyncUserId;
  if (!userId) {
    userId = UploadcareSync.generateUserId();
    await db.put(levelKeys.userPreferences, { ...prefs, cloudSyncUserId: userId }, { valueEncoding: "json" });
  }

  return CloudSync.uploadSaveGame(
    objectId,
    shop,
    downloadOptionTitle,
    CloudSync.getBackupLabel(false),
    userId
  );
};

registerEvent("uploadSaveGame", uploadSaveGame);
