import axios from "axios";
import { logger } from "./logger";

interface SteamSearchResult {
  appid: number;
  name: string;
}

let steamAppListCache: SteamSearchResult[] | null = null;
let steamAppListFetchedAt = 0;

/** Search Steam for a game by title. Returns the best-match appId or null. */
export async function findSteamAppIdByTitle(title: string): Promise<number | null> {
  try {
    // Cache the full app list for 24h
    if (!steamAppListCache || Date.now() - steamAppListFetchedAt > 86400_000) {
      const res = await axios.get(
        "https://api.steampowered.com/ISteamApps/GetAppList/v2/",
        { timeout: 15_000 }
      );
      steamAppListCache = res.data?.applist?.apps ?? [];
      steamAppListFetchedAt = Date.now();
    }

    const normalized = title.trim().toLowerCase();
    const exact = steamAppListCache!.find(
      (a) => a.name.trim().toLowerCase() === normalized
    );
    if (exact) return exact.appid;

    // Fuzzy: starts-with match
    const startsWith = steamAppListCache!.find((a) =>
      a.name.trim().toLowerCase().startsWith(normalized)
    );
    if (startsWith) return startsWith.appid;

    return null;
  } catch (err) {
    logger.warn("Steam app list search failed", err);
    return null;
  }
}

/** Get high-quality Steam CDN art URLs for an app ID. */
export function getSteamCdnUrls(appId: number) {
  const base = `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}`;
  return {
    heroImageUrl: `${base}/library_hero.jpg`,
    iconUrl: `${base}/library_600x900.jpg`,
    logoImageUrl: `${base}/logo.png`,
  };
}
