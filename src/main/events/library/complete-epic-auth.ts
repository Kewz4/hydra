import { registerEvent } from "../register-event";
import {
  authenticateLegendary,
  findLegendaryBinary,
  downloadLegendary,
  getLegendaryStatus,
} from "@main/services/legendary";
import { db, levelKeys } from "@main/level";
import type { UserPreferences } from "@types";
import { logger } from "@main/services";

const completeEpicAuth = async (
  _event: Electron.IpcMainInvokeEvent,
  code: string
): Promise<{ success: boolean; account?: string }> => {
  const prefs = await db
    .get<string, UserPreferences | null>(levelKeys.userPreferences, {
      valueEncoding: "json",
    })
    .catch(() => null);

  try {
    let binary = findLegendaryBinary(prefs?.legendaryBinaryPath);
    if (!binary) {
      logger.log("legendary not found — downloading before auth...");
      binary = await downloadLegendary();
    }

    await authenticateLegendary(code, binary);
    let status = await getLegendaryStatus(binary);
    for (let i = 0; i < 5 && !status.account; i++) {
      await new Promise((r) => setTimeout(r, 600));
      status = await getLegendaryStatus(binary);
    }
    return { success: true, account: status.account ?? "Epic Games" };
  } catch (err) {
    logger.error("legendary auth --code failed", err);
    return { success: false };
  }
};

registerEvent("completeEpicAuth", completeEpicAuth);
