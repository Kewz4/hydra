import { BrowserWindow } from "electron";
import { registerEvent } from "../register-event";
import { authenticateLegendary, findLegendaryBinary } from "@main/services/legendary";
import { db, levelKeys } from "@main/level";
import type { UserPreferences } from "@types";
import { logger } from "@main/services";

// Epic redirects back to legendary.gl/epiclogin after OAuth, the page body is JSON
// containing { authorizationCode: "xxxx" }. We also check the URL for ?code= param.
const EPIC_AUTH_URL =
  "https://www.epicgames.com/id/api/redirect" +
  "?clientId=34a02cf8f4414e29b15921876da36f9a&responseType=code";

const extractCode = (url: string, bodyText: string): string | null => {
  // From URL: ?code=xxxx
  try {
    const u = new URL(url);
    const code = u.searchParams.get("code") ?? u.searchParams.get("authorizationCode");
    if (code) return code;
  } catch {}

  // From page body JSON: { "authorizationCode": "xxxx" }
  try {
    const json = JSON.parse(bodyText.trim());
    if (json?.authorizationCode) return json.authorizationCode;
    if (json?.code) return json.code;
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
      width: 600,
      height: 700,
      title: "Sign in to Epic Games",
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });

    win.loadURL(EPIC_AUTH_URL);

    const tryExtract = async (url: string) => {
      let bodyText = "";
      try {
        bodyText = await win.webContents.executeJavaScript("document.body.innerText");
      } catch {}

      const code = extractCode(url, bodyText);
      if (!code) return;

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

    // Fallback: poll the page content after dom-ready for JSON body
    win.webContents.on("dom-ready", () => {
      const url = win.webContents.getURL();
      if (url.includes("epicgames.com") || url.includes("legendary.gl")) {
        tryExtract(url);
      }
    });

    win.on("closed", () => resolve({ success: false }));
  });
};

registerEvent("openLegendaryAuthWindow", openLegendaryAuthWindow);
