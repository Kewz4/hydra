import { registerEvent } from "../register-event";
import type { GameShop } from "@types";
import { Ludusavi, Wine, logger } from "@main/services";
import { gamesSublevel, gamesShopAssetsSublevel, levelKeys } from "@main/level";

const getGameBackupPreview = async (
  _event: Electron.IpcMainInvokeEvent,
  objectId: string,
  shop: GameShop
) => {
  const gameKey = levelKeys.game(shop, objectId);
  const game = await gamesSublevel.get(gameKey).catch(() => null);
  const assets = await gamesShopAssetsSublevel.get(gameKey).catch(() => null);
  const gameTitle = game?.title ?? assets?.title ?? null;

  if (!gameTitle) {
    logger.warn(
      `[getGameBackupPreview] No title found for ${shop}:${objectId}`
    );
    return null;
  }

  return Ludusavi.getBackupPreview(
    shop,
    gameTitle,
    objectId,
    Wine.getEffectivePrefixPath(game?.winePrefixPath, objectId)
  );
};

registerEvent("getGameBackupPreview", getGameBackupPreview);
