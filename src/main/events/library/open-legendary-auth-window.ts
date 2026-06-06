import { BrowserWindow } from "electron";
import { registerEvent } from "../register-event";
import { authenticateLegendary, findLegendaryBinary } from "@main/services/legendary";
import { db, levelKeys } from "@main/level";
import type { UserPreferences } from "@types";
import { logger } from "@main/services";

// The redirect API endpoint — Epic shows this page with the code JSON after login
const REDIRECT_API =
  "https://www.epicgames.com/id/api/redirect" +
  "?clientId=34a02cf8f4414e29b15921876da36f9a&responseType=code";

// Open the login page with the redirect encoded so Epic sends the user there after auth
const EPIC_LOGIN_URL =
  "https://www.epicgames.com/id/login" +
  "?redirectUrl=" +
  encodeURIComponent(REDIRECT_API) +
  "&noRedirect=true";

const extractCode = (bodyText: string): string | null => {
  try {
    const json = JSON.parse(bodyText.trim());
    const code =
      json?.authorizationCode ||
      json?.exchangeCode ||
      json?.code ||
      null;
    if (code && typeof code === "string" && code.length > 8) return code;
  } catch {}
  return null;
};

const openLegendaryAuthWindow = async (
  _event: Electron.IpcMainInvokeEvent
): Promise<{ success: boolean; account?: string }> => {
  const prefs = await db
    .get<string, UserPreferences | null>(levelKeys.userPreferences, {
      valueEncoding: "json",
    })
    .catch(() => null);

  return new Promise((resolve) => {
    const win = new BrowserWindow({
      width: 640,
      height: 800,
      title: "Sign in to Epic Games",
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        // Allow the Epic login to work correctly
        webSecurity: true,
      },
    });

    win.loadURL(EPIC_LOGIN_URL);

    let handled = false;

    const tryExtract = async (url: string) => {
      if (handled) return;
      // Only look at the redirect API page — not the login or 2FA pages
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
        await authenticateLegendary(code, prefs?.legendaryBinaryPath);
        const { getLegendaryStatus } = await import("@main/services/legendary");
        const status = await getLegendaryStatus(prefs?.legendaryBinaryPath);
        resolve({ success: true, account: status.account ?? undefined });
      } catch (err) {
        logger.error("legendary auth --code failed", err);
        resolve({ success: false });
      }
    };

    win.webContents.on("did-navigate", (_e, url) => tryExtract(url));
    win.webContents.on("did-navigate-in-page", (_e, url) => tryExtract(url));
    win.webContents.on("dom-ready", () => {
      tryExtract(win.webContents.getURL());
    });

    win.on("closed", () => {
      if (!handled) resolve({ success: false });
    });
  });
};

registerEvent("openLegendaryAuthWindow", openLegendaryAuthWindow);
