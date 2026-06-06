import { registerEvent } from "../register-event";
import { downloadGogdl } from "@main/services/gogdl";
import { WindowManager } from "@main/services";

const installGogdl = async (_event: Electron.IpcMainInvokeEvent) => {
  const destPath = await downloadGogdl((pct) => {
    WindowManager.sendToAppWindows("on-gogdl-install-progress", pct);
  });
  return { path: destPath };
};

registerEvent("installGogdl", installGogdl);
