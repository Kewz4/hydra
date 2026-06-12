import { useContext, useEffect, useState } from "react";
import { Button } from "@renderer/components";
import { useAppSelector, useToast } from "@renderer/hooks";
import { settingsContext } from "@renderer/context";
import {
  AlertIcon,
  CheckCircleFillIcon,
  PlusIcon,
  SyncIcon,
} from "@primer/octicons-react";

interface EaGameDef {
  offerId: string | null;
  title: string;
  installDir: string | null;
}

export function SettingsEa() {
  const userPreferences = useAppSelector(
    (state) => state.userPreferences.value
  );
  const { updateUserPreferences } = useContext(settingsContext);
  const { showSuccessToast, showErrorToast } = useToast();

  const [clientInstalled, setClientInstalled] = useState<boolean | null>(null);
  const [detected, setDetected] = useState<EaGameDef[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isAdding, setIsAdding] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const isConnected = Boolean(userPreferences?.eaAccessToken);
  const username = userPreferences?.eaUsername;

  useEffect(() => {
    window.electron
      .getEaGames()
      .then(({ installed, detected: det }) => {
        setClientInstalled(installed);
        setDetected(det);
        setSelected(new Set(det.map((g) => g.title)));
      })
      .catch(() => setClientInstalled(false));
  }, []);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const result = await window.electron.openEaAuthWindow();
      if (result) {
        await updateUserPreferences({
          eaAccessToken: result.accessToken,
          eaUsername: result.username,
          eaPid: result.pid,
        });
        showSuccessToast("EA app", `Connected as ${result.username}`);
        handleSync();
      }
    } catch {
      showErrorToast("EA app", "Failed to connect account.");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    await updateUserPreferences({
      eaAccessToken: null,
      eaTokenExpiry: null,
      eaUsername: null,
      eaPid: null,
    });
    showSuccessToast("EA app", "Account disconnected.");
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const result = await window.electron.syncEaLibrary();
      if (result.error) {
        showErrorToast("EA app", result.error);
      } else {
        showSuccessToast(
          "EA app",
          `Library synced: ${result.added} game${result.added !== 1 ? "s" : ""} added (${result.total} owned).`
        );
      }
    } catch {
      showErrorToast("EA app", "Library sync failed.");
    } finally {
      setIsSyncing(false);
    }
  };

  const toggleGame = (title: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      return next;
    });
  };

  const handleAddToLibrary = async () => {
    if (selected.size === 0) return;
    setIsAdding(true);
    try {
      const result = await window.electron.addEaGamesToLibrary(
        Array.from(selected)
      );
      showSuccessToast(
        "EA app",
        `Added ${result.added} game${result.added !== 1 ? "s" : ""} to your library.`
      );
    } catch {
      showErrorToast("EA app", "Failed to add games to library.");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <p style={{ margin: 0, opacity: 0.8 }}>
        Connect your EA account to import your owned games — no client required.
        Games launch through the EA app when it&apos;s installed.
      </p>

      {!isConnected ? (
        <div>
          <Button type="button" onClick={handleConnect} disabled={isConnecting}>
            {isConnecting ? "Connecting…" : "Connect EA account"}
          </Button>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <CheckCircleFillIcon size={14} />
            Connected{username ? ` as ${username}` : ""}
          </span>
          <Button
            type="button"
            onClick={handleSync}
            disabled={isSyncing}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <SyncIcon size={14} />
            {isSyncing ? "Syncing…" : "Sync library"}
          </Button>
          <Button type="button" theme="outline" onClick={handleDisconnect}>
            Disconnect
          </Button>
        </div>
      )}

      {clientInstalled === false && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            opacity: 0.7,
          }}
        >
          <AlertIcon size={16} />
          <span>
            EA app / Origin is not installed — synced games can&apos;t be
            launched until you install it.
          </span>
        </div>
      )}

      {detected.length > 0 && (
        <>
          <p style={{ margin: 0, fontSize: "0.875em", opacity: 0.6 }}>
            Locally installed games detected:
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: "8px",
            }}
          >
            {detected.map((game) => {
              const isChecked = selected.has(game.title);

              return (
                <button
                  key={game.title}
                  type="button"
                  onClick={() => toggleGame(game.title)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: `1px solid ${isChecked ? "var(--color-accent, #5e81f4)" : "rgba(255,255,255,0.1)"}`,
                    background: isChecked
                      ? "rgba(94,129,244,0.15)"
                      : "rgba(255,255,255,0.03)",
                    cursor: "pointer",
                    textAlign: "left",
                    color: "inherit",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: "0.875em",
                        fontWeight: 500,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {game.title}
                    </div>
                    <div
                      style={{
                        fontSize: "0.75em",
                        opacity: 0.6,
                        display: "flex",
                        alignItems: "center",
                        gap: "3px",
                      }}
                    >
                      <CheckCircleFillIcon size={10} />
                      Installed
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div>
            <Button
              type="button"
              onClick={handleAddToLibrary}
              disabled={selected.size === 0 || isAdding}
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <PlusIcon size={14} />
              {isAdding ? "Adding…" : `Add ${selected.size} to library`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
