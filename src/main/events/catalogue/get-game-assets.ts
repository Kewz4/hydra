import type { GameShop, ShopAssets } from "@types";
import { registerEvent } from "../register-event";
import { HydraApi } from "@main/services";
import { gamesShopAssetsSublevel, levelKeys } from "@main/level";
import { getSteamGridDbArtwork } from "@main/services/steamgriddb";

const LOCAL_CACHE_EXPIRATION = 1000 * 60 * 60 * 8; // 8 hours

export const getGameAssets = async (objectId: string, shop: GameShop, title?: string) => {
  const cacheKey = levelKeys.game(shop, objectId);
  const cachedAssets = await gamesShopAssetsSublevel.get(cacheKey).catch(() => null);

  if (
    cachedAssets &&
    cachedAssets.updatedAt + LOCAL_CACHE_EXPIRATION > Date.now()
  ) {
    return cachedAssets;
  }

  // Steam: try HydraApi first, fall back to SteamGridDB
  if (shop === "steam") {
    const assets = await HydraApi.get<ShopAssets | null>(
      `/games/${shop}/${objectId}/assets`,
      null,
      { needsAuth: false }
    ).catch(() => null);

    if (assets) {
      const shouldPreserveTitle =
        cachedAssets?.title && cachedAssets.title !== assets.title;

      await gamesShopAssetsSublevel.put(cacheKey, {
        ...assets,
        title: shouldPreserveTitle ? cachedAssets!.title : assets.title,
        updatedAt: Date.now(),
      });
      return assets;
    }
  }

  // For all shops: try SteamGridDB using the provided title or cached title
  const searchTitle = title ?? cachedAssets?.title;
  if (!searchTitle) return cachedAssets ?? null;

  const sgdb = await getSteamGridDbArtwork(searchTitle).catch(() => null);
  if (!sgdb) return cachedAssets ?? null;

  const merged: ShopAssets = {
    ...(cachedAssets ?? {}),
    objectId,
    shop,
    title: searchTitle,
    iconUrl: sgdb.gridUrl ?? cachedAssets?.iconUrl ?? null,
    coverImageUrl: sgdb.gridUrl ?? cachedAssets?.coverImageUrl ?? null,
    libraryHeroImageUrl: sgdb.heroUrl ?? cachedAssets?.libraryHeroImageUrl ?? null,
    libraryImageUrl: cachedAssets?.libraryImageUrl ?? null,
    logoImageUrl: sgdb.logoUrl ?? cachedAssets?.logoImageUrl ?? null,
    logoPosition: cachedAssets?.logoPosition ?? null,
    downloadSources: cachedAssets?.downloadSources ?? [],
  } as ShopAssets;

  await gamesShopAssetsSublevel.put(cacheKey, {
    ...merged,
    updatedAt: Date.now(),
  });

  return merged;
};

const getGameAssetsEvent = async (
  _event: Electron.IpcMainInvokeEvent,
  objectId: string,
  shop: GameShop,
  title?: string
) => {
  return getGameAssets(objectId, shop, title);
};

registerEvent("getGameAssets", getGameAssetsEvent);
