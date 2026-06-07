import { registerEvent } from "../register-event";
import { gamesSublevel, levelKeys } from "@main/level";
import { logger } from "@main/services";

const mergeDuplicateGames = async (_event: Electron.IpcMainInvokeEvent) => {
  const all = await gamesSublevel.iterator().all();
  const active = all.filter(([, g]) => !g.isDeleted);

  // Group by normalized title
  const byTitle = new Map<string, typeof active>();
  for (const entry of active) {
    const key = entry[1].title.trim().toLowerCase();
    if (!byTitle.has(key)) byTitle.set(key, []);
    byTitle.get(key)!.push(entry);
  }

  let merged = 0;

  for (const [, entries] of byTitle) {
    if (entries.length < 2) continue;

    // Prefer non-custom entry as the canonical one (has metadata)
    const canonical = entries.find(([, g]) => g.shop !== "custom") ?? entries[0];
    const duplicates = entries.filter(([k]) => k !== canonical[0]);

    const [canonicalKey, canonicalGame] = canonical;

    for (const [dupKey, dupGame] of duplicates) {
      // Merge executable path from custom entry if canonical lacks one
      const mergedGame = {
        ...canonicalGame,
        executablePath: canonicalGame.executablePath ?? dupGame.executablePath,
        launchOptions: canonicalGame.launchOptions ?? dupGame.launchOptions,
      };
      await gamesSublevel.put(canonicalKey, mergedGame);

      // Mark the duplicate as deleted
      await gamesSublevel.put(dupKey, { ...dupGame, isDeleted: true });
      merged++;
      logger.log(`Merged duplicate: "${dupGame.title}" (${dupKey}) → ${canonicalKey}`);
    }
  }

  logger.log(`mergeDuplicateGames: ${merged} duplicates removed`);
  return { merged };
};

registerEvent("mergeDuplicateGames", mergeDuplicateGames);
