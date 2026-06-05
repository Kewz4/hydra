import { registerEvent } from "../register-event";
import { db, gamesSublevel, levelKeys } from "@main/level";
import type { UserPreferences } from "@types";
import {
  getLegendaryGames,
  getLegendaryGameCoverUrl,
} from "@main/services/legendary";
import { createGame } from "@main/services/library-sync";
import { logger } from "@main/services";

const syncEpicLibrary = async (_event: Electron.IpcMainInvokeEvent) => {
  const prefs = await db
    .get<string, UserPreferences | null>(levelKeys.userPreferences, {
      valueEncoding: "json",
    })
    .catch(() => null);

  const games = await getLegendaryGames(prefs?.legendaryBinaryPath);

  let added = 0;

  for (const epicGame of games) {
    const objectId = epicGame.app_name;
    const gameKey = levelKeys.game("epic", objectId);

    const existing = await gamesSublevel.get(gameKey).catch(() => null);
    if (existing && !existing.isDeleted) continue;

    const coverUrl = getLegendaryGameCoverUrl(epicGame);
    const executablePath = `legendary://run/${objectId}`;

    const game = {
      title: epicGame.app_title,
      iconUrl: coverUrl,
      libraryHeroImageUrl: coverUrl,
      logoImageUrl: null,
      objectId,
      shop: "epic" as const,
      remoteId: null,
      isDeleted: false,
      playTimeInMilliseconds: 0,
      lastTimePlayed: null,
      addedToLibraryAt: new Date(),
      executablePath,
    };

    await gamesSublevel.put(gameKey, game);
    await createGame(game).catch(() => {});

    added++;
  }

  logger.log(`Epic library sync complete: ${added} games added`);
  return { total: games.length, added };
};

registerEvent("syncEpicLibrary", syncEpicLibrary);
