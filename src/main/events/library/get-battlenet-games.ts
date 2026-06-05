import { registerEvent } from "../register-event";
import {
  BATTLENET_GAMES,
  detectInstalledBattleNetGames,
  isBattleNetInstalled,
} from "@main/services/battlenet";

const getBattleNetGames = async (_event: Electron.IpcMainInvokeEvent) => {
  return {
    installed: isBattleNetInstalled(),
    detected: detectInstalledBattleNetGames(),
    all: BATTLENET_GAMES,
  };
};

registerEvent("getBattleNetGames", getBattleNetGames);
