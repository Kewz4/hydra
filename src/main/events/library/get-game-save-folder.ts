import { registerEvent } from "../register-event";
import type { GameShop } from "@types";
import { Ludusavi, logger } from "@main/services";
import { gamesSublevel, gamesShopAssetsSublevel, levelKeys } from "@main/level";
import path from "node:path";

const getGameSaveFolder = async (
  _event: Electron.IpcMainInvokeEvent,
  shop: GameShop,
  objectId: string
): Promise<string | null> => {
  try {
    const gameKey = levelKeys.game(shop, objectId);

    // Resolve the game title — ludusavi's manifest is keyed by title, not objectId
    const game = await gamesSublevel.get(gameKey).catch(() => null);
    const assets = await gamesShopAssetsSublevel.get(gameKey).catch(() => null);
    const gameTitle = game?.title ?? assets?.title ?? null;

    if (!gameTitle) {
      logger.warn(
        `[getGameSaveFolder] No title found for ${shop}:${objectId}, cannot query ludusavi`
      );
      return null;
    }

    const backupPreview = await Ludusavi.getBackupPreview(
      shop,
      gameTitle,
      objectId,
      null
    );

    if (!backupPreview) {
      return null;
    }

    // ludusavi keys results by the title we passed in
    const gameData = backupPreview.games[gameTitle];
    if (!gameData?.files) {
      return null;
    }

    const filePaths = Object.keys(gameData.files);
    if (filePaths.length === 0) {
      return null;
    }

    return path.dirname(filePaths[0]);
  } catch (error) {
    logger.error("[getGameSaveFolder] Error getting save folder:", error);
    return null;
  }
};

registerEvent("getGameSaveFolder", getGameSaveFolder);
