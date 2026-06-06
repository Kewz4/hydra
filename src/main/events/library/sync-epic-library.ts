import { registerEvent } from "../register-event";
import { db, gamesSublevel, levelKeys } from "@main/level";
import type { UserPreferences } from "@types";
import {
  getLegendaryGames,
  getLegendaryGameCoverUrl,
} from "@main/services/legendary";
import { createGame } from "@main/services/library-sync";
import { logger } from "@main/services";
import { findGameByTitle } from "@main/helpers/find-game-by-title";
import { findSteamAppIdByTitle, getSteamCdnUrls } from "@main/services/steam-metadata";
import { getSteamGridDbArtwork } from "@main/services/steamgriddb";

const syncEpicLibrary = async (_event: Electron.IpcMainInvokeEvent) => {
  const prefs = await db
    .get<string, UserPreferences | null>(levelKeys.userPreferences, {
      valueEncoding: "json",
    })
    .catch(() => null);

  const games = await getLegendaryGames(prefs?.legendaryBinaryPath);

  let added = 0;

  for (const epicGame of games) {
    const objectId = epicGame.app_name;
    const gameKey = levelKeys.game("epic", objectId);

    const existing = await gamesSublevel.get(gameKey).catch(() => null);
    if (existing && !existing.isDeleted) continue;

    // Check for same game from another shop — attach as alternativeShop instead of duplicating
    const titleMatch = await findGameByTitle(epicGame.app_title);
    if (titleMatch) {
      const [matchKey, matchGame] = titleMatch;
      const alreadyLinked = matchGame.alternativeShops?.some(s => s.shop === "epic" && s.objectId === objectId);
      if (!alreadyLinked) {
        await gamesSublevel.put(matchKey, {
          ...matchGame,
          alternativeShops: [
            ...(matchGame.alternativeShops ?? []),
            { shop: "epic", objectId, executablePath: epicGame.is_installed ? `legendary://run/${objectId}` : null },
          ],
        });
      }
      continue; // Don't create a duplicate entry
    }

    const coverUrl = getLegendaryGameCoverUrl(epicGame);
    // Only set executablePath when locally installed — uninstalled games show Download
    const executablePath = epicGame.is_installed
      ? `legendary://run/${objectId}`
      : null;

    // Try to get high-quality art: Steam CDN first, then SteamGridDB
    let finalIconUrl: string | null = coverUrl;
    let finalHeroUrl: string | null = coverUrl;
    let finalLogoUrl: string | null = null;
    const steamAppId = await findSteamAppIdByTitle(epicGame.app_title).catch(() => null);
    if (steamAppId) {
      const cdnUrls = getSteamCdnUrls(steamAppId);
      finalHeroUrl = cdnUrls.heroImageUrl;
      finalIconUrl = cdnUrls.iconUrl;
    } else {
      const sgdb = await getSteamGridDbArtwork(epicGame.app_title).catch(() => null);
      if (sgdb) {
        finalIconUrl = sgdb.gridUrl ?? finalIconUrl;
        finalHeroUrl = sgdb.heroUrl ?? finalHeroUrl;
        finalLogoUrl = sgdb.logoUrl;
      }
    }

    const game = {
      title: epicGame.app_title,
      iconUrl: finalIconUrl,
      libraryHeroImageUrl: finalHeroUrl,
      logoImageUrl: finalLogoUrl,
      objectId,
      shop: "epic" as const,
      remoteId: null,
      isDeleted: false,
      playTimeInMilliseconds: 0,
      lastTimePlayed: null,
      addedToLibraryAt: new Date(),
      automaticCloudSync: true,
      executablePath,
    };

    await gamesSublevel.put(gameKey, game);
    await createGame(game).catch(() => {});

    added++;
  }

  logger.log(`Epic library sync complete: ${added} games added`);
  return { total: games.length, added };
};

registerEvent("syncEpicLibrary", syncEpicLibrary);
