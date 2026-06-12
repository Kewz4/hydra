import axios from "axios";
import { BrowserWindow } from "electron";
import { registerEvent } from "../register-event";
import { db, levelKeys } from "@main/level";
import type { UserPreferences } from "@types";
import { logger } from "@main/services";
import { WindowManager } from "@main/services/window-manager";

const EA_AUTH_URL =
  "https://accounts.ea.com/connect/auth" +
  "?client_id=EADOTCOM-002-WEBCLIENT" +
  "&response_type=token" +
  "&redirect_uri=nucleus:rest" +
  "&prompt=login" +
  "&release_type=prod";

export interface EaAuthResult {
  accessToken: string;
  username: string;
  pid: string;
}

const openEaAuthWindow = async (
  _event: Electron.IpcMainInvokeEvent
): Promise<EaAuthResult | null> => {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      width: 520,
      height: 720,
      title: "Sign in to EA",
      ...(WindowManager.mainWindow
        ? { parent: WindowManager.mainWindow, modal: true }
        : {}),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        partition: "persist:ea-auth",
      },
    });

    win.loadURL(EA_AUTH_URL);

    let handled = false;

    const handleToken = async (url: string) => {
      if (handled) return;
      // EA redirects to nucleus:rest#access_token=...
      if (!url.includes("nucleus") && !url.includes("access_token")) return;
      handled = true;
      win.close();

      try {
        // Parse token from fragment or query string
        const hashIdx = url.indexOf("#");
        const queryStr =
          hashIdx >= 0 ? url.slice(hashIdx + 1) : url.split("?")[1] ?? "";
        const params = new URLSearchParams(queryStr);
        const accessToken = params.get("access_token");
        if (!accessToken) {
          resolve(null);
          return;
        }

        // Fetch user info
        const infoRes = await axios.get(
          "https://gateway.ea.com/proxy/identity/pids/me",
          {
            headers: { Authorization: `Bearer ${accessToken}` },
            timeout: 10_000,
          }
        );
        const pidData = infoRes.data?.pid ?? {};
        const username =
          pidData.displayName ??
          pidData.email ??
          pidData.pidId ??
          "EA Account";
        const pid = String(pidData.pidId ?? "");

        const result: EaAuthResult = { accessToken, username, pid };

        // Persist immediately
        const prefs = await db
          .get<string, UserPreferences | null>(levelKeys.userPreferences, {
            valueEncoding: "json",
          })
          .catch(() => null);
        const expiry = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(); // 3 hours
        await db.put<string, UserPreferences>(
          levelKeys.userPreferences,
          {
            ...(prefs ?? {}),
            eaAccessToken: accessToken,
            eaTokenExpiry: expiry,
            eaUsername: username,
            eaPid: pid,
          },
          { valueEncoding: "json" }
        );

        resolve(result);
      } catch (err) {
        logger.error("EA auth token exchange failed", err);
        resolve(null);
      }
    };

    win.webContents.on("will-navigate", (_e, url) => handleToken(url));
    win.webContents.on("will-redirect", (_e, url) => handleToken(url));
    win.webContents.on("did-navigate", (_e, url) => handleToken(url));
    win.on("closed", () => {
      if (!handled) resolve(null);
    });
  });
};

registerEvent("openEaAuthWindow", openEaAuthWindow);
