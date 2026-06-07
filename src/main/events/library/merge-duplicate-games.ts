import { registerEvent } from "../register-event";
import { gamesSublevel } from "@main/level";
import { logger } from "@main/services";
import { deduplicateTitle } from "@main/helpers/deduplicate-title";

const mergeDuplicateGames = async (_event: Electron.IpcMainInvokeEvent) => {
  const all = await gamesSublevel.values().all();
  const active = all.filter((g) => !g.isDeleted);

  // Collect unique titles
  const seenTitles = new Set<string>();
  for (const game of active) {
    seenTitles.add(game.title.trim().toLowerCase());
  }

  let merged = 0;

  for (const normalizedTitle of seenTitles) {
    // Find any title with duplicates by running deduplicateTitle on representative
    const representativeTitle = active.find(
      (g) => g.title.trim().toLowerCase() === normalizedTitle
    )?.title;
    if (!representativeTitle) continue;

    const countBefore = active.filter(
      (g) => g.title.trim().toLowerCase() === normalizedTitle
    ).length;

    if (countBefore > 1) {
      await deduplicateTitle(representativeTitle).catch((err) => {
        logger.warn(`mergeDuplicateGames: dedup failed for "${representativeTitle}"`, err);
      });
      merged += countBefore - 1;
      logger.log(`Merged ${countBefore - 1} duplicate(s) for "${representativeTitle}"`);
    }
  }

  logger.log(`mergeDuplicateGames: ${merged} duplicates removed`);
  return { merged };
};

registerEvent("mergeDuplicateGames", mergeDuplicateGames);
