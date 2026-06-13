import { registerEvent } from "../register-event";
import { db, levelKeys } from "@main/level";
import { HydraApi } from "@main/services/hydra-api";
import { logger } from "@main/services";
import { WindowManager } from "@main/services/window-manager";
import type { UserPreferences } from "@types";
import type { SettingsBackup } from "./backup-settings-to-cloud";

const restoreSettingsFromCloud = async (): Promise<{ restored: boolean; updatedAt?: string }> => {
  try {
    const backup = await HydraApi.get<SettingsBackup>(
      "/profile/settings-backup",
      { needsAuth: true }
    );

    if (!backup?.preferences && !backup?.excludedGames?.length) {
      return { restored: false };
    }

    const existing = await db
      .get<string, UserPreferences | null>(levelKeys.userPreferences, {
        valueEncoding: "json",
      })
      .catch(() => null);

    const merged: UserPreferences = {
      ...(existing ?? {}),
      ...backup.preferences,
      // Merge exclusion lists — keep local entries not in the backup
      excludedGames: mergeExclusionLists(
        existing?.excludedGames ?? [],
        backup.excludedGames ?? []
      ),
    };

    await db.put<string, UserPreferences>(levelKeys.userPreferences, merged, {
      valueEncoding: "json",
    });

    WindowManager.sendToAppWindows("on-user-preferences-updated", merged);
    logger.info("[SettingsSync] Settings restored from cloud backup");
    return { restored: true, updatedAt: backup.updatedAt };
  } catch (err) {
    logger.warn("[SettingsSync] Cloud restore failed (no backup yet?)", err);
    return { restored: false };
  }
};

function mergeExclusionLists(
  local: Array<{ shop: string; objectId: string; title: string; excludedAt: string }>,
  remote: Array<{ shop: string; objectId: string; title: string; excludedAt: string }>
) {
  const map = new Map<string, (typeof local)[0]>();
  for (const entry of local) map.set(`${entry.shop}:${entry.objectId}`, entry);
  for (const entry of remote) map.set(`${entry.shop}:${entry.objectId}`, entry);
  return Array.from(map.values());
}

registerEvent("restoreSettingsFromCloud", restoreSettingsFromCloud);

export { restoreSettingsFromCloud as restoreSettingsFromCloudInternal };
