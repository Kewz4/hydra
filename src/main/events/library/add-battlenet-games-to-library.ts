import { registerEvent } from "../register-event";
import { gamesSublevel, levelKeys } from "@main/level";
import { BATTLENET_GAMES } from "@main/services/battlenet";
import { createGame } from "@main/services/library-sync";
import { logger } from "@main/services";

const addBattleNetGamesToLibrary = async (
  _event: Electron.IpcMainInvokeEvent,
  productCodes: string[]
) => {
  let added = 0;

  for (const code of productCodes) {
    const def = BATTLENET_GAMES.find((g) => g.productCode === code);
    if (!def) continue;

    const objectId = def.productCode;
    const gameKey = levelKeys.game("battlenet", objectId);

    const existing = await gamesSublevel.get(gameKey).catch(() => null);
    if (existing && !existing.isDeleted) continue;

    const game = {
      title: def.title,
      iconUrl: def.iconUrl,
      libraryHeroImageUrl: def.iconUrl,
      logoImageUrl: null,
      objectId,
      shop: "battlenet" as const,
      remoteId: null,
      isDeleted: false,
      playTimeInMilliseconds: 0,
      lastTimePlayed: null,
      addedToLibraryAt: new Date(),
      executablePath: def.launchUri,
    };

    await gamesSublevel.put(gameKey, game);
    await createGame(game).catch(() => {});
    added++;
  }

  logger.log(`Battle.net: ${added} games added to library`);
  return { added };
};

registerEvent("addBattleNetGamesToLibrary", addBattleNetGamesToLibrary);
