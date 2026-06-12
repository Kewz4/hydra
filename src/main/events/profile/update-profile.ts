import { registerEvent } from "../register-event";
import { HydraApi } from "@main/services";
import type { UpdateProfileRequest, UserProfile } from "@types";
import { omit } from "lodash-es";
import { UploadcareSync } from "@main/services/uploadcare-sync";
import { invalidateProfileImagesCache } from "./get-profile-images";
import { db, levelKeys } from "@main/level";
import type { UserPreferences } from "@types";
import { app } from "electron";
import fs from "node:fs";
import path from "node:path";

export const patchUserProfile = async (updateProfile: UpdateProfileRequest) => {
  return HydraApi.patch<UserProfile>("/profile", updateProfile);
};

const updateProfile = async (
  _event: Electron.IpcMainInvokeEvent,
  updateProfile: UpdateProfileRequest
) => {
  const payload = omit(updateProfile, [
    "profileImageUrl",
    "backgroundImageUrl",
  ]);

  const prefUpdates: Partial<UserPreferences> = {};

  const me = await HydraApi.get<UserProfile>("/profile/me").catch(() => null);

  // Persist a permanent local copy so the profile renders instantly and
  // offline; falls back to the Uploadcare CDN URL if the copy fails.
  const copyToProfileAssets = (
    sourcePath: string,
    fileName: string
  ): string | null => {
    try {
      const profileAssetsDir = path.join(
        app.getPath("userData"),
        "profile-assets"
      );
      fs.mkdirSync(profileAssetsDir, { recursive: true });
      const destPath = path.join(profileAssetsDir, fileName);
      fs.copyFileSync(sourcePath, destPath);
      return destPath;
    } catch {
      return null;
    }
  };

  if (updateProfile.profileImageUrl !== undefined) {
    if (updateProfile.profileImageUrl === null) {
      payload["profileImageUrl"] = null;
      prefUpdates.localProfileImageUrl = null;
    } else {
      // Upload to Uploadcare tagged with the account id so any GameHub
      // client (including other users viewing this profile) can find it.
      const uploadcareUrl = await UploadcareSync.uploadImage(
        updateProfile.profileImageUrl,
        me?.id
          ? { kind: "profile-avatar", hydraUserId: me.id }
          : { kind: "profile-avatar" }
      ).catch(() => undefined);
      payload["profileImageUrl"] = uploadcareUrl ?? null;
      prefUpdates.localProfileImageUrl =
        copyToProfileAssets(updateProfile.profileImageUrl, "avatar.webp") ??
        uploadcareUrl ??
        null;
    }
  }

  if (updateProfile.backgroundImageUrl !== undefined) {
    if (updateProfile.backgroundImageUrl === null) {
      payload["backgroundImageUrl"] = null;
      prefUpdates.localBackgroundImageUrl = null;
    } else {
      // Tag with the Hydra account id so any install can restore the banner
      const uploadcareUrl = await UploadcareSync.uploadImage(
        updateProfile.backgroundImageUrl,
        me?.id
          ? { kind: "profile-banner", hydraUserId: me.id }
          : { kind: "profile-banner" }
      ).catch(() => undefined);
      payload["backgroundImageUrl"] = uploadcareUrl ?? null;
      prefUpdates.localBackgroundImageUrl =
        copyToProfileAssets(
          updateProfile.backgroundImageUrl,
          "banner.webp"
        ) ??
        uploadcareUrl ??
        null;
    }
  }

  if (me?.id) invalidateProfileImagesCache(me.id);

  // Persist URLs locally so they survive even if HydraAPI rejects them.
  if (Object.keys(prefUpdates).length > 0) {
    const prefs = await db
      .get<string, UserPreferences>(levelKeys.userPreferences, {
        valueEncoding: "json",
      })
      .catch(() => ({}) as UserPreferences);
    await db.put(
      levelKeys.userPreferences,
      { ...prefs, ...prefUpdates },
      { valueEncoding: "json" }
    );
  }

  // Best-effort HydraAPI sync — ignore errors (backend may reject ucarecdn.com).
  // Fall back to current profile from server to avoid corrupting Redux state.
  return patchUserProfile(payload).catch(async () => {
    return HydraApi.get<UserProfile>("/profile/me").catch(() => ({}) as UserProfile);
  }) as Promise<UserProfile>;
};

registerEvent("updateProfile", updateProfile);
