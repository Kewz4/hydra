import { registerEvent } from "../register-event";
import { getGamePassCatalog } from "@main/services/xbox";
import { gamesSublevel, levelKeys } from "@main/level";
import { createGame } from "@main/services/library-sync";
import { logger } from "@main/services";

const syncGamePassLibrary = async () => {
  const games = await getGamePassCatalog();

  let added = 0;

  for (const xboxGame of games) {
    const gameKey = levelKeys.game("xbox", xboxGame.productId);
    const existing = await gamesSublevel.get(gameKey).catch(() => null);
    if (existing && !existing.isDeleted) continue;

    const game = {
      title: xboxGame.title,
      iconUrl: xboxGame.coverUrl ?? null,
      libraryHeroImageUrl: xboxGame.coverUrl ?? null,
      logoImageUrl: null,
      objectId: xboxGame.productId,
      shop: "xbox" as const,
      remoteId: null,
      isDeleted: false,
      playTimeInMilliseconds: 0,
      lastTimePlayed: null,
      addedToLibraryAt: new Date(),
      executablePath: `msxbox://game/?productId=${xboxGame.productId}`,
    };

    await gamesSublevel.put(gameKey, game);
    await createGame(game).catch(() => {});
    added++;
  }

  logger.log(`Xbox Game Pass sync complete: ${added} games added`);
  return { total: games.length, added };
};

registerEvent("syncGamePassLibrary", syncGamePassLibrary);
