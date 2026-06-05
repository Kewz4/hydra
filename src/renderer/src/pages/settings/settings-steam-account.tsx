import { useContext, useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Button, Link, TextField } from "@renderer/components";
import { useAppSelector, useToast } from "@renderer/hooks";
import { settingsContext } from "@renderer/context";
import { LinkExternalIcon, SyncIcon, CheckCircleFillIcon } from "@primer/octicons-react";

const STEAM_API_KEY_URL = "https://steamcommunity.com/dev/apikey";

export function SettingsSteamAccount() {
  const { t } = useTranslation("settings");
  const userPreferences = useAppSelector((state) => state.userPreferences.value);
  const { updateUserPreferences } = useContext(settingsContext);
  const { showSuccessToast, showErrorToast } = useToast();

  const [steamId, setSteamId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [linkedAccount, setLinkedAccount] = useState<{
    steamid: string;
    personaname: string;
    avatarfull: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ total: number; added: number } | null>(null);

  useEffect(() => {
    if (userPreferences) {
      setSteamId(userPreferences.steamId ?? "");
      setApiKey(userPreferences.steamApiKey ?? "");
    }
  }, [userPreferences]);

  useEffect(() => {
    const savedSteamId = userPreferences?.steamId;
    const savedApiKey = userPreferences?.steamApiKey;

    if (savedSteamId && savedApiKey) {
      window.electron
        .getSteamPlayerSummary(savedSteamId, savedApiKey)
        .then((summary) => {
          if (summary) setLinkedAccount(summary);
        })
        .catch(() => {});
    } else {
      setLinkedAccount(null);
    }
  }, [userPreferences?.steamId, userPreferences?.steamApiKey]);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!steamId.trim() || !apiKey.trim()) return;

    setIsSaving(true);
    try {
      const summary = await window.electron.getSteamPlayerSummary(steamId.trim(), apiKey.trim());

      if (!summary) {
        showErrorToast(t("steam_account_not_found"));
        return;
      }

      await updateUserPreferences({ steamId: steamId.trim(), steamApiKey: apiKey.trim() });
      setLinkedAccount(summary);
      showSuccessToast(t("steam_account_linked"));
    } catch {
      showErrorToast(t("steam_invalid_credentials"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnect = async () => {
    await updateUserPreferences({ steamId: null, steamApiKey: null });
    setLinkedAccount(null);
    setSteamId("");
    setApiKey("");
    setSyncResult(null);
    showSuccessToast(t("steam_account_disconnected"));
  };

  const handleSync = async () => {
    const savedSteamId = userPreferences?.steamId;
    const savedApiKey = userPreferences?.steamApiKey;
    if (!savedSteamId || !savedApiKey) return;

    setIsSyncing(true);
    setSyncResult(null);
    try {
      const result = await window.electron.syncSteamLibrary(savedSteamId, savedApiKey);
      setSyncResult(result);
      showSuccessToast(t("steam_library_synced", { added: result.added, total: result.total }));
    } catch {
      showErrorToast(t("steam_sync_failed"));
    } finally {
      setIsSyncing(false);
    }
  };

  if (linkedAccount) {
    return (
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
          <img
            src={linkedAccount.avatarfull}
            alt={linkedAccount.personaname}
            style={{ width: 48, height: 48, borderRadius: "50%" }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <CheckCircleFillIcon size={14} />
              <strong>{linkedAccount.personaname}</strong>
            </div>
            <small style={{ opacity: 0.6 }}>{linkedAccount.steamid}</small>
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
            {isSyncing ? t("syncing") : t("sync_steam_library")}
          </Button>

          {syncResult && (
            <small style={{ opacity: 0.7 }}>
              {t("steam_sync_result", { added: syncResult.added, total: syncResult.total })}
            </small>
          )}
        </div>

        <p style={{ opacity: 0.6, fontSize: "0.85em", margin: 0 }}>
          {t("steam_library_description")}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleConnect} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <p style={{ margin: 0, opacity: 0.8 }}>{t("steam_account_description")}</p>

      <TextField
        label={t("steam_id")}
        value={steamId}
        onChange={(e) => setSteamId(e.target.value)}
        placeholder="76561198..."
        hint={t("steam_id_hint")}
      />

      <TextField
        label={t("steam_api_key")}
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        type="password"
        placeholder={t("steam_api_key_placeholder")}
        hint={
          <Trans i18nKey="steam_api_key_hint" ns="settings">
            <Link to={STEAM_API_KEY_URL}>
              <LinkExternalIcon size={12} />
            </Link>
          </Trans>
        }
      />

      <div>
        <Button type="submit" disabled={!steamId.trim() || !apiKey.trim() || isSaving}>
          {isSaving ? t("connecting") : t("connect_steam_account")}
        </Button>
      </div>
    </form>
  );
}
