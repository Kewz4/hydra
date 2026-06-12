import type { GameShop } from "@types";

export type GameOrigin = "sync" | "catalog" | "custom";

interface OriginSource {
  shop: GameShop;
  libraryOrigin?: GameOrigin;
}

/**
 * Classify how a game entered the library.
 * - "sync": owned on a connected platform (Steam/Epic/GOG/Xbox/Battle.net etc.)
 * - "custom": added manually via "Add custom game" or deep scan
 * - "catalog": downloaded via repack from inside GameHub (Retigga)
 *
 * Games added from the Hydra repack catalogue always get libraryOrigin: "catalog"
 * stamped at add time. Platform syncs stamp "sync". Custom additions stamp "custom"
 * or use shop: "custom". Legacy records without libraryOrigin but with a known
 * platform shop are treated as "sync" — they predate the stamp and were never
 * catalogue repacks.
 */
export function getGameOrigin(game: OriginSource): GameOrigin {
  if (game.libraryOrigin) return game.libraryOrigin;
  if (game.shop === "custom") return "custom";
  // Non-custom shops (steam, epic, gog, etc.) without an explicit libraryOrigin
  // are always platform-owned games. Only Hydra catalogue repacks have the
  // "catalog" libraryOrigin stamp, so anything without it is "sync".
  return "sync";
}
