import type { GameShop } from "@types";

export type GameOrigin = "sync" | "catalog" | "custom";

const PLATFORM_SCHEMES = [
  "steam://",
  "legendary://",
  "goggalaxy://",
  "msxbox://",
  "battlenet://",
  "origin2://",
  "uplay://",
];

interface OriginSource {
  shop: GameShop;
  libraryOrigin?: GameOrigin;
  executablePath?: string | null;
}

/**
 * Classify how a game entered the library.
 * - "sync": owned on a connected platform (Steam/Epic/GOG/Xbox/…)
 * - "custom": added manually via "Add custom game" or found by a disk scan
 *   outside official store folders
 * - "catalog": added from the Hydra repack catalogue (Retigga)
 *
 * The libraryOrigin stamp is the source of truth: platform syncs stamp
 * "sync" (and repair legacy entries on every sync), catalogue adds stamp
 * "catalog", custom adds and non-store scans stamp "custom". For legacy
 * records without a stamp, only a platform URI-scheme exe proves ownership —
 * a real file path can just as well be a repack install, so everything else
 * falls back to "catalog" rather than leaking into the platform tabs.
 */
export function getGameOrigin(game: OriginSource): GameOrigin {
  if (game.libraryOrigin) return game.libraryOrigin;
  if (game.shop === "custom") return "custom";
  const exe = game.executablePath;
  if (exe && PLATFORM_SCHEMES.some((scheme) => exe.startsWith(scheme))) {
    return "sync";
  }
  return "catalog";
}
