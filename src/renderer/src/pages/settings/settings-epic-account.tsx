import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, TextField } from "@renderer/components";
import { useAppSelector, useToast } from "@renderer/hooks";
import { useContext } from "react";
import { settingsContext } from "@renderer/context";
import { CheckCircleFillIcon, SyncIcon, AlertIcon } from "@primer/octicons-react";

export function SettingsEpicAccount() {
  const { t } = useTranslation("settings");
  const userPreferences = useAppSelector((state) => state.userPreferences.value);
  const { updateUserPreferences } = useContext(settingsContext);
  const { showSuccessToast, showErrorToast } = useToast();

  const [legendaryPath, setLegendaryPath] = useState("");
  const [status, setStatus] = useState<{
    binaryFound: boolean;
    account: string | null;
    authenticated: boolean;
  } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ total: number; added: number } | null>(null);

  useEffect(() => {
    setLegendaryPath(userPreferences?.legendaryBinaryPath ?? "");
  }, [userPreferences?.legendaryBinaryPath]);

  useEffect(() => {
    window.electron.getLegendaryStatus().then(setStatus).catch(() => {});
  }, [userPreferences?.legendaryBinaryPath]);

  const handleSavePath = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateUserPreferences({ legendaryBinaryPath: legendaryPath || null });
    const newStatus = await window.electron.getLegendaryStatus().catch(() => null);
    if (newStatus) setStatus(newStatus);
    showSuccessToast(t("changes_saved"));
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const result = await window.electron.syncEpicLibrary();
      setSyncResult(result);
      showSuccessToast(
        t("epic_library_synced", { added: result.added, total: result.total })
      );
    } catch (err: any) {
      showErrorToast(err?.message ?? t("epic_sync_failed"));
    } finally {
      setIsSyncing(false);
    }
  };

  const isAuthenticated = status?.authenticated;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <p style={{ margin: 0, opacity: 0.8 }}>{t("epic_account_description")}</p>

      <form onSubmit={handleSavePath} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <TextField
          label={t("legendary_binary_path")}
          value={legendaryPath}
          onChange={(e) => setLegendaryPath(e.target.value)}
          placeholder={t("legendary_binary_placeholder")}
          hint={t("legendary_binary_hint")}
          rightContent={
            <Button type="submit">{t("save_changes")}</Button>
          }
        />
      </form>

      {status && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 12px",
            borderRadius: "8px",
            background: "var(--color-background-2, rgba(255,255,255,0.05))",
          }}
        >
          {isAuthenticated ? (
            <>
              <CheckCircleFillIcon size={16} />
              <span>
                {t("epic_logged_in_as", { username: status.account })}
              </span>
            </>
          ) : status.binaryFound ? (
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

      {isAuthenticated && (
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Button
            type="button"
            onClick={handleSync}
            disabled={isSyncing}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <SyncIcon size={14} />
            {isSyncing ? t("syncing") : t("sync_epic_library")}
          </Button>
          {syncResult && (
            <small style={{ opacity: 0.7 }}>
              {t("sync_result", { added: syncResult.added, total: syncResult.total })}
            </small>
          )}
        </div>
      )}

      {!isAuthenticated && status?.binaryFound && (
        <p style={{ opacity: 0.6, fontSize: "0.85em", margin: 0 }}>
          {t("legendary_auth_instructions")}
        </p>
      )}
    </div>
  );
}
