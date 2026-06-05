import axios from "axios";
import { logger } from "./logger";

export interface SteamOwnedGame {
  appid: number;
  name: string;
  img_icon_url: string;
  playtime_forever: number;
}

export interface SteamPlayerSummary {
  steamid: string;
  personaname: string;
  avatarfull: string;
}

export const getSteamOwnedGames = async (
  steamId: string,
  apiKey: string
): Promise<SteamOwnedGame[]> => {
  const response = await axios.get(
    "https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/",
    {
      params: {
        key: apiKey,
        steamid: steamId,
        include_appinfo: true,
        include_played_free_games: false,
        format: "json",
      },
    }
  );

  const games: SteamOwnedGame[] =
    response.data?.response?.games ?? [];

  logger.log(`Fetched ${games.length} owned Steam games for ${steamId}`);

  return games;
};

export const getSteamPlayerSummary = async (
  steamId: string,
  apiKey: string
): Promise<SteamPlayerSummary | null> => {
  const response = await axios.get(
    "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/",
    {
      params: {
        key: apiKey,
        steamids: steamId,
        format: "json",
      },
    }
  );

  const players: SteamPlayerSummary[] =
    response.data?.response?.players ?? [];

  return players[0] ?? null;
};
