import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@renderer/components";
import { useToast } from "@renderer/hooks";
import { SyncIcon } from "@primer/octicons-react";

export function SettingsXbox() {
  const { t } = useTranslation("settings");
  const { showSuccessToast, showErrorToast } = useToast();

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ added: number; total: number } | null>(null);

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

      <p style={{ margin: 0, fontSize: "0.8em", opacity: 0.6 }}>
        {t("xbox_launch_hint")}
      </p>
    </div>
  );
}
