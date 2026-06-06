import { UploadcareSync } from "@main/services/uploadcare-sync";
import { registerEvent } from "../register-event";
import { db, levelKeys } from "@main/level";
import type { GameShop, UserPreferences } from "@types";

const getGameArtifacts = async (
  _event: Electron.IpcMainInvokeEvent,
  objectId: string,
  shop: GameShop
) => {
  if (shop === "custom") return [];

  const prefs = await db
    .get<string, UserPreferences>(levelKeys.userPreferences, { valueEncoding: "json" })
    .catch(() => ({} as UserPreferences));

  const userId = prefs?.cloudSyncUserId ?? "anonymous";
  return UploadcareSync.listArtifacts(userId, shop, objectId);
};

registerEvent("getGameArtifacts", getGameArtifacts);
