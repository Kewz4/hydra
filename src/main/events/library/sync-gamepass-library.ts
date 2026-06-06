import { registerEvent } from "../register-event";
import { getGamePassCatalog } from "@main/services/xbox";
import { gamesSublevel, levelKeys, db } from "@main/level";
import { createGame } from "@main/services/library-sync";
import { logger } from "@main/services";
import type { UserPreferences } from "@types";
import { syncXboxGameAchievements } from "@main/services/achievements/get-xbox-achievements";
import { findGameByTitle } from "@main/helpers/find-game-by-title";
import { findSteamAppIdByTitle, getSteamCdnUrls } from "@main/services/steam-metadata";
import { getSteamGridDbArtwork } from "@main/services/steamgriddb";

const syncGamePassLibrary = async () => {
  const prefs = await db
    .get<string, UserPreferences | null>(levelKeys.userPreferences, {
      valueEncoding: "json",
    })
    .catch(() => null);

  if (!prefs?.xboxXstsToken || !prefs?.xboxUserHash) {
    throw new Error("Xbox account not connected. Sign in first.");
  }

  const games = await getGamePassCatalog(prefs.xboxUserHash, prefs.xboxXstsToken);

  let added = 0;

  for (const xboxGame of games) {
    const gameKey = levelKeys.game("xbox", xboxGame.productId);
    const existing = await gamesSublevel.get(gameKey).catch(() => null);
    if (existing && !existing.isDeleted) continue;

    // Check for same game from another shop — attach as alternativeShop instead of duplicating
    const titleMatch = await findGameByTitle(xboxGame.title);
    if (titleMatch) {
      const [matchKey, matchGame] = titleMatch;
      const alreadyLinked = matchGame.alternativeShops?.some(s => s.shop === "xbox" && s.objectId === xboxGame.productId);
      if (!alreadyLinked) {
        await gamesSublevel.put(matchKey, {
          ...matchGame,
          alternativeShops: [
            ...(matchGame.alternativeShops ?? []),
            { shop: "xbox", objectId: xboxGame.productId, executablePath: `msxbox://game/?productId=${xboxGame.productId}` },
          ],
        });
      }
      continue; // Don't create a duplicate entry
    }

    // Try to get high-quality art: Steam CDN first, then SteamGridDB
    let finalIconUrl: string | null = xboxGame.coverUrl ?? null;
    let finalHeroUrl: string | null = xboxGame.coverUrl ?? null;
    let finalLogoUrl: string | null = null;
    const steamAppId = await findSteamAppIdByTitle(xboxGame.title).catch(() => null);
    if (steamAppId) {
      const cdnUrls = getSteamCdnUrls(steamAppId);
      finalHeroUrl = cdnUrls.heroImageUrl;
      finalIconUrl = cdnUrls.iconUrl;
    } else {
      const sgdb = await getSteamGridDbArtwork(xboxGame.title).catch(() => null);
      if (sgdb) {
        finalIconUrl = sgdb.gridUrl ?? finalIconUrl;
        finalHeroUrl = sgdb.heroUrl ?? finalHeroUrl;
        finalLogoUrl = sgdb.logoUrl;
      }
    }

    const game = {
      title: xboxGame.title,
      iconUrl: finalIconUrl,
      libraryHeroImageUrl: finalHeroUrl,
      logoImageUrl: finalLogoUrl,
      objectId: xboxGame.productId,
      shop: "xbox" as const,
      remoteId: null,
      isDeleted: false,
      playTimeInMilliseconds: 0,
      lastTimePlayed: null,
      addedToLibraryAt: new Date(),
      automaticCloudSync: true,
      executablePath: `msxbox://game/?productId=${xboxGame.productId}`,
      xboxTitleId: xboxGame.titleId ?? null,
    } as any;

    await gamesSublevel.put(gameKey, game);
    await createGame(game).catch(() => {});
    added++;

    // Sync achievements for this game if titleId is available
    if (xboxGame.titleId) {
      syncXboxGameAchievements(xboxGame.productId, xboxGame.titleId).catch(() => {});
    }
  }

  logger.log(`Xbox Game Pass sync complete: ${added} games added`);
  return { total: games.length, added };
};

registerEvent("syncGamePassLibrary", syncGamePassLibrary);
