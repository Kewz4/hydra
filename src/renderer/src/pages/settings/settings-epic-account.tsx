import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, TextField } from "@renderer/components";
import { useAppSelector, useToast } from "@renderer/hooks";
import { settingsContext } from "@renderer/context";
import { EpicAuthModal } from "./epic-auth-modal";
import {
  AlertIcon,
  CheckCircleFillIcon,
  DownloadIcon,
  PersonIcon,
  SyncIcon,
} from "@primer/octicons-react";
import { LibrarySyncModal, type LibrarySyncResult } from "./library-sync-modal";

type Step = "idle" | "installing" | "signing_in" | "syncing";

export function SettingsEpicAccount() {
  const { t } = useTranslation("settings");
  const userPreferences = useAppSelector(
    (state) => state.userPreferences.value
  );
  const { updateUserPreferences } = useContext(settingsContext);
  const { showSuccessToast, showErrorToast } = useToast();

  const [legendaryPath, setLegendaryPath] = useState("");
  const [status, setStatus] = useState<{
    binaryFound: boolean;
    binaryPath: string | null;
    account: string | null;
    authenticated: boolean;
  } | null>(null);
  const [step, setStep] = useState<Step>("idle");
  const [installProgress, setInstallProgress] = useState(0);
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
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setLegendaryPath(userPreferences?.legendaryBinaryPath ?? "");
  }, [userPreferences?.legendaryBinaryPath]);

  const refreshStatus = async (_path?: string | null) => {
    const s = await window.electron.getLegendaryStatus().catch(() => null);
    if (s) setStatus(s);
    return s;
  };

  useEffect(() => {
    refreshStatus(userPreferences?.legendaryBinaryPath);
  }, [userPreferences?.legendaryBinaryPath]);

  // Subscribe to download progress
  useEffect(() => {
    const unsub =
      window.electron.onLegendaryInstallProgress(setInstallProgress);
    unsubRef.current = unsub;
    return () => unsub();
  }, []);

  const handleSavePath = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateUserPreferences({ legendaryBinaryPath: legendaryPath || null });
    showSuccessToast(t("changes_saved"));
  };

  const handleInstall = async () => {
    setStep("installing");
    setInstallProgress(0);
    try {
      const { path: installedPath } = await window.electron.installLegendary();
      await updateUserPreferences({ legendaryBinaryPath: installedPath });
      showSuccessToast(t("legendary_installed"));
      await refreshStatus(installedPath);
    } catch (err: any) {
      showErrorToast(err?.message ?? t("legendary_install_failed"));
    } finally {
      setStep("idle");
      setInstallProgress(0);
    }
  };

  const handleSignIn = () => {
    setShowAuthModal(true);
  };

  const handleAuthResult = useCallback(
    async (result: { success: boolean; account?: string }) => {
      if (result.success) {
        showSuccessToast(
          t("epic_logged_in_as", { username: result.account ?? "Epic" })
        );
        await refreshStatus(userPreferences?.legendaryBinaryPath);
      } else {
        showErrorToast(t("epic_auth_failed"));
      }
    },
    [
      showSuccessToast,
      showErrorToast,
      t,
      refreshStatus,
      userPreferences?.legendaryBinaryPath,
    ]
  );

  const handleSignOut = async () => {
    const newStatus = await window.electron.epicSignOut().catch(() => null);
    if (newStatus) setStatus(newStatus);
    else
      setStatus((prev) =>
        prev ? { ...prev, authenticated: false, account: null } : null
      );
    showSuccessToast(t("epic_signed_out"));
  };

  const handleSync = async () => {
    setStep("syncing");
    setSyncResult(null);
    try {
      const result = await window.electron.syncEpicLibrary();
      setSyncResult(result);

      // Auto-run dedup after sync
      const dedupResult = await window.electron
        .mergeDuplicateGames()
        .catch(() => ({ merged: 0, mergedTitles: [] }));

      setSyncModal({
        heading: "Epic Library Synced",
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
    } catch (err: any) {
      showErrorToast(err?.message ?? t("epic_sync_failed"));
    } finally {
      setStep("idle");
    }
  };

  const isBusy = step !== "idle";
  const binaryFound = status?.binaryFound ?? false;
  const isAuthenticated = status?.authenticated ?? false;

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <p style={{ margin: 0, opacity: 0.8 }}>
          {t("epic_account_description")}
        </p>

        {/* Status chip */}
        {status && (
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
            {isAuthenticated ? (
              <>
                <CheckCircleFillIcon size={16} />
                <span style={{ flex: 1 }}>
                  {t("epic_logged_in_as", { username: status.account })}
                </span>
                <Button
                  type="button"
                  theme="outline"
                  onClick={handleSignOut}
                  disabled={isBusy}
                >
                  {t("sign_out")}
                </Button>
              </>
            ) : binaryFound ? (
              <>
                <AlertIcon size={16} />
                <span>{t("legendary_not_authenticated")}</span>
              </>
            ) : (
              <>
                <AlertIcon size={16} />
                <span>{t("legendary_not_found")}</span>
              </>
            )}
          </div>
        )}

        {/* Install legendary */}
        {!binaryFound && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <Button
              type="button"
              onClick={handleInstall}
              disabled={isBusy}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                width: "fit-content",
              }}
            >
              <DownloadIcon size={14} />
              {step === "installing"
                ? installProgress > 0
                  ? t("downloading_pct", { pct: installProgress })
                  : t("downloading")
                : t("install_legendary")}
            </Button>

            {/* Manual path override */}
            <form
              onSubmit={handleSavePath}
              style={{ display: "flex", flexDirection: "column", gap: "4px" }}
            >
              <TextField
                label={t("legendary_binary_path")}
                value={legendaryPath}
                onChange={(e) => setLegendaryPath(e.target.value)}
                placeholder={t("legendary_binary_placeholder")}
                hint={t("legendary_binary_hint")}
                rightContent={
                  <Button type="submit" disabled={isBusy}>
                    {t("save_changes")}
                  </Button>
                }
              />
            </form>
          </div>
        )}

        {/* Sign in */}
        {binaryFound && !isAuthenticated && (
          <Button
            type="button"
            onClick={handleSignIn}
            disabled={isBusy}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              width: "fit-content",
            }}
          >
            <PersonIcon size={14} />
            {step === "signing_in" ? t("signing_in") : t("sign_in_epic")}
          </Button>
        )}

        {/* Sync library */}
        {isAuthenticated && (
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Button
              type="button"
              onClick={handleSync}
              disabled={isBusy}
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <SyncIcon size={14} />
              {step === "syncing" ? t("syncing") : t("sync_epic_library")}
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
        )}
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

      <EpicAuthModal
        visible={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthResult}
      />
    </>
  );
}
