import { registerEvent } from "../register-event";
import { db, levelKeys } from "@main/level";
import type { UserPreferences } from "@types";
import {
  getLegendaryStatus,
  findLegendaryBinary,
} from "@main/services/legendary";

const getLegendaryStatusHandler = async (
  _event: Electron.IpcMainInvokeEvent
) => {
  const prefs = await db
    .get<string, UserPreferences | null>(levelKeys.userPreferences, {
      valueEncoding: "json",
    })
    .catch(() => null);

  const binary = prefs?.legendaryBinaryPath || findLegendaryBinary();

  return {
    binaryFound: Boolean(binary),
    binaryPath: binary ?? null,
    ...(await getLegendaryStatus(binary)),
  };
};

registerEvent("getLegendaryStatus", getLegendaryStatusHandler);
