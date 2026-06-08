import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@renderer/components";
import { useToast } from "@renderer/hooks";
import {
  AlertIcon,
  CheckCircleFillIcon,
  DownloadIcon,
  PlusIcon,
} from "@primer/octicons-react";

interface BattleNetGameDef {
  productCode: string;
  title: string;
  iconUrl: string;
  launchUri: string;
}

export function SettingsBattleNet() {
  const { t } = useTranslation("settings");
  const { showSuccessToast, showErrorToast } = useToast();

  const [bnetInstalled, setBnetInstalled] = useState<boolean | null>(null);
  const [allGames, setAllGames] = useState<BattleNetGameDef[]>([]);
  const [detected, setDetected] = useState<BattleNetGameDef[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isAdding, setIsAdding] = useState(false);
  const [isInstallingBnet, setIsInstallingBnet] = useState(false);
  const [bnetInstallProgress, setBnetInstallProgress] = useState(0);
  const unsubRef = useRef<(() => void) | null>(null);

  const refreshInstalled = () => {
    window.electron
      .getBattleNetGames()
      .then(({ installed, detected: det, all }) => {
        setBnetInstalled(installed);
        setDetected(det);
        setAllGames(all);
        setSelected(new Set(det.map((g) => g.productCode)));
      })
      .catch(() => setBnetInstalled(false));
  };

  useEffect(() => {
    refreshInstalled();
    const unsub = window.electron.onBattleNetInstallProgress(
      setBnetInstallProgress
    );
    unsubRef.current = unsub;
    return () => unsub();
  }, []);

  const handleInstallBattleNet = async () => {
    setIsInstallingBnet(true);
    setBnetInstallProgress(0);
    try {
      await window.electron.installBattleNet();
      showSuccessToast(t("battlenet_installer_launched"));
      // Re-check after a short delay to pick up the install
      setTimeout(refreshInstalled, 5000);
    } catch (err: any) {
      showErrorToast(err?.message ?? t("battlenet_install_failed"));
    } finally {
      setIsInstallingBnet(false);
      setBnetInstallProgress(0);
    }
  };

  const toggleGame = (code: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  };

  const handleAddToLibrary = async () => {
    if (selected.size === 0) return;
    setIsAdding(true);
    try {
      const result = await window.electron.addBattleNetGamesToLibrary(
        Array.from(selected)
      );
      showSuccessToast(t("battlenet_games_added", { count: result.added }));
    } catch {
      showErrorToast(t("battlenet_add_failed"));
    } finally {
      setIsAdding(false);
    }
  };

  if (bnetInstalled === null) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <p style={{ margin: 0, opacity: 0.8 }}>{t("battlenet_description")}</p>

      {!bnetInstalled && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              opacity: 0.7,
            }}
          >
            <AlertIcon size={16} />
            <span>{t("battlenet_not_installed")}</span>
          </div>
          <Button
            type="button"
            onClick={handleInstallBattleNet}
            disabled={isInstallingBnet}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              width: "fit-content",
            }}
          >
            <DownloadIcon size={14} />
            {isInstallingBnet
              ? bnetInstallProgress > 0
                ? t("downloading_pct", { pct: bnetInstallProgress })
                : t("downloading")
              : t("install_battlenet")}
          </Button>
        </div>
      )}

      {bnetInstalled && (
        <>
          <p style={{ margin: 0, fontSize: "0.875em", opacity: 0.7 }}>
            {t("battlenet_select_games")}
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: "8px",
            }}
          >
            {allGames.map((game) => {
              const isDetected = detected.some(
                (d) => d.productCode === game.productCode
              );
              const isChecked = selected.has(game.productCode);

              return (
                <button
                  key={game.productCode}
                  type="button"
                  onClick={() => toggleGame(game.productCode)}
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
                  <img
                    src={game.iconUrl}
                    alt={game.title}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 4,
                      objectFit: "contain",
                    }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
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
                    {isDetected && (
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
                        {t("installed")}
                      </div>
                    )}
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
              {t("battlenet_add_selected", { count: selected.size })}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
