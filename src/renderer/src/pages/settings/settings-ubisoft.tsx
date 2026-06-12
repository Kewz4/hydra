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

interface UbisoftGameDef {
  installId: string;
  title: string;
  installDir: string;
  launchUri: string;
}

export function SettingsUbisoft() {
  const userPreferences = useAppSelector(
    (state) => state.userPreferences.value
  );
  const { updateUserPreferences } = useContext(settingsContext);
  const { showSuccessToast, showErrorToast } = useToast();

  const [clientInstalled, setClientInstalled] = useState<boolean | null>(null);
  const [detected, setDetected] = useState<UbisoftGameDef[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isAdding, setIsAdding] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const isConnected = Boolean(userPreferences?.ubisoftTicket);
  const username = userPreferences?.ubisoftUsername;

  useEffect(() => {
    window.electron
      .getUbisoftGames()
      .then(({ installed, detected: det }) => {
        setClientInstalled(installed);
        setDetected(det);
        setSelected(new Set(det.map((g) => g.installId)));
      })
      .catch(() => setClientInstalled(false));
  }, []);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const result = await window.electron.openUbisoftAuthWindow();
      if (result) {
        // Main process already persisted the credentials — update renderer state
        await updateUserPreferences({
          ubisoftTicket: result.ticket,
          ubisoftUserId: result.userId,
          ubisoftProfileId: result.profileId,
          ubisoftUsername: result.username,
        });
        showSuccessToast("Ubisoft Connect", `Connected as ${result.username}`);
        handleSync();
      }
    } catch {
      showErrorToast("Ubisoft Connect", "Failed to connect account.");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    await updateUserPreferences({
      ubisoftTicket: null,
      ubisoftUserId: null,
      ubisoftProfileId: null,
      ubisoftUsername: null,
    });
    showSuccessToast("Ubisoft Connect", "Account disconnected.");
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const result = await window.electron.syncUbisoftLibrary();
      if (result.error) {
        showErrorToast("Ubisoft Connect", result.error);
      } else {
        showSuccessToast(
          "Ubisoft Connect",
          `Library synced: ${result.added} game${result.added !== 1 ? "s" : ""} added (${result.total} owned).`
        );
      }
    } catch {
      showErrorToast("Ubisoft Connect", "Library sync failed.");
    } finally {
      setIsSyncing(false);
    }
  };

  const toggleGame = (installId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(installId)) {
        next.delete(installId);
      } else {
        next.add(installId);
      }
      return next;
    });
  };

  const handleAddToLibrary = async () => {
    if (selected.size === 0) return;
    setIsAdding(true);
    try {
      const result = await window.electron.addUbisoftGamesToLibrary(
        Array.from(selected)
      );
      showSuccessToast(
        "Ubisoft Connect",
        `Added ${result.added} game${result.added !== 1 ? "s" : ""} to your library.`
      );
    } catch {
      showErrorToast("Ubisoft Connect", "Failed to add games to library.");
    } finally {
      setIsAdding(false);
    }
  };

  if (userPreferences === null) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <p style={{ margin: 0, opacity: 0.8 }}>
        Connect your Ubisoft account to import your owned games — no client
        required. Games launch through Ubisoft Connect when it&apos;s
        installed.
      </p>

      {!isConnected ? (
        <div>
          <Button type="button" onClick={handleConnect} disabled={isConnecting}>
            {isConnecting ? "Connecting…" : "Connect Ubisoft account"}
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
          <span
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
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
            Ubisoft Connect is not installed — synced games can&apos;t be
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
              const isChecked = selected.has(game.installId);

              return (
                <button
                  key={game.installId}
                  type="button"
                  onClick={() => toggleGame(game.installId)}
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
