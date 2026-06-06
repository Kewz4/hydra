import { UploadcareSync } from "@main/services/uploadcare-sync";
import { registerEvent } from "../register-event";

const deleteGameArtifact = async (
  _event: Electron.IpcMainInvokeEvent,
  artifactId: string
) => {
  await UploadcareSync.deleteFile(artifactId);
  return { ok: true };
};

registerEvent("deleteGameArtifact", deleteGameArtifact);
