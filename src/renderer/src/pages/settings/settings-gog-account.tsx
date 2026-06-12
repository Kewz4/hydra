import { useCallback, useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@renderer/components";
import { useAppSelector, useToast } from "@renderer/hooks";
import { settingsContext } from "@renderer/context";
import { GogAuthModal } from "./gog-auth-modal";
import { CheckCircleFillIcon, SyncIcon } from "@primer/octicons-react";
import { LibrarySyncModal, type LibrarySyncResult } from "./library-sync-modal";

export function SettingsGogAccount() {
  const { t } = useTranslation("settings");
  const userPreferences = useAppSelector(
    (state) => state.userPreferences.value
  );
  const { updateUserPreferences } = useContext(settingsContext);
  const { showSuccessToast, showErrorToast } = useToast();

  const [userInfo, setUserInfo] = useState<{
    userId: string;
    username: string;
  } | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    total: number;
    added: number;
  } | null>(null);
  const [syncModal, setSyncModal] = useState<{
    heading: string;
    summary: string;
    results: LibrarySyncResult[];
  } | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const fetchUserInfo = useCallback(async () => {
    if (!userPreferences?.gogRefreshToken) {
      setUserInfo(null);
      return;
    }
    const info = await window.electron.getGogUserInfo().catch(() => null);
    if (info) {
      setUserInfo(info);
      // Keep the cached username fresh for instant rendering next time
      if (info.username !== userPreferences?.gogUsername) {
        updateUserPreferences({ gogUsername: info.username }).catch(() => {});
      }
    }
  }, [
    userPreferences?.gogRefreshToken,
    userPreferences?.gogUsername,
    updateUserPreferences,
  ]);

  useEffect(() => {
    fetchUserInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userPreferences?.gogRefreshToken]);

  // gogdl is required to download GOG games — make sure it's present in the
  // background whenever a GOG account is connected, no user action needed
  useEffect(() => {
    if (!userPreferences?.gogRefreshToken) return;
    window.electron
      .getGogdlStatus()
      .then((s) => {
        if (!s.binaryFound) window.electron.installGogdl().catch(() => {});
      })
      .catch(() => {});
  }, [userPreferences?.gogRefreshToken]);

  const handleConnect = () => {
    setShowAuthModal(true);
  };

  const handleGogAuthResult = useCallback(
    async (result: { refresh_token: string; username: string } | null) => {
      if (!result) {
        showErrorToast(t("gog_auth_cancelled"));
        return;
      }
      setIsConnecting(true);
      try {
        await updateUserPreferences({
          gogRefreshToken: result.refresh_token,
          gogUsername: result.username,
        });
        showSuccessToast(
          t("gog_account_linked", { username: result.username })
        );
        await fetchUserInfo();
      } catch {
        showErrorToast(t("gog_auth_failed"));
      } finally {
        setIsConnecting(false);
      }
    },
    [showErrorToast, showSuccessToast, t, updateUserPreferences, fetchUserInfo]
  );

  const handleDisconnect = async () => {
    await updateUserPreferences({ gogRefreshToken: null, gogUsername: null });
    setUserInfo(null);
    setSyncResult(null);
    showSuccessToast(t("gog_account_disconnected"));
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const result = await window.electron.syncGogLibrary();
      setSyncResult(result);

      const dedupResult = await window.electron
        .mergeDuplicateGames()
        .catch(() => ({ merged: 0, mergedTitles: [] }));

      setSyncModal({
        heading: "GOG Library Synced",
        summary:
          result.added > 0
            ? `Added ${result.added} game${result.added !== 1 ? "s" : ""} (${result.total} total).${dedupResult.merged > 0 ? ` Merged ${dedupResult.merged} duplicate${dedupResult.merged !== 1 ? "s" : ""}.` : ""}`
            : `Library up to date (${result.total} games).${dedupResult.merged > 0 ? ` Merged ${dedupResult.merged} duplicate${dedupResult.merged !== 1 ? "s" : ""}.` : ""}`,
        results: (result.addedGames ?? []).map((g) => ({
          title: g.title,
          coverUrl: g.coverUrl,
          what: g.what,
          isNew: true,
        })),
      });
    } catch {
      showErrorToast(t("gog_sync_failed"));
    } finally {
      setIsSyncing(false);
    }
  };

  // Render connected state instantly from the cached username; the live
  // lookup fills in the user ID when it resolves
  const connected = Boolean(userPreferences?.gogRefreshToken);
  const displayName =
    userInfo?.username ?? userPreferences?.gogUsername ?? "GOG User";

  if (connected) {
    return (
      <>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "12px",
              borderRadius: "8px",
              background: "var(--color-background-2, rgba(255,255,255,0.05))",
            }}
          >
            <div style={{ flex: 1 }}>
              <div
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
              >
                <CheckCircleFillIcon size={14} />
                <strong>{displayName}</strong>
              </div>
              {userInfo?.userId && (
                <small style={{ opacity: 0.6 }}>{userInfo.userId}</small>
              )}
            </div>
            <Button type="button" onClick={handleDisconnect} theme="outline">
              {t("disconnect")}
            </Button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Button
              type="button"
              onClick={handleSync}
              disabled={isSyncing}
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <SyncIcon size={14} />
              {isSyncing ? t("syncing") : t("sync_gog_library")}
            </Button>
            {syncResult && (
              <small style={{ opacity: 0.7 }}>
                {t("sync_result", {
                  added: syncResult.added,
                  total: syncResult.total,
                })}
              </small>
            )}
          </div>

          <p style={{ opacity: 0.6, fontSize: "0.85em", margin: 0 }}>
            {t("gog_library_description")}
          </p>
        </div>

        {syncModal && (
          <LibrarySyncModal
            visible={true}
            heading={syncModal.heading}
            summary={syncModal.summary}
            results={syncModal.results}
            onClose={() => setSyncModal(null)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <p style={{ margin: 0, opacity: 0.8 }}>
          {t("gog_account_description")}
        </p>
        <div>
          <Button type="button" onClick={handleConnect} disabled={isConnecting}>
            {isConnecting ? t("connecting") : t("connect_gog_account")}
          </Button>
        </div>
      </div>

      <GogAuthModal
        visible={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleGogAuthResult}
      />
    </>
  );
}
