import { BrowserWindow } from "electron";
import { registerEvent } from "../register-event";
import {
  authenticateLegendary,
  findLegendaryBinary,
  downloadLegendary,
  getLegendaryStatus,
} from "@main/services/legendary";
import { db, levelKeys } from "@main/level";
import type { UserPreferences } from "@types";
import { logger } from "@main/services";

const REDIRECT_API =
  "https://www.epicgames.com/id/api/redirect" +
  "?clientId=34a02cf8f4414e29b15921876da36f9a&responseType=code";

const EPIC_LOGIN_URL =
  "https://www.epicgames.com/id/login" +
  "?redirectUrl=" +
  encodeURIComponent(REDIRECT_API) +
  "&noRedirect=true";

const extractCode = (bodyText: string): string | null => {
  try {
    const json = JSON.parse(bodyText.trim());
    const code =
      json?.authorizationCode || json?.exchangeCode || json?.code || null;
    if (code && typeof code === "string" && code.length > 8) return code;
  } catch (_) {
    // ignore parse errors
  }
  return null;
};

const openLegendaryAuthWindow = async (
  _event: Electron.IpcMainInvokeEvent
): Promise<{ success: boolean; account?: string }> => {
  const prefs = await db
    .get<
      string,
      UserPreferences | null
    >(levelKeys.userPreferences, { valueEncoding: "json" })
    .catch(() => null);

  return new Promise((resolve) => {
    const win = new BrowserWindow({
      width: 640,
      height: 800,
      title: "Sign in to Epic Games",
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true,
      },
    });

    win.loadURL(EPIC_LOGIN_URL);

    let handled = false;

    const tryExtract = async (url: string) => {
      if (handled) return;
      if (!url.includes("/id/api/redirect")) return;

      let bodyText = "";
      try {
        bodyText = await win.webContents.executeJavaScript(
          "document.body.innerText"
        );
      } catch {
        return;
      }

      const code = extractCode(bodyText);
      if (!code) return;

      handled = true;
      win.close();

      try {
        // Auto-install legendary if not present before attempting auth
        let binary = findLegendaryBinary(prefs?.legendaryBinaryPath);
        if (!binary) {
          logger.log("legendary not found — downloading before auth...");
          binary = await downloadLegendary();
        }

        await authenticateLegendary(code, binary);
        const status = await getLegendaryStatus(binary);
        resolve({ success: true, account: status.account ?? undefined });
      } catch (err) {
        logger.error("legendary auth --code failed", err);
        resolve({ success: false });
      }
    };

    // Listen on all navigation events to catch every possible redirect path
    win.webContents.on("will-navigate", (_e, url) => tryExtract(url));
    win.webContents.on("will-redirect", (_e, url) => tryExtract(url));
    win.webContents.on("did-navigate", (_e, url) => tryExtract(url));
    win.webContents.on("did-navigate-in-page", (_e, url) => tryExtract(url));
    win.webContents.on("dom-ready", () => tryExtract(win.webContents.getURL()));

    win.on("closed", () => {
      if (!handled) resolve({ success: false });
    });
  });
};

registerEvent("openLegendaryAuthWindow", openLegendaryAuthWindow);
