import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@renderer/components";
import { useAppSelector, useToast } from "@renderer/hooks";
import { EpicAuthModal } from "./epic-auth-modal";
import {
  AlertIcon,
  CheckCircleFillIcon,
  PersonIcon,
  SyncIcon,
} from "@primer/octicons-react";
import { LibrarySyncModal, type LibrarySyncResult } from "./library-sync-modal";

type Step = "idle" | "signing_in" | "syncing";

export function SettingsEpicAccount() {
  const { t } = useTranslation("settings");
  const userPreferences = useAppSelector(
    (state) => state.userPreferences.value
  );
  const { showSuccessToast, showErrorToast } = useToast();

  const [status, setStatus] = useState<{
    binaryFound: boolean;
    binaryPath: string | null;
    account: string | null;
    authenticated: boolean;
  } | null>(null);
  const [step, setStep] = useState<Step>("idle");
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

  const refreshStatus = async (_path?: string | null) => {
    const s = await window.electron.getLegendaryStatus().catch(() => null);
    if (s) setStatus(s);
    return s;
  };

  useEffect(() => {
    refreshStatus(userPreferences?.legendaryBinaryPath);
  }, [userPreferences?.legendaryBinaryPath]);

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
    await window.electron.epicSignOut().catch(() => {});
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

        {/* Sign in */}
        {status !== null && !isAuthenticated && (
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
