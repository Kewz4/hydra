import { UploadcareSync } from "@main/services";
import { registerEvent } from "../register-event";
import { db, levelKeys } from "@main/level";
import type { UserPreferences } from "@types";

const deleteGameArtifact = async (
  _event: Electron.IpcMainInvokeEvent,
  artifactId: string
) => {
  const prefs = await db.get<string, UserPreferences>(levelKeys.userPreferences, {
    valueEncoding: "json",
  });

  UploadcareSync.configure(
    prefs?.uploadcarePublicKey ?? null,
    prefs?.uploadcareSecretKey ?? null
  );

  await UploadcareSync.deleteFile(artifactId);
  return { ok: true };
};

registerEvent("deleteGameArtifact", deleteGameArtifact);
