import { UploadcareSync } from "@main/services/uploadcare-sync";
import { registerEvent } from "../register-event";
import { logger } from "@main/services/logger";

const deleteGameArtifact = async (
  _event: Electron.IpcMainInvokeEvent,
  artifactId: string
) => {
  try {
    await UploadcareSync.deleteFile(artifactId);
    return { ok: true };
  } catch (err) {
    logger.error("deleteGameArtifact failed for", artifactId, err);
    throw err;
  }
};

registerEvent("deleteGameArtifact", deleteGameArtifact);
