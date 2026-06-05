import { registerEvent } from "../register-event";
import { db, gamesShopAssetsSublevel, gamesSublevel, levelKeys } from "@main/level";
import type { UserPreferences } from "@types";
import { getSteamOwnedGames } from "@main/services/steam-account";
import { createGame } from "@main/services/library-sync";
import { logger } from "@main/services";

const syncSteamLibrary = async (
  _event: Electron.IpcMainInvokeEvent,
  steamId: string,
  apiKey: string
) => {
  const ownedGames = await getSteamOwnedGames(steamId, apiKey);

  let added = 0;

  for (const ownedGame of ownedGames) {
    const objectId = String(ownedGame.appid);
    const gameKey = levelKeys.game("steam", objectId);

    const existing = await gamesSublevel.get(gameKey).catch(() => null);

    if (existing && !existing.isDeleted) continue;

    const gameAssets = await gamesShopAssetsSublevel
      .get(gameKey)
      .catch(() => null);

    const executablePath = `steam://run/${objectId}`;

    const game = {
      title: ownedGame.name,
      iconUrl: ownedGame.img_icon_url
        ? `https://media.steampowered.com/steamcommunity/public/images/apps/${objectId}/${ownedGame.img_icon_url}.jpg`
        : (gameAssets?.iconUrl ?? null),
      libraryHeroImageUrl:
        gameAssets?.libraryHeroImageUrl ??
        `https://cdn.akamai.steamstatic.com/steam/apps/${objectId}/library_hero.jpg`,
      logoImageUrl: gameAssets?.logoImageUrl ?? null,
      objectId,
      shop: "steam" as const,
      remoteId: null,
      isDeleted: false,
      playTimeInMilliseconds: ownedGame.playtime_forever * 60 * 1000,
      lastTimePlayed: null,
      addedToLibraryAt: new Date(),
      executablePath,
    };

    await gamesSublevel.put(gameKey, game);
    await createGame(game).catch(() => {});

    added++;
  }

  logger.log(`Steam library sync complete: ${added} games added`);

  return { total: ownedGames.length, added };
};

registerEvent("syncSteamLibrary", syncSteamLibrary);
