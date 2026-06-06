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

const syncGogLibrary = async (_event: Electron.IpcMainInvokeEvent) => {
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

        const iconUrl = details.images?.logo2x
          ? `https:${details.images.logo2x}`
          : null;
        const heroUrl = details.images?.background
          ? `https:${details.images.background}`
          : null;

        const game = {
          title: details.title,
          iconUrl,
          libraryHeroImageUrl: heroUrl,
          logoImageUrl: null,
          objectId,
          shop: "gog" as const,
          remoteId: null,
          isDeleted: false,
          playTimeInMilliseconds: 0,
          lastTimePlayed: null,
          addedToLibraryAt: new Date(),
          executablePath: `goggalaxy://openGame/${objectId}`,
        };

        await gamesSublevel.put(gameKey, game);
        await createGame(game).catch(() => {});
        added++;
      })
    );
  }

  logger.log(`GOG library sync complete: ${added} games added`);
  return { total: ownedIds.length, added };
};

registerEvent("syncGogLibrary", syncGogLibrary);
