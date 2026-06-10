import { registerEvent } from "../register-event";
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";

export interface LudusaviBackupEntry {
  gameName: string;
  folderPath: string;
  hasMappingYaml: boolean;
}

const scanLudusaviBackupFolder = async (
  _event: Electron.IpcMainInvokeEvent,
  folderPath: string
): Promise<LudusaviBackupEntry[]> => {
  if (!fs.existsSync(folderPath)) return [];

  const entries: LudusaviBackupEntry[] = [];

  const items = fs.readdirSync(folderPath, { withFileTypes: true });
  for (const item of items) {
    if (!item.isDirectory()) continue;
    const gamePath = path.join(folderPath, item.name);
    const mappingPath = path.join(gamePath, "mapping.yaml");
    const hasMappingYaml = fs.existsSync(mappingPath);

    // Validate it looks like a real ludusavi backup
    if (hasMappingYaml) {
      try {
        const raw = fs.readFileSync(mappingPath, "utf8");
        const parsed = YAML.parse(raw) as { backups?: unknown[] };
        if (!Array.isArray(parsed?.backups)) continue;
      } catch {
        continue;
      }
    } else {
      continue;
    }

    entries.push({ gameName: item.name, folderPath: gamePath, hasMappingYaml });
  }

  return entries;
};

registerEvent("scanLudusaviBackupFolder", scanLudusaviBackupFolder);
