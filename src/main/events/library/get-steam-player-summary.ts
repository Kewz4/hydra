import { registerEvent } from "../register-event";
import { db, levelKeys } from "@main/level";
import type { UserPreferences } from "@types";
import { getSteamPlayerSummary } from "@main/services/steam-account";

const getSteamPlayerSummaryHandler = async (
  _event: Electron.IpcMainInvokeEvent,
  steamId: string,
  apiKey: string
) => {
  return getSteamPlayerSummary(steamId, apiKey);
};

registerEvent("getSteamPlayerSummary", getSteamPlayerSummaryHandler);

export const getSteamPlayerSummaryForCurrentUser = async () => {
  const prefs = await db
    .get<string, UserPreferences | null>(levelKeys.userPreferences, {
      valueEncoding: "json",
    })
    .catch(() => null);

  if (!prefs?.steamId || !prefs?.steamApiKey) return null;

  return getSteamPlayerSummary(prefs.steamId, prefs.steamApiKey).catch(
    () => null
  );
};
