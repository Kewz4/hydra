import { registerEvent } from "../register-event";
import { gamesShopAssetsSublevel, gamesSublevel, levelKeys } from "@main/level";
import { getSteamOwnedGames } from "@main/services/steam-account";
import { createGame } from "@main/services/library-sync";
import { logger } from "@main/services";
import { fetchBestAssets } from "@main/helpers/fetch-best-assets";


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
    const steamIconUrl = ownedGame.img_icon_url
      ? `https://media.steampowered.com/steamcommunity/public/images/apps/${objectId}/${ownedGame.img_icon_url}.jpg`
      : null;
    const steamHeroUrl = `https://cdn.akamai.steamstatic.com/steam/apps/${objectId}/library_hero.jpg`;

    // Fetch best assets in background so sync is not blocked
    setImmediate(async () => {
      try {
        const assets = await fetchBestAssets("steam", objectId, ownedGame.name, {
          iconUrl: steamIconUrl,
          libraryHeroImageUrl: gameAssets?.libraryHeroImageUrl ?? steamHeroUrl,
          libraryImageUrl: gameAssets?.libraryImageUrl ?? null,
          coverImageUrl: gameAssets?.coverImageUrl ?? steamIconUrl,
          logoImageUrl: gameAssets?.logoImageUrl ?? null,
          logoPosition: gameAssets?.logoPosition ?? null,
          downloadSources: gameAssets?.downloadSources ?? [],
        });
        await gamesShopAssetsSublevel.put(gameKey, {
          objectId,
          shop: "steam" as const,
          title: ownedGame.name,
          ...assets,
          updatedAt: Date.now(),
        });
      } catch {
        // Non-fatal
      }
    });

    const game = {
      title: ownedGame.name,
      iconUrl: steamIconUrl ?? (gameAssets?.iconUrl ?? null),
      libraryHeroImageUrl: gameAssets?.libraryHeroImageUrl ?? steamHeroUrl,
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

    added++;
  }

  logger.log(`Steam library sync complete: ${added} games added`);

  return { total: ownedGames.length, added };
};

registerEvent("syncSteamLibrary", syncSteamLibrary);
