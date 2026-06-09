import { useContext, useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Button, Link, TextField } from "@renderer/components";
import { useAppSelector, useToast } from "@renderer/hooks";
import { settingsContext } from "@renderer/context";
import {
  LinkExternalIcon,
  SyncIcon,
  CheckCircleFillIcon,
  MarkGithubIcon,
} from "@primer/octicons-react";
import { LibrarySyncModal, type LibrarySyncResult } from "./library-sync-modal";

const STEAM_API_KEY_URL = "https://steamcommunity.com/dev/apikey";

export function SettingsSteamAccount() {
  const { t } = useTranslation("settings");
  const userPreferences = useAppSelector(
    (state) => state.userPreferences.value
  );
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
  const [isOpenIdPending, setIsOpenIdPending] = useState(false);
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

  useEffect(() => {
    if (userPreferences) {
      setSteamId(userPreferences.steamId ?? "");
      setApiKey(userPreferences.steamApiKey ?? "");
    }
  }, [userPreferences]);

  useEffect(() => {
    const savedSteamId = userPreferences?.steamId;

    if (savedSteamId) {
      window.electron
        .getSteamPlayerSummary(
          savedSteamId,
          userPreferences?.steamApiKey ?? undefined
        )
        .then((summary) => {
          if (summary) setLinkedAccount(summary);
        })
        .catch(() => {});
    } else {
      setLinkedAccount(null);
    }
  }, [userPreferences?.steamId, userPreferences?.steamApiKey]);

  const handleSteamOpenIdLogin = async () => {
    setIsOpenIdPending(true);
    try {
      const detectedSteamId = await window.electron.startSteamOpenIdLogin();
      // Save immediately so the linked-account panel renders
      await updateUserPreferences({
        steamId: detectedSteamId,
        steamApiKey: apiKey.trim() || null,
      });
      setSteamId(detectedSteamId);
      // Fetch and display profile
      const summary = await window.electron
        .getSteamPlayerSummary(detectedSteamId, apiKey.trim() || undefined)
        .catch(() => null);
      if (summary) {
        setLinkedAccount(summary);
        showSuccessToast(t("steam_account_linked"));
      } else {
        showSuccessToast(t("steam_id_detected", { steamId: detectedSteamId }));
      }
    } catch {
      showErrorToast(t("steam_openid_failed"));
    } finally {
      setIsOpenIdPending(false);
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!steamId.trim()) return;

    setIsSaving(true);
    try {
      const summary = await window.electron.getSteamPlayerSummary(
        steamId.trim(),
        apiKey.trim() || undefined
      );

      if (!summary) {
        showErrorToast(t("steam_account_not_found"));
        return;
      }

      await updateUserPreferences({
        steamId: steamId.trim(),
        steamApiKey: apiKey.trim() || null,
      });
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
    if (!savedSteamId) return;

    setIsSyncing(true);
    setSyncResult(null);
    try {
      const result = await window.electron.syncSteamLibrary(
        savedSteamId,
        userPreferences?.steamApiKey ?? undefined
      );
      setSyncResult(result);

      const dedupResult = await window.electron
        .mergeDuplicateGames()
        .catch(() => ({ merged: 0, mergedTitles: [] }));

      setSyncModal({
        heading: "Steam Library Synced",
        summary:
          result.added > 0
            ? `Added ${result.added} game${result.added !== 1 ? "s" : ""} (${result.total} total).${dedupResult.merged > 0 ? ` Merged ${dedupResult.merged} duplicate${dedupResult.merged !== 1 ? "s" : ""}.` : ""}`
            : `Library up to date (${result.total} games).${dedupResult.merged > 0 ? ` Merged ${dedupResult.merged} duplicate${dedupResult.merged !== 1 ? "s" : ""}.` : ""}`,
        results: [],
      });
    } catch {
      showErrorToast(t("steam_sync_failed"));
    } finally {
      setIsSyncing(false);
    }
  };

  if (linkedAccount) {
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
            <img
              src={linkedAccount.avatarfull}
              alt={linkedAccount.personaname}
              style={{ width: 48, height: 48, borderRadius: "50%" }}
            />
            <div style={{ flex: 1 }}>
              <div
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
              >
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
                {t("steam_sync_result", {
                  added: syncResult.added,
                  total: syncResult.total,
                })}
              </small>
            )}
          </div>

          <p style={{ opacity: 0.6, fontSize: "0.85em", margin: 0 }}>
            {t("steam_library_description")}
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
    <form
      onSubmit={handleConnect}
      style={{ display: "flex", flexDirection: "column", gap: "16px" }}
    >
      <p style={{ margin: 0, opacity: 0.8 }}>
        {t("steam_account_description")}
      </p>

      <div>
        <Button
          type="button"
          onClick={handleSteamOpenIdLogin}
          disabled={isOpenIdPending}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: "#1b2838",
            color: "#c7d5e0",
          }}
        >
          <MarkGithubIcon size={16} />
          {isOpenIdPending ? t("waiting_for_steam") : t("login_with_steam")}
        </Button>
        <p style={{ margin: "8px 0 0", opacity: 0.55, fontSize: "0.8em" }}>
          {t("login_with_steam_hint")}
        </p>
      </div>

      <p style={{ margin: 0, opacity: 0.5, textAlign: "center" }}>{t("or")}</p>

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
        <Button type="submit" disabled={!steamId.trim() || isSaving}>
          {isSaving ? t("connecting") : t("connect_steam_account")}
        </Button>
      </div>
    </form>
  );
}
