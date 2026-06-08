import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@renderer/components";
import { useAppSelector, useToast } from "@renderer/hooks";
import { settingsContext } from "@renderer/context";
import { AlertIcon, CheckCircleFillIcon, DownloadIcon, SyncIcon } from "@primer/octicons-react";
import { LibrarySyncModal, type LibrarySyncResult } from "./library-sync-modal";

export function SettingsGogAccount() {
  const { t } = useTranslation("settings");
  const userPreferences = useAppSelector((state) => state.userPreferences.value);
  const { updateUserPreferences } = useContext(settingsContext);
  const { showSuccessToast, showErrorToast } = useToast();

  const [userInfo, setUserInfo] = useState<{ userId: string; username: string } | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ total: number; added: number } | null>(null);
  const [syncModal, setSyncModal] = useState<{ heading: string; summary: string; results: LibrarySyncResult[] } | null>(null);
  const [gogdlFound, setGogdlFound] = useState<boolean | null>(null);
  const [isInstallingGogdl, setIsInstallingGogdl] = useState(false);
  const [gogdlInstallProgress, setGogdlInstallProgress] = useState(0);
  const gogdlProgressUnsub = useRef<(() => void) | null>(null);

  const fetchUserInfo = useCallback(async () => {
    if (!userPreferences?.gogRefreshToken) {
      setUserInfo(null);
      return;
    }
    const info = await window.electron.getGogUserInfo().catch(() => null);
    setUserInfo(info);
  }, [userPreferences?.gogRefreshToken]);

  useEffect(() => {
    fetchUserInfo();
  }, [fetchUserInfo]);

  useEffect(() => {
    window.electron.getGogdlStatus().then((s) => setGogdlFound(s.binaryFound)).catch(() => setGogdlFound(false));
  }, []);

  const handleInstallGogdl = async () => {
    setIsInstallingGogdl(true);
    setGogdlInstallProgress(0);
    gogdlProgressUnsub.current = window.electron.onGogdlInstallProgress(setGogdlInstallProgress);
    try {
      await window.electron.installGogdl();
      setGogdlFound(true);
      showSuccessToast("gogdl installed successfully");
    } catch {
      showErrorToast("Failed to install gogdl");
    } finally {
      gogdlProgressUnsub.current?.();
      setIsInstallingGogdl(false);
      setGogdlInstallProgress(0);
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const result = await window.electron.openGogAuthWindow();
      if (!result) {
        showErrorToast(t("gog_auth_cancelled"));
        return;
      }
      await updateUserPreferences({ gogRefreshToken: result.refresh_token });
      showSuccessToast(t("gog_account_linked", { username: result.username }));
      await fetchUserInfo();
    } catch {
      showErrorToast(t("gog_auth_failed"));
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    await updateUserPreferences({ gogRefreshToken: null });
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

      const dedupResult = await window.electron.mergeDuplicateGames().catch(() => ({ merged: 0, mergedTitles: [] }));

      setSyncModal({
        heading: "GOG Library Synced",
        summary: result.added > 0
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

  if (userInfo) {
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
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <CheckCircleFillIcon size={14} />
              <strong>{userInfo.username}</strong>
            </div>
            <small style={{ opacity: 0.6 }}>{userInfo.userId}</small>
          </div>
          <Button type="button" onClick={handleDisconnect} theme="outline">
            {t("disconnect")}
          </Button>
        </div>

        {gogdlFound === false && (
          <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px", borderRadius: "8px", background: "rgba(255,255,255,0.05)" }}>
            <AlertIcon size={16} />
            <span style={{ flex: 1, fontSize: "0.9rem" }}>gogdl not found — required to download GOG games</span>
            <Button
              type="button"
              onClick={handleInstallGogdl}
              disabled={isInstallingGogdl}
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <DownloadIcon size={14} />
              {isInstallingGogdl
                ? gogdlInstallProgress > 0
                  ? `Downloading ${gogdlInstallProgress}%`
                  : "Downloading…"
                : "Install gogdl"}
            </Button>
          </div>
        )}

        {gogdlFound === true && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 10px", borderRadius: "6px", background: "rgba(255,255,255,0.04)", fontSize: "0.85rem" }}>
            <CheckCircleFillIcon size={13} />
            <span style={{ opacity: 0.7 }}>gogdl ready</span>
          </div>
        )}

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
              {t("sync_result", { added: syncResult.added, total: syncResult.total })}
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
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <p style={{ margin: 0, opacity: 0.8 }}>{t("gog_account_description")}</p>
      <div>
        <Button type="button" onClick={handleConnect} disabled={isConnecting}>
          {isConnecting ? t("connecting") : t("connect_gog_account")}
        </Button>
      </div>
    </div>
  );
}
