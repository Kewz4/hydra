import { UploadcareSync } from "@main/services";
import { registerEvent } from "../register-event";
import { db, levelKeys } from "@main/level";
import type { GameShop, UserPreferences } from "@types";

const getGameArtifacts = async (
  _event: Electron.IpcMainInvokeEvent,
  objectId: string,
  shop: GameShop
) => {
  if (shop === "custom") return [];

  const prefs = await db.get<string, UserPreferences>(levelKeys.userPreferences, {
    valueEncoding: "json",
  });

  UploadcareSync.configure(
    prefs?.uploadcarePublicKey ?? null,
    prefs?.uploadcareSecretKey ?? null
  );

  if (!UploadcareSync.isConfigured()) return [];

  const userId = prefs?.cloudSyncUserId ?? "anonymous";
  return UploadcareSync.listArtifacts(userId, shop, objectId);
};

registerEvent("getGameArtifacts", getGameArtifacts);
