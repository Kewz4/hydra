import { BrowserWindow } from "electron";
import { registerEvent } from "../register-event";
import {
  GOG_AUTH_URL,
  exchangeGogCode,
  getGogUserInfo,
} from "@main/services/gog-account";
import { logger } from "@main/services";

const openGogAuthWindow = async (
  _event: Electron.IpcMainInvokeEvent
): Promise<{ refresh_token: string; username: string } | null> => {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      width: 600,
      height: 700,
      title: "Sign in to GOG",
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });

    win.loadURL(GOG_AUTH_URL);

    const checkUrl = async (url: string) => {
      if (!url.includes("on_login_success") && !url.includes("embed.gog.com/on_login_success")) return;

      try {
        const params = new URL(url).searchParams;
        const code = params.get("code");
        if (!code) return;

        win.close();

        const tokens = await exchangeGogCode(code);
        resolve({ refresh_token: tokens.refresh_token, username: tokens.username });
      } catch (err) {
        logger.error("GOG auth window exchange failed", err);
        win.close();
        resolve(null);
      }
    };

    win.webContents.on("will-navigate", (_e, url) => checkUrl(url));
    win.webContents.on("did-navigate", (_e, url) => checkUrl(url));
    win.webContents.on("will-redirect", (_e, url) => checkUrl(url));

    win.on("closed", () => resolve(null));
  });
};

registerEvent("openGogAuthWindow", openGogAuthWindow);
