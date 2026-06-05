import { registerEvent } from "../register-event";
import { downloadLegendary } from "@main/services/legendary";
import { WindowManager } from "@main/services";

const installLegendary = async (_event: Electron.IpcMainInvokeEvent) => {
  const destPath = await downloadLegendary((pct) => {
    WindowManager.sendToAppWindows("on-legendary-install-progress", pct);
  });
  return { path: destPath };
};

registerEvent("installLegendary", installLegendary);
