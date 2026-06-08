import { gamesSublevel } from "@main/level";
import type { Game } from "@types";
import { normalizeGameTitle } from "./normalize-game-title";

/**
 * Find an existing library game by title (case-insensitive, edition-normalized).
 * "God of War Ragnarök Deluxe Edition" matches "God of War Ragnarök".
 * Returns [key, game] or null.
 */
export async function findGameByTitle(
  title: string
): Promise<[string, Game] | null> {
  const normalized = normalizeGameTitle(title);
  for await (const [key, game] of gamesSublevel.iterator()) {
    if (!game.isDeleted && normalizeGameTitle(game.title) === normalized) {
      return [key, game];
    }
  }
  return null;
}
