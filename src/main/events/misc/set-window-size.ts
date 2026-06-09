import { registerEvent } from "../register-event";
import { WindowManager } from "@main/services";

const setWindowSize = (
  _event: Electron.IpcMainInvokeEvent,
  width: number,
  height: number,
  minWidth?: number,
  minHeight?: number
) => {
  const win = WindowManager.mainWindow;
  if (!win) return;
  if (minWidth && minHeight) win.setMinimumSize(minWidth, minHeight);
  win.setSize(width, height, true);
  win.center();
};

registerEvent("setWindowSize", setWindowSize);
