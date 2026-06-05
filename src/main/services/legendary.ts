import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs";
import { SystemPath } from "./system-path";
import { logger } from "./logger";

const execFileAsync = promisify(execFile);

export interface LegendaryGame {
  app_name: string;
  app_title: string;
  is_installed: boolean;
  install_path?: string;
  key_images?: { type: string; url: string }[];
}

export interface LegendaryStatus {
  account: string | null;
  authenticated: boolean;
}

const LEGENDARY_SEARCH_PATHS: string[] = [
  "legendary",
  "legendary.exe",
];

const getPlatformSearchPaths = (): string[] => {
  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA ?? "";
    return [
      path.join(localAppData, "Programs", "legendary", "legendary.exe"),
      path.join(localAppData, "legendary", "legendary.exe"),
      "legendary.exe",
    ];
  }
  if (process.platform === "darwin") {
    return [
      "/usr/local/bin/legendary",
      "/opt/homebrew/bin/legendary",
      path.join(SystemPath.getPath("home"), ".local", "bin", "legendary"),
      "legendary",
    ];
  }
  return [
    path.join(SystemPath.getPath("home"), ".local", "bin", "legendary"),
    "/usr/bin/legendary",
    "/usr/local/bin/legendary",
    "legendary",
  ];
};

export const findLegendaryBinary = (): string | null => {
  for (const candidate of [...getPlatformSearchPaths(), ...LEGENDARY_SEARCH_PATHS]) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {}
  }
  return null;
};

const runLegendary = async (
  binary: string,
  args: string[]
): Promise<string> => {
  const { stdout } = await execFileAsync(binary, args, { timeout: 30_000 });
  return stdout;
};

export const getLegendaryStatus = async (
  binaryPath?: string | null
): Promise<LegendaryStatus> => {
  const binary = binaryPath || findLegendaryBinary();
  if (!binary) return { account: null, authenticated: false };

  try {
    const output = await runLegendary(binary, ["status", "--json"]);
    const data = JSON.parse(output);
    return {
      account: data.account ?? null,
      authenticated: Boolean(data.account),
    };
  } catch (err) {
    logger.error("legendary status failed", err);
    return { account: null, authenticated: false };
  }
};

export const getLegendaryGames = async (
  binaryPath?: string | null
): Promise<LegendaryGame[]> => {
  const binary = binaryPath || findLegendaryBinary();
  if (!binary) throw new Error("legendary binary not found");

  const output = await runLegendary(binary, ["list", "--json"]);
  const data = JSON.parse(output);

  if (!Array.isArray(data)) {
    throw new Error("Unexpected legendary output format");
  }

  return data as LegendaryGame[];
};

export const launchLegendaryGame = async (
  appName: string,
  binaryPath?: string | null
): Promise<void> => {
  const binary = binaryPath || findLegendaryBinary();
  if (!binary) throw new Error("legendary binary not found");

  execFile(binary, ["launch", appName, "--skip-version-check"], {
    detached: true,
    stdio: "ignore",
  }).unref();
};

export const getLegendaryGameCoverUrl = (game: LegendaryGame): string | null => {
  if (!game.key_images?.length) return null;
  const priority = ["DieselGameBoxTall", "DieselGameBox", "Thumbnail", "DieselGameBoxWide"];
  for (const type of priority) {
    const img = game.key_images.find((k) => k.type === type);
    if (img) return img.url;
  }
  return game.key_images[0]?.url ?? null;
};
