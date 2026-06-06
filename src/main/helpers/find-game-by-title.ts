import { gamesSublevel } from "@main/level";
import type { Game } from "@types";

/** Find an existing library game by exact title (case-insensitive). Returns [key, game] or null. */
export async function findGameByTitle(title: string): Promise<[string, Game] | null> {
  const normalized = title.trim().toLowerCase();
  const all = await gamesSublevel.entries().all();
  for (const [key, game] of all) {
    if (game.title.trim().toLowerCase() === normalized && !game.isDeleted) {
      return [key, game];
    }
  }
  return null;
}
