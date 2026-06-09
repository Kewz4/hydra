import { registerEvent } from "../register-event";
import { exchangeGogCode } from "@main/services/gog-account";
import { logger } from "@main/services";

const completeGogAuth = async (
  _event: Electron.IpcMainInvokeEvent,
  code: string
): Promise<{ refresh_token: string; username: string } | null> => {
  try {
    const tokens = await exchangeGogCode(code);
    return { refresh_token: tokens.refresh_token, username: tokens.username };
  } catch (err) {
    logger.error("completeGogAuth failed", err);
    return null;
  }
};

registerEvent("completeGogAuth", completeGogAuth);
