import { registerEvent } from "../register-event";
import { db, gamesSublevel, levelKeys } from "@main/level";
import type { UserPreferences } from "@types";
import {
  refreshGogToken,
  getGogUserInfo,
  getGogOwnedGameIds,
  getGogGameDetails,
} from "@main/services/gog-account";
import { createGame } from "@main/services/library-sync";
import { logger } from "@main/services";
import { findGameByTitle } from "@main/helpers/find-game-by-title";
import { findSteamAppIdByTitle, getSteamCdnUrls } from "@main/services/steam-metadata";
import { getSteamGridDbArtwork } from "@main/services/steamgriddb";

const syncGogLibrary = async (_event: Electron.IpcMainInvokeEvent) => {
  try {
  const prefs = await db
    .get<string, UserPreferences | null>(levelKeys.userPreferences, {
      valueEncoding: "json",
    })
    .catch(() => null);

  if (!prefs?.gogRefreshToken) throw new Error("GOG not connected");

  const tokens = await refreshGogToken(prefs.gogRefreshToken);

  // Persist the potentially-refreshed token
  await db.put<string, UserPreferences>(
    levelKeys.userPreferences,
    { ...prefs, gogRefreshToken: tokens.refresh_token },
    { valueEncoding: "json" }
  );

  const ownedIds = await getGogOwnedGameIds(tokens.access_token);

  let added = 0;

  // Process in batches of 20 to avoid hammering the API
  for (let i = 0; i < ownedIds.length; i += 20) {
    const batch = ownedIds.slice(i, i + 20);

    await Promise.all(
      batch.map(async (productId) => {
        const objectId = String(productId);
        const gameKey = levelKeys.game("gog", objectId);

        const existing = await gamesSublevel.get(gameKey).catch(() => null);
        if (existing && !existing.isDeleted) return;

        const details = await getGogGameDetails(productId);
        if (!details) return;

        // Skip DLCs, packs, and non-game products
        if (details.game_type && details.game_type !== "game") return;

        // Check for same game from another shop — attach as alternativeShop instead of duplicating
        const titleMatch = await findGameByTitle(details.title);
        if (titleMatch) {
          const [matchKey, matchGame] = titleMatch;
          const alreadyLinked = matchGame.alternativeShops?.some(s => s.shop === "gog" && s.objectId === objectId);
          if (!alreadyLinked) {
            await gamesSublevel.put(matchKey, {
              ...matchGame,
              alternativeShops: [
                ...(matchGame.alternativeShops ?? []),
                { shop: "gog", objectId, executablePath: null },
              ],
            });
          }
          return; // Don't create a duplicate entry
        }

        const iconUrl = details.images?.logo2x
          ? `https:${details.images.logo2x}`
          : null;
        const heroUrl = details.images?.background
          ? `https:${details.images.background}`
          : null;

        // Try to get high-quality art: Steam CDN first, then SteamGridDB
        let finalIconUrl: string | null = iconUrl;
        let finalHeroUrl: string | null = heroUrl;
        let finalLogoUrl: string | null = null;
        const steamAppId = await findSteamAppIdByTitle(details.title).catch(() => null);
        if (steamAppId) {
          const cdnUrls = getSteamCdnUrls(steamAppId);
          finalHeroUrl = cdnUrls.heroImageUrl;
          finalIconUrl = cdnUrls.iconUrl;
        } else {
          const sgdb = await getSteamGridDbArtwork(details.title).catch(() => null);
          if (sgdb) {
            finalIconUrl = sgdb.gridUrl ?? finalIconUrl;
            finalHeroUrl = sgdb.heroUrl ?? finalHeroUrl;
            finalLogoUrl = sgdb.logoUrl;
          }
        }

        const game = {
          title: details.title,
          iconUrl: finalIconUrl,
          libraryHeroImageUrl: finalHeroUrl,
          logoImageUrl: finalLogoUrl,
          objectId,
          shop: "gog" as const,
          remoteId: null,
          isDeleted: false,
          playTimeInMilliseconds: 0,
          lastTimePlayed: null,
          addedToLibraryAt: new Date(),
      automaticCloudSync: true,
          executablePath: null,
        };

        await gamesSublevel.put(gameKey, game);
        await createGame(game).catch(() => {});
        added++;
      })
    );
  }

  logger.log(`GOG library sync complete: ${added} games added`);
  return { total: ownedIds.length, added };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("GOG library sync failed", err);
    return { total: 0, added: 0, error: message };
  }
};

registerEvent("syncGogLibrary", syncGogLibrary);
