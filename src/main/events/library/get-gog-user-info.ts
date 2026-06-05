import { registerEvent } from "../register-event";
import { db, levelKeys } from "@main/level";
import type { UserPreferences } from "@types";
import { refreshGogToken, getGogUserInfo } from "@main/services/gog-account";

const getGogUserInfoHandler = async (_event: Electron.IpcMainInvokeEvent) => {
  const prefs = await db
    .get<string, UserPreferences | null>(levelKeys.userPreferences, {
      valueEncoding: "json",
    })
    .catch(() => null);

  if (!prefs?.gogRefreshToken) return null;

  try {
    const tokens = await refreshGogToken(prefs.gogRefreshToken);
    return getGogUserInfo(tokens.access_token);
  } catch {
    return null;
  }
};

registerEvent("getGogUserInfo", getGogUserInfoHandler);
