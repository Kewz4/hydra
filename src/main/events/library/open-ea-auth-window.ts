import axios from "axios";
import { BrowserWindow } from "electron";
import { registerEvent } from "../register-event";
import { db, levelKeys } from "@main/level";
import type { UserPreferences } from "@types";
import { logger } from "@main/services";
import { WindowManager } from "@main/services/window-manager";
import {
  EA_AUTH_PARTITION,
  EA_TOKEN_URL,
  parseEaAuthJson,
} from "@main/services/ea-auth";

export interface EaAuthResult {
  accessToken: string;
  username: string;
  pid: string;
}

const persistEaAuth = async (
  accessToken: string,
  expiresInSeconds: number,
  username: string,
  pid: string
) => {
  const prefs = await db
    .get<string, UserPreferences | null>(levelKeys.userPreferences, {
      valueEncoding: "json",
    })
    .catch(() => null);
  const expiry = new Date(
    Date.now() + expiresInSeconds * 1000
  ).toISOString();
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
};

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
        partition: EA_AUTH_PARTITION,
      },
    });

    // prompt=login forces the sign-in page; once the user authenticates, EA
    // redirects back to the auth endpoint which answers with a JSON body
    // containing the access token (nucleus:rest = "REST mode", no redirect).
    win.loadURL(`${EA_TOKEN_URL}&prompt=login`);

    let handled = false;

    const completeWithToken = async (accessToken: string, expiresIn: number) => {
      if (handled) return;
      handled = true;
      if (!win.isDestroyed()) win.close();

      try {
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

        await persistEaAuth(accessToken, expiresIn, username, pid);
        resolve({ accessToken, username, pid });
      } catch (err) {
        logger.error("EA auth: identity fetch failed", err);
        // Token itself is valid — persist it anyway so syncs can run
        await persistEaAuth(accessToken, expiresIn, "EA Account", "").catch(
          () => {}
        );
        resolve({ accessToken, username: "EA Account", pid: "" });
      }
    };

    const checkPageForToken = async () => {
      if (handled || win.isDestroyed()) return;
      const url = win.webContents.getURL();
      // The token JSON is only ever served from the auth endpoint itself
      if (!url.startsWith("https://accounts.ea.com/connect/auth")) return;

      try {
        const bodyText: string = await win.webContents.executeJavaScript(
          "document.body ? document.body.innerText : ''",
          true
        );
        const data = parseEaAuthJson(bodyText);
        if (data?.access_token) {
          await completeWithToken(
            data.access_token,
            Number(data.expires_in ?? 3600)
          );
        } else if (data?.error) {
          logger.error(`EA auth endpoint returned error: ${bodyText}`);
        }
      } catch {
        // page not ready / not JSON — keep waiting
      }
    };

    // Fallback: some EA stacks do redirect to nucleus:rest#access_token=...
    const handleNucleusRedirect = (url: string) => {
      if (handled || !url.startsWith("nucleus:")) return;
      const hashIdx = url.indexOf("#");
      const queryStr =
        hashIdx >= 0 ? url.slice(hashIdx + 1) : (url.split("?")[1] ?? "");
      const params = new URLSearchParams(queryStr);
      const accessToken = params.get("access_token");
      if (accessToken) {
        void completeWithToken(
          accessToken,
          Number(params.get("expires_in") ?? 3600)
        );
      }
    };

    win.webContents.on("did-finish-load", () => void checkPageForToken());
    win.webContents.on("will-navigate", (_e, url) =>
      handleNucleusRedirect(url)
    );
    win.webContents.on("will-redirect", (_e, url) =>
      handleNucleusRedirect(url)
    );
    win.on("closed", () => {
      if (!handled) resolve(null);
    });
  });
};

registerEvent("openEaAuthWindow", openEaAuthWindow);
