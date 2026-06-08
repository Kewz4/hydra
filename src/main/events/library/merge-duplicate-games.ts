import { registerEvent } from "../register-event";
import { gamesSublevel } from "@main/level";
import { logger, WindowManager } from "@main/services";
import { deduplicateTitle } from "@main/helpers/deduplicate-title";
import { normalizeGameTitle } from "@main/helpers/normalize-game-title";

const mergeDuplicateGames = async (_event: Electron.IpcMainInvokeEvent) => {
  const all = await gamesSublevel.values().all();
  const active = all.filter((g) => !g.isDeleted);

  // Group by NORMALIZED title so fuzzy-matching catches edition variants
  // (e.g. "The Witcher: Enhanced Edition" and "The Witcher: Enhanced Edition Director's Cut"
  //  both normalize to the same base title and are treated as the same game)
  const byNormalized = new Map<string, typeof active>();
  for (const game of active) {
    const key = normalizeGameTitle(game.title);
    const bucket = byNormalized.get(key) ?? [];
    bucket.push(game);
    byNormalized.set(key, bucket);
  }

  const duplicateBuckets = [...byNormalized.values()].filter((b) => b.length > 1);
  const total = duplicateBuckets.length;
  let current = 0;
  let merged = 0;
  const mergedTitles: string[] = [];

  WindowManager.sendToAppWindows("on-dedup-progress", { current, total, title: null });

  for (const bucket of duplicateBuckets) {
    current++;
    const representativeTitle = bucket[0].title;
    WindowManager.sendToAppWindows("on-dedup-progress", {
      current,
      total,
      title: representativeTitle,
    });

    await deduplicateTitle(representativeTitle).catch((err) => {
      logger.warn(`mergeDuplicateGames: dedup failed for "${representativeTitle}"`, err);
    });
    merged += bucket.length - 1;
    mergedTitles.push(representativeTitle);
    logger.log(`Merged ${bucket.length - 1} duplicate(s) for "${representativeTitle}"`);
  }

  WindowManager.sendToAppWindows("on-dedup-progress", { current: total, total, title: null, done: true });
  logger.log(`mergeDuplicateGames: ${merged} duplicates removed`);
  return { merged, mergedTitles };
};

registerEvent("mergeDuplicateGames", mergeDuplicateGames);
