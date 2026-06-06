import { registerEvent } from "../register-event";
import { gamesShopAssetsSublevel, gamesSublevel, levelKeys } from "@main/level";
import { getSteamOwnedGames } from "@main/services/steam-account";
import { createGame } from "@main/services/library-sync";
import { logger } from "@main/services";
import { getSteamGridDbArtwork } from "@main/services/steamgriddb";


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
      automaticCloudSync: true,
      executablePath,
    };

    await gamesSublevel.put(gameKey, game);
    await createGame(game).catch(() => {});

    // Fetch SGDB artwork in background for new games that don't have a hero yet
    setImmediate(async () => {
      try {
        const hasHero = gameAssets?.libraryHeroImageUrl || gameAssets?.coverImageUrl;
        if (!hasHero) {
          const sgdb = await getSteamGridDbArtwork(ownedGame.name).catch(() => null);
          if (sgdb) {
            await gamesShopAssetsSublevel.put(gameKey, {
              ...(gameAssets ?? {}),
              objectId,
              shop: "steam" as const,
              title: ownedGame.name,
              iconUrl: gameAssets?.iconUrl ?? null,
              coverImageUrl: sgdb.gridUrl ?? gameAssets?.coverImageUrl ?? null,
              libraryHeroImageUrl: sgdb.heroUrl ?? gameAssets?.libraryHeroImageUrl ?? null,
              libraryImageUrl: gameAssets?.libraryImageUrl ?? null,
              logoImageUrl: sgdb.logoUrl ?? gameAssets?.logoImageUrl ?? null,
              logoPosition: gameAssets?.logoPosition ?? null,
              downloadSources: gameAssets?.downloadSources ?? [],
              updatedAt: Date.now(),
            });
          }
        }
      } catch {
        // Non-fatal
      }
    });

    added++;
  }

  logger.log(`Steam library sync complete: ${added} games added`);

  return { total: ownedGames.length, added };
};

registerEvent("syncSteamLibrary", syncSteamLibrary);
