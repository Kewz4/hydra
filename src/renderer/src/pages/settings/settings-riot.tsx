import { useEffect, useState } from "react";
import { Button } from "@renderer/components";
import { useCachedDetection, useToast } from "@renderer/hooks";
import {
  AlertIcon,
  CheckCircleFillIcon,
  PlusIcon,
} from "@primer/octicons-react";

interface RiotGameDef {
  productId: string;
  patchline: string;
  title: string;
}

interface RiotDetection {
  installed: boolean;
  detected: RiotGameDef[];
  all: RiotGameDef[];
}

export function SettingsRiot() {
  const { showSuccessToast, showErrorToast } = useToast();

  const { data } = useCachedDetection<RiotDetection>("riot-games", () =>
    window.electron.getRiotGames()
  );

  const clientInstalled = data?.installed ?? null;
  const allGames = data?.all ?? [];
  const detected = data?.detected ?? [];

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    if (data) {
      setSelected((prev) =>
        prev.size > 0 ? prev : new Set(data.detected.map((g) => g.productId))
      );
    }
  }, [data]);

  const toggleGame = (productId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const handleAddToLibrary = async () => {
    if (selected.size === 0) return;
    setIsAdding(true);
    try {
      const result = await window.electron.addRiotGamesToLibrary(
        Array.from(selected)
      );
      showSuccessToast(
        "Riot Games",
        `Added ${result.added} game${result.added !== 1 ? "s" : ""} to your library.`
      );
    } catch {
      showErrorToast("Riot Games", "Failed to add games to library.");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="settings-account">
      <p className="settings-account__description">
        Add your Riot Games titles (League of Legends, VALORANT, Legends of
        Runeterra) to the library. Games launch through the Riot Client.
      </p>

      {clientInstalled === false && (
        <div className="settings-account__warning">
          <AlertIcon size={16} />
          <span>
            Riot Client not detected — games can&apos;t be launched until you
            install it.
          </span>
        </div>
      )}

      <div className="settings-account__game-grid">
        {allGames.map((game) => {
          const isDetected = detected.some(
            (d) => d.productId === game.productId
          );
          const isChecked = selected.has(game.productId);

          return (
            <button
              key={game.productId}
              type="button"
              onClick={() => toggleGame(game.productId)}
              className={`settings-account__game-tile${isChecked ? " settings-account__game-tile--selected" : ""}`}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="settings-account__game-title">
                  {game.title}
                </div>
                {isDetected && (
                  <div className="settings-account__game-status">
                    <CheckCircleFillIcon size={10} />
                    Installed
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
          {isAdding ? "Adding…" : `Add ${selected.size} to library`}
        </Button>
      </div>
    </div>
  );
}
