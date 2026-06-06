import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@renderer/components";
import { useToast } from "@renderer/hooks";
import { AlertIcon, CheckCircleFillIcon, PersonIcon, SyncIcon } from "@primer/octicons-react";

interface XboxState {
  gamertag: string | null;
  hasGamePass: boolean;
}

export function SettingsXbox() {
  const { t } = useTranslation("settings");
  const { showSuccessToast, showErrorToast } = useToast();

  const [xboxState, setXboxState] = useState<XboxState | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ added: number; total: number } | null>(null);

  // Restore persisted state (gamertag + hasGamePass stored in preferences)
  useEffect(() => {
    window.electron.getUserPreferences().then((prefs: any) => {
      if (prefs?.xboxGamertag) {
        setXboxState({
          gamertag: prefs.xboxGamertag,
          hasGamePass: prefs.xboxHasGamePass ?? false,
        });
      }
    });
  }, []);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    try {
      const result = await window.electron.openXboxAuthWindow();
      if (result.success) {
        const state = {
          gamertag: result.gamertag ?? "Xbox User",
          hasGamePass: result.hasGamePass ?? false,
        };
        setXboxState(state);
        // Persist gamertag/hasGamePass to preferences for next session
        await window.electron.updateUserPreferences({
          xboxGamertag: state.gamertag,
          xboxHasGamePass: state.hasGamePass,
        } as any);
        showSuccessToast(
          result.hasGamePass
            ? t("xbox_signed_in_with_gamepass", { gamertag: state.gamertag })
            : t("xbox_signed_in_no_gamepass", { gamertag: state.gamertag })
        );
      } else {
        showErrorToast(t("xbox_auth_failed"));
      }
    } catch (err: any) {
      showErrorToast(err?.message ?? t("xbox_auth_failed"));
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    setXboxState(null);
    setSyncResult(null);
    await window.electron.updateUserPreferences({
      xboxAccessToken: null,
      xboxUserHash: null,
      xboxXstsToken: null,
      xboxTokenExpiry: null,
      xboxGamertag: null,
      xboxHasGamePass: false,
    } as any);
    showSuccessToast(t("xbox_signed_out"));
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const result = await window.electron.syncGamePassLibrary();
      setSyncResult(result);
      showSuccessToast(
        t("xbox_library_synced", { added: result.added, total: result.total })
      );
    } catch (err: any) {
      showErrorToast(err?.message ?? t("xbox_sync_failed"));
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <p style={{ margin: 0, opacity: 0.8 }}>{t("xbox_description")}</p>

      {/* Not signed in */}
      {!xboxState && (
        <Button
          type="button"
          onClick={handleSignIn}
          disabled={isSigningIn}
          style={{ display: "flex", alignItems: "center", gap: "6px", width: "fit-content" }}
        >
          <PersonIcon size={14} />
          {isSigningIn ? t("signing_in") : t("sign_in_xbox")}
        </Button>
      )}

      {/* Signed in */}
      {xboxState && (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 14px",
              borderRadius: "8px",
              background: "var(--color-background-2, rgba(255,255,255,0.05))",
            }}
          >
            {xboxState.hasGamePass ? (
              <CheckCircleFillIcon size={16} />
            ) : (
              <AlertIcon size={16} />
            )}
            <span style={{ flex: 1 }}>
              {xboxState.hasGamePass
                ? t("xbox_signed_in_with_gamepass", { gamertag: xboxState.gamertag })
                : t("xbox_signed_in_no_gamepass", { gamertag: xboxState.gamertag })}
            </span>
            <Button type="button" theme="outline" onClick={handleSignOut}>
              {t("sign_out")}
            </Button>
          </div>

          {!xboxState.hasGamePass && (
            <p style={{ margin: 0, fontSize: "0.8em", opacity: 0.6 }}>
              {t("xbox_no_gamepass_hint")}
            </p>
          )}

          {xboxState.hasGamePass && (
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <Button
                type="button"
                onClick={handleSync}
                disabled={isSyncing}
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
              >
                <SyncIcon size={14} />
                {isSyncing ? t("syncing") : t("sync_xbox_library")}
              </Button>
              {syncResult && (
                <small style={{ opacity: 0.7 }}>
                  {t("sync_result", { added: syncResult.added, total: syncResult.total })}
                </small>
              )}
            </div>
          )}

          <p style={{ margin: 0, fontSize: "0.8em", opacity: 0.6 }}>
            {t("xbox_launch_hint")}
          </p>
        </>
      )}
    </div>
  );
}
