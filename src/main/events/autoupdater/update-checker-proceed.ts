import { registerEvent } from "../register-event";
import { WindowManager } from "@main/services";

const updateCheckerProceed = async (_event: Electron.IpcMainInvokeEvent) => {
  const win = WindowManager.updateCheckerWindow;
  if (win && !win.isDestroyed()) win.close();
};

registerEvent("updateCheckerProceed", updateCheckerProceed);
