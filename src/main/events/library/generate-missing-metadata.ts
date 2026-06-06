import { registerEvent } from "../register-event";
import { gamesSublevel, gamesShopAssetsSublevel, levelKeys } from "@main/level";
import { getSteamGridDbArtwork } from "@main/services/steamgriddb";
import { logger } from "@main/services";

const generateMissingMetadata = async (_event: Electron.IpcMainInvokeEvent) => {
  const allGames = await gamesSublevel.values().all();
  const games = allGames.filter((g) => !g.isDeleted);

  let updated = 0;
  let skipped = 0;

  for (const game of games) {
    const cacheKey = levelKeys.game(game.shop, game.objectId);
    const assets = await gamesShopAssetsSublevel.get(cacheKey).catch(() => null);

    const hasCover =
      assets?.coverImageUrl || assets?.libraryHeroImageUrl || assets?.iconUrl;

    if (hasCover) {
      skipped++;
      continue;
    }

    try {
      const sgdb = await getSteamGridDbArtwork(game.title).catch(() => null);
      if (!sgdb) {
        skipped++;
        continue;
      }

      await gamesShopAssetsSublevel.put(cacheKey, {
        ...(assets ?? {}),
        objectId: game.objectId,
        shop: game.shop,
        title: game.title,
        iconUrl: sgdb.gridUrl ?? assets?.iconUrl ?? null,
        coverImageUrl: sgdb.gridUrl ?? assets?.coverImageUrl ?? null,
        libraryHeroImageUrl: sgdb.heroUrl ?? assets?.libraryHeroImageUrl ?? null,
        libraryImageUrl: assets?.libraryImageUrl ?? null,
        logoImageUrl: sgdb.logoUrl ?? assets?.logoImageUrl ?? null,
        logoPosition: assets?.logoPosition ?? null,
        downloadSources: assets?.downloadSources ?? [],
        updatedAt: Date.now(),
      });

      updated++;
    } catch (err) {
      logger.warn(`generateMissingMetadata: failed for "${game.title}"`, err);
      skipped++;
    }
  }

  logger.log(`generateMissingMetadata: ${updated} updated, ${skipped} skipped`);
  return { updated, skipped };
};

registerEvent("generateMissingMetadata", generateMissingMetadata);
