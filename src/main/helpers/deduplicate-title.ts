/**
 * Ensures there is exactly one library entry for a given game title.
 *
 * Canonical priority (highest wins):
 *   1. Steam entry   — richest metadata from Hydra API
 *   2. Any non-custom entry (epic / gog / xbox)
 *   3. Custom entry  — least metadata
 *   4. Among equals, the earliest addedToLibraryAt
 *
 * The surviving entry inherits executablePath / launchOptions from any
 * duplicate that has one, so the user never loses their exe path.
 * All other duplicates are soft-deleted (isDeleted: true).
 *
 * Returns the key of the surviving (canonical) entry.
 */

import { gamesSublevel } from "@main/level";
import { logger } from "@main/services";
import type { Game } from "@types";

function canonicalScore(shop: Game["shop"]): number {
  switch (shop) {
    case "steam": return 4;
    case "epic":  return 3;
    case "gog":   return 3;
    case "xbox":  return 3;
    case "battlenet": return 2;
    default:      return 1; // custom
  }
}

export async function deduplicateTitle(title: string): Promise<string | null> {
  const normalized = title.trim().toLowerCase();
  const matches: [string, Game][] = [];

  for await (const [key, game] of gamesSublevel.iterator()) {
    if (!game.isDeleted && game.title.trim().toLowerCase() === normalized) {
      matches.push([key, game]);
    }
  }

  if (matches.length <= 1) return matches[0]?.[0] ?? null;

  // Sort: highest score first, then earliest added
  matches.sort(([, a], [, b]) => {
    const scoreDiff = canonicalScore(b.shop) - canonicalScore(a.shop);
    if (scoreDiff !== 0) return scoreDiff;
    const aTime = a.addedToLibraryAt ? new Date(a.addedToLibraryAt).getTime() : 0;
    const bTime = b.addedToLibraryAt ? new Date(b.addedToLibraryAt).getTime() : 0;
    return aTime - bTime; // earlier = lower number = preferred
  });

  const [canonicalKey, canonicalGame] = matches[0];
  const duplicates = matches.slice(1);

  // Collect the best executablePath and launchOptions from all duplicates
  let bestExePath = canonicalGame.executablePath ?? null;
  let bestLaunchOptions = canonicalGame.launchOptions ?? null;
  for (const [, dup] of duplicates) {
    if (!bestExePath && dup.executablePath) bestExePath = dup.executablePath;
    if (!bestLaunchOptions && dup.launchOptions) bestLaunchOptions = dup.launchOptions;
  }

  // Update canonical with merged executable if it lacked one
  if (
    bestExePath !== canonicalGame.executablePath ||
    bestLaunchOptions !== canonicalGame.launchOptions
  ) {
    await gamesSublevel.put(canonicalKey, {
      ...canonicalGame,
      executablePath: bestExePath,
      launchOptions: bestLaunchOptions,
    });
  }

  // Soft-delete all duplicates
  for (const [dupKey, dupGame] of duplicates) {
    await gamesSublevel.put(dupKey, { ...dupGame, isDeleted: true });
    logger.log(`deduplicateTitle: soft-deleted duplicate "${dupGame.title}" [${dupKey}] → kept [${canonicalKey}]`);
  }

  return canonicalKey;
}
