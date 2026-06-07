import { registerEvent } from "../register-event";
import { gamesSublevel, gamesShopAssetsSublevel, levelKeys } from "@main/level";
import { randomUUID } from "node:crypto";
import type { GameShop, CatalogueSearchResult } from "@types";
import { HydraApi } from "@main/services";

const addCustomGameToLibrary = async (
  _event: Electron.IpcMainInvokeEvent,
  title: string,
  executablePath: string,
  iconUrl?: string,
  logoImageUrl?: string,
  libraryHeroImageUrl?: string
) => {
  const objectId = randomUUID();
  const shop: GameShop = "custom";
  const gameKey = levelKeys.game(shop, objectId);

  const existingGames = await gamesSublevel.iterator().all();
  const existingByPath = existingGames.find(
    ([_key, game]) => game.executablePath === executablePath && !game.isDeleted
  );

  if (existingByPath) {
    throw new Error(
      "A game with this executable path already exists in your library"
    );
  }

  // Check local library for a game with the same title first
  const titleLower = title.toLowerCase();
  const existingByTitle = existingGames.find(
    ([_key, game]) =>
      !game.isDeleted && game.title.toLowerCase() === titleLower
  );

  if (existingByTitle) {
    const [existingKey, existingGame] = existingByTitle;
    const mergedGame = {
      ...existingGame,
      executablePath,
      iconUrl: iconUrl || existingGame.iconUrl || null,
      logoImageUrl: logoImageUrl || existingGame.logoImageUrl || null,
      libraryHeroImageUrl:
        libraryHeroImageUrl || existingGame.libraryHeroImageUrl || null,
    };
    await gamesSublevel.put(existingKey, mergedGame);
    return mergedGame;
  }

  // Search the Hydra API catalogue by title — if found, use that entry's
  // objectId/shop so the game gets full catalogue metadata (achievements, stats, etc.)
  try {
    const catalogueResponse = await HydraApi.post<{
      edges: CatalogueSearchResult[];
      count: number;
    }>(
      "/catalogue/search",
      {
        data: {
          title,
          sortBy: "popularity",
          sortOrder: "desc",
          downloadSourceFingerprints: [],
          tags: [],
          publishers: [],
          genres: [],
          developers: [],
          protondbSupportBadges: [],
          deckCompatibility: [],
          take: 5,
          skip: 0,
        },
        needsAuth: false,
      }
    );

    const match = catalogueResponse?.edges?.find(
      (r) => r.title.toLowerCase() === titleLower
    );

    if (match) {
      const catalogueKey = levelKeys.game(match.shop, match.objectId);
      // Check if that catalogue entry already exists in the library
      const existingCatalogue = await gamesSublevel.get(catalogueKey).catch(() => null);
      if (existingCatalogue && !existingCatalogue.isDeleted) {
        // Merge exe into existing catalogue entry
        const merged = {
          ...existingCatalogue,
          executablePath,
          iconUrl: iconUrl || existingCatalogue.iconUrl || null,
          logoImageUrl: logoImageUrl || existingCatalogue.logoImageUrl || null,
          libraryHeroImageUrl:
            libraryHeroImageUrl || existingCatalogue.libraryHeroImageUrl || null,
        };
        await gamesSublevel.put(catalogueKey, merged);
        return merged;
      }
      // Create a new entry using the catalogue's objectId/shop
      const catalogueGame = {
        title: match.title,
        iconUrl: iconUrl || null,
        logoImageUrl: logoImageUrl || null,
        libraryHeroImageUrl: libraryHeroImageUrl || null,
        objectId: match.objectId,
        shop: match.shop,
        remoteId: null,
        isDeleted: false,
        playTimeInMilliseconds: 0,
        lastTimePlayed: null,
        addedToLibraryAt: new Date(),
        executablePath,
        launchOptions: null,
        favorite: false,
        automaticCloudSync: false,
        hasManuallyUpdatedPlaytime: false,
      };
      const catalogueAssets = {
        updatedAt: Date.now(),
        objectId: match.objectId,
        shop: match.shop,
        title: match.title,
        iconUrl: iconUrl || null,
        libraryHeroImageUrl: libraryHeroImageUrl || match.libraryImageUrl || "",
        libraryImageUrl: match.libraryImageUrl || iconUrl || "",
        logoImageUrl: logoImageUrl || "",
        logoPosition: null,
        coverImageUrl: match.libraryImageUrl || iconUrl || "",
        downloadSources: [],
      };
      await gamesShopAssetsSublevel.put(catalogueKey, catalogueAssets);
      await gamesSublevel.put(catalogueKey, catalogueGame);
      return catalogueGame;
    }
  } catch {
    // Catalogue search failed — fall through to custom entry creation
  }

  const assets = {
    updatedAt: Date.now(),
    objectId,
    shop,
    title,
    iconUrl: iconUrl || null,
    libraryHeroImageUrl: libraryHeroImageUrl || "",
    libraryImageUrl: iconUrl || "",
    logoImageUrl: logoImageUrl || "",
    logoPosition: null,
    coverImageUrl: iconUrl || "",
    downloadSources: [],
  };
  await gamesShopAssetsSublevel.put(gameKey, assets);

  const game = {
    title,
    iconUrl: iconUrl || null,
    logoImageUrl: logoImageUrl || null,
    libraryHeroImageUrl: libraryHeroImageUrl || null,
    objectId,
    shop,
    remoteId: null,
    isDeleted: false,
    playTimeInMilliseconds: 0,
    lastTimePlayed: null,
    addedToLibraryAt: new Date(),
    executablePath,
    launchOptions: null,
    favorite: false,
    automaticCloudSync: false,
    hasManuallyUpdatedPlaytime: false,
  };

  await gamesSublevel.put(gameKey, game);

  return game;
};

registerEvent("addCustomGameToLibrary", addCustomGameToLibrary);
