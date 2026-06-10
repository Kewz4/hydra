import { useState } from "react";
import { Button } from "@renderer/components";
import { useToast } from "@renderer/hooks";
import { CheckCircleFillIcon, FileDirectoryIcon } from "@primer/octicons-react";
import type { GameShop } from "@types";

interface ScanEntry {
  gameName: string;
  folderPath: string;
  hasMappingYaml: boolean;
}

interface ImportState {
  gameName: string;
  status: "idle" | "importing" | "done" | "error";
  objectId: string;
  shop: GameShop;
}

export function SettingsLudusaviImport() {
  const { showSuccessToast, showErrorToast } = useToast();
  const [scanning, setScanning] = useState(false);
  const [entries, setEntries] = useState<ScanEntry[]>([]);
  const [importStates, setImportStates] = useState<
    Record<string, ImportState>
  >({});
  const [scannedPath, setScannedPath] = useState("");

  const handlePickFolder = async () => {
    const result = await window.electron.showOpenDialog({
      properties: ["openDirectory"],
      title: "Select Ludusavi Backup Folder",
    });
    if (!result || result.canceled || !result.filePaths[0]) return;
    const folderPath = result.filePaths[0];
    setScannedPath(folderPath);
    setScanning(true);
    setEntries([]);
    setImportStates({});
    try {
      const found = await window.electron.scanLudusaviBackupFolder(folderPath);
      setEntries(found);
      if (found.length === 0) {
        showErrorToast("Ludusavi Import", "No valid backup folders found.");
      }
    } catch {
      showErrorToast("Ludusavi Import", "Failed to scan folder.");
    } finally {
      setScanning(false);
    }
  };

  const handleImport = async (entry: ScanEntry) => {
    const state = importStates[entry.gameName];
    const objectId = state?.objectId?.trim() || entry.gameName;
    const shop: GameShop = state?.shop || "steam";

    setImportStates((prev) => ({
      ...prev,
      [entry.gameName]: {
        gameName: entry.gameName,
        objectId,
        shop,
        status: "importing",
      },
    }));

    try {
      await window.electron.importLudusaviBackup(
        entry.folderPath,
        entry.gameName,
        objectId,
        shop
      );
      setImportStates((prev) => ({
        ...prev,
        [entry.gameName]: { ...prev[entry.gameName], status: "done" },
      }));
      showSuccessToast("Ludusavi Import", `Imported "${entry.gameName}"`);
    } catch {
      setImportStates((prev) => ({
        ...prev,
        [entry.gameName]: { ...prev[entry.gameName], status: "error" },
      }));
      showErrorToast("Ludusavi Import", `Failed to import "${entry.gameName}"`);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <p style={{ margin: 0, opacity: 0.7, fontSize: "0.875rem" }}>
        Import an existing Ludusavi backup folder into GameHub cloud saves. Pick
        the root backup directory (the one containing per-game subfolders).
      </p>

      <div>
        <Button type="button" theme="outline" onClick={handlePickFolder}>
          <FileDirectoryIcon size={14} />
          {scanning ? "Scanning…" : "Pick Backup Folder"}
        </Button>
      </div>

      {scannedPath && !scanning && entries.length > 0 && (
        <div
          style={{ display: "flex", flexDirection: "column", gap: "8px" }}
        >
          <p style={{ margin: 0, fontSize: "0.8rem", opacity: 0.5 }}>
            Found {entries.length} game backup{entries.length !== 1 ? "s" : ""}{" "}
            in <code>{scannedPath}</code>
          </p>
          {entries.map((entry) => {
            const state = importStates[entry.gameName];
            const isDone = state?.status === "done";
            const isImporting = state?.status === "importing";

            return (
              <div
                key={entry.gameName}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 14px",
                  borderRadius: "6px",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  opacity: isDone ? 0.6 : 1,
                }}
              >
                <span style={{ flex: 1, fontSize: "0.875rem" }}>
                  {entry.gameName}
                </span>
                {isDone ? (
                  <CheckCircleFillIcon size={16} />
                ) : (
                  <Button
                    type="button"
                    theme="outline"
                    disabled={isImporting}
                    onClick={() => handleImport(entry)}
                    style={{ fontSize: "0.8rem", padding: "4px 12px" }}
                  >
                    {isImporting ? "Uploading…" : "Upload to Cloud"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
