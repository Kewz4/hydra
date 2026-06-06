import axios from "axios";
import { logger } from "./logger";

const SGDB_BASE = "https://www.steamgriddb.com/api/v2";
const SGDB_KEY = "a41b22e5f9b93f698ff15cf05892aed6";

const headers = { Authorization: `Bearer ${SGDB_KEY}` };

interface SgdbGame {
  id: number;
  name: string;
}

interface SgdbAsset {
  url: string;
}

export interface SgdbArtwork {
  gridUrl: string | null;   // vertical cover (600x900)
  heroUrl: string | null;   // horizontal banner
  logoUrl: string | null;   // transparent logo
}

// In-memory search cache: title → SGDB game id (null = no match)
const searchCache = new Map<string, number | null>();
// In-memory artwork cache: sgdb id → artwork
const artworkCache = new Map<number, SgdbArtwork>();

async function findSgdbGameId(title: string): Promise<number | null> {
  const key = title.trim().toLowerCase();
  if (searchCache.has(key)) return searchCache.get(key)!;

  try {
    const res = await axios.get<{ success: boolean; data: SgdbGame[] }>(
      `${SGDB_BASE}/search/autocomplete/${encodeURIComponent(title.trim())}`,
      { headers, timeout: 10_000 }
    );
    const first = res.data.data?.[0] ?? null;
    const id = first?.id ?? null;
    searchCache.set(key, id);
    return id;
  } catch (err) {
    logger.warn(`SteamGridDB: search failed for "${title}"`, err);
    searchCache.set(key, null);
    return null;
  }
}

async function fetchOne(url: string): Promise<string | null> {
  try {
    const res = await axios.get<{ success: boolean; data: SgdbAsset[] }>(
      url,
      { headers, timeout: 10_000 }
    );
    return res.data.data?.[0]?.url ?? null;
  } catch {
    return null;
  }
}

async function getSgdbArtwork(gameId: number): Promise<SgdbArtwork> {
  if (artworkCache.has(gameId)) return artworkCache.get(gameId)!;

  const [gridUrl, heroUrl, logoUrl] = await Promise.all([
    fetchOne(`${SGDB_BASE}/grids/game/${gameId}?dimensions=600x900&limit=1`),
    fetchOne(`${SGDB_BASE}/heroes/game/${gameId}?limit=1`),
    fetchOne(`${SGDB_BASE}/logos/game/${gameId}?limit=1`),
  ]);

  const artwork: SgdbArtwork = { gridUrl, heroUrl, logoUrl };
  artworkCache.set(gameId, artwork);
  logger.log(`SteamGridDB: artwork for game ${gameId}`, artwork);
  return artwork;
}

/**
 * Fetch SteamGridDB artwork for a game by title.
 * Returns null if no match is found or all requests fail.
 */
export async function getSteamGridDbArtwork(title: string): Promise<SgdbArtwork | null> {
  const gameId = await findSgdbGameId(title);
  if (!gameId) return null;
  return getSgdbArtwork(gameId);
}
