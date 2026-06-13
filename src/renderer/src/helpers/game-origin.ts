import type { GameShop } from "@types";

export type GameOrigin = "sync" | "catalog" | "custom";

/**
 * Executable URI schemes that only a platform launcher ever produces. Their
 * presence is hard proof the game is owned on (and launched through) that
 * platform — a repack/custom game always has a real filesystem path instead.
 */
const PLATFORM_SCHEMES = [
  "steam://",
  "legendary://",
  "com.epicgames.launcher://",
  "goggalaxy://",
  "goglauncher://",
  "msxbox://",
  "battlenet://",
  "origin2://",
  "uplay://",
  "riot://",
];

interface OriginSource {
  shop: GameShop;
  libraryOrigin?: GameOrigin | null;
  executablePath?: string | null;
  /** A GameHub repack/torrent download record, when one exists. */
  download?: unknown | null;
}

const hasPlatformUriExe = (exe?: string | null): boolean => {
  if (!exe) return false;
  const normalized = exe.toLowerCase();
  return PLATFORM_SCHEMES.some((scheme) => normalized.startsWith(scheme));
};

/**
 * Classify how a game entered the library, for the per-store library tabs.
 *
 * Design goal (hard requirement): a game that is owned on / synced from ANY
 * official store must NEVER appear under the Retigga (catalogue) tab, and a
 * GameHub repack must never leak into a platform tab. Because `libraryOrigin`
 * is a single mutable field that several import paths fail to stamp (Steam
 * free-to-play titles, cloud-profile imports, legacy pre-stamp records), we do
 * NOT trust its absence. Instead we resolve from the strongest signals first:
 *
 *   1. custom shop / explicit "custom" stamp           → "custom"
 *   2. explicit "sync" stamp OR a platform-URI exe     → "sync"   (owned wins)
 *   3. a GameHub download record                       → "catalog" (it's a repack)
 *   4. explicit "catalog" stamp                        → "catalog"
 *   5. anything else on an official-store shop         → "sync"
 *
 * Step 5 is the key correction: an unstamped game on a real store shop with no
 * repack download is overwhelmingly an owned title whose sync stamp was never
 * written — so we treat it as owned rather than dumping it into Retigga.
 * Catalogue adds always carry an explicit "catalog" stamp (set when the game is
 * added from the catalogue) or a download record, so they are caught by 3/4.
 */
export function getGameOrigin(game: OriginSource): GameOrigin {
  // 1. Manually added games.
  if (game.shop === "custom" || game.libraryOrigin === "custom") {
    return "custom";
  }

  // 2. Ownership on a connected platform always wins over everything else.
  if (game.libraryOrigin === "sync") return "sync";
  if (hasPlatformUriExe(game.executablePath)) return "sync";

  // 3. A GameHub download record is the defining signal of a Retigga repack.
  if (game.download != null) return "catalog";

  // 4. Explicitly added from the catalogue but not yet downloaded.
  if (game.libraryOrigin === "catalog") return "catalog";

  // 5. Unstamped, no repack download, on an official-store shop → owned.
  return "sync";
}
