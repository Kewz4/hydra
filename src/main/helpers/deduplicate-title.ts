/**
 * Ensures there is exactly one library entry for a given game title.
 *
 * Canonical priority (highest wins):
 *
 *   TIER 1 — Hydra catalogue entries (any shop with a known catalogue objectId):
 *     steam   → score 20  (richest metadata: hero images, achievements, stats)
 *     epic    → score 18
 *     gog     → score 18
 *     xbox    → score 18
 *     battlenet → score 16
 *
 *   TIER 2 — Custom entries (no catalogue match, local exe only):
 *     custom  → score 1
 *
 *   Within the same score, the earliest addedToLibraryAt wins as a tiebreaker.
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
import { normalizeGameTitle } from "./normalize-game-title";

function canonicalScore(shop: Game["shop"]): number {
  switch (shop) {
    case "steam":     return 20; // Catalogue, richest Hydra API assets
    case "epic":      return 18; // Catalogue
    case "gog":       return 18; // Catalogue
    case "xbox":      return 18; // Catalogue
    case "battlenet": return 16; // Catalogue (partial)
    default:          return 1;  // custom — no catalogue match
  }
}

export async function deduplicateTitle(title: string): Promise<string | null> {
  const normalized = normalizeGameTitle(title);
  const matches: [string, Game][] = [];

  for await (const [key, game] of gamesSublevel.iterator()) {
    if (!game.isDeleted && normalizeGameTitle(game.title) === normalized) {
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
