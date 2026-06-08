import { registerEvent } from "../register-event";
import { findGogdlBinary } from "@main/services/gogdl";

const getGogdlStatus = async (_event: Electron.IpcMainInvokeEvent) => {
  const binary = findGogdlBinary(null);
  return { binaryFound: binary !== null, binaryPath: binary };
};

registerEvent("getGogdlStatus", getGogdlStatus);
