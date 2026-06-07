import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs";
import axios from "axios";
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

const getPlatformSearchPaths = (): string[] => {
  const userData = SystemPath.getPath("userData");
  const binDir = path.join(userData, "bin");

  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA ?? "";
    return [
      path.join(binDir, "legendary.exe"),
      path.join(localAppData, "Programs", "legendary", "legendary.exe"),
      path.join(localAppData, "legendary", "legendary.exe"),
    ];
  }
  if (process.platform === "darwin") {
    return [
      path.join(binDir, "legendary"),
      "/usr/local/bin/legendary",
      "/opt/homebrew/bin/legendary",
      path.join(SystemPath.getPath("home"), ".local", "bin", "legendary"),
    ];
  }
  return [
    path.join(binDir, "legendary"),
    path.join(SystemPath.getPath("home"), ".local", "bin", "legendary"),
    "/usr/bin/legendary",
    "/usr/local/bin/legendary",
  ];
};

export const getLegendaryInstallPath = (): string => {
  const binDir = path.join(SystemPath.getPath("userData"), "bin");
  fs.mkdirSync(binDir, { recursive: true });
  const ext = process.platform === "win32" ? ".exe" : "";
  return path.join(binDir, `legendary${ext}`);
};

export const findLegendaryBinary = (customPath?: string | null): string | null => {
  if (customPath && fs.existsSync(customPath)) return customPath;

  for (const candidate of getPlatformSearchPaths()) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {}
  }

  // Try PATH via which/where
  try {
    const whichCmd = process.platform === "win32" ? "where" : "which";
    const { stdout } = require("node:child_process").execSync(`${whichCmd} legendary`, { encoding: "utf8", timeout: 3000 });
    const bin = stdout.trim().split("\n")[0].trim();
    if (bin && fs.existsSync(bin)) return bin;
  } catch {}

  return null;
};

const runLegendary = async (binary: string, args: string[]): Promise<string> => {
  const { stdout } = await execFileAsync(binary, args, { timeout: 60_000 });
  return stdout;
};

export const getLegendaryStatus = async (
  binaryPath?: string | null
): Promise<LegendaryStatus> => {
  const binary = findLegendaryBinary(binaryPath);
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
  const binary = findLegendaryBinary(binaryPath);
  if (!binary) throw new Error("legendary binary not found");

  const output = await runLegendary(binary, ["list", "--json"]);
  const data = JSON.parse(output);

  if (!Array.isArray(data)) throw new Error("Unexpected legendary output format");

  return data as LegendaryGame[];
};

export const authenticateLegendary = async (
  code: string,
  binaryPath?: string | null
): Promise<void> => {
  const binary = findLegendaryBinary(binaryPath);
  if (!binary) throw new Error("legendary binary not found");

  await execFileAsync(binary, ["auth", "--code", code.trim()], { timeout: 30_000 });
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

export function spawnLegendaryInstall(
  appName: string,
  downloadPath: string,
  binaryPath: string | null | undefined,
  onProgress: (progress: number, downloadedMB: number, totalMB: number, speedMBs: number) => void,
  onComplete: () => void,
  onError: (err: string) => void,
  onLog?: (line: string, isError: boolean) => void
): () => void {
  const binary = findLegendaryBinary(binaryPath);
  if (!binary) {
    onError("Legendary binary not found");
    return () => {};
  }

  const child = spawn(binary, ["install", appName, "--base-path", downloadPath, "--yes", "--skip-sdl"], {
    stdio: ["ignore", "pipe", "pipe"],
  });

  // Legendary progress formats (varies by version):
  //   "Progress: 12.34% (5678.90/45678.90 MiB), Running for ..."
  //   "Running for 00:00:05, downloaded 123.45 MiB of 4567.89 MiB at 12.34 MiB/s"
  const progressSlashRegex = /(\d+\.?\d*)\/(\d+\.?\d*)\s+MiB/;
  const progressOfRegex = /downloaded?\s+(\d+\.?\d*)\s+MiB\s+of\s+(\d+\.?\d*)\s+MiB/i;
  const speedRegex = /(\d+\.?\d*)\s+(?:MiB|MB)\/s/;
  const completeRegex = /Finished installation|Successfully installed|Install completed|Download completed/i;

  let lastSpeedMBs = 0;
  let completed = false;

  const handleLine = (line: string, isStderr: boolean) => {
    if (!line.trim()) return;
    onLog?.(line, isStderr);
    if (completed) return;

    const speedMatch = line.match(speedRegex);
    if (speedMatch) lastSpeedMBs = parseFloat(speedMatch[1]);

    const slashMatch = line.match(progressSlashRegex);
    const ofMatch = slashMatch ? null : line.match(progressOfRegex);
    const progressMatch = slashMatch ?? ofMatch;

    if (progressMatch) {
      const downloadedMB = parseFloat(progressMatch[1]);
      const totalMB = parseFloat(progressMatch[2]);
      const progress = totalMB > 0 ? downloadedMB / totalMB : 0;
      onProgress(progress, downloadedMB, totalMB, lastSpeedMBs);
      return;
    }
    if (completeRegex.test(line)) {
      completed = true;
      onComplete();
    }
  };

  let stdoutBuffer = "";
  child.stdout?.on("data", (chunk: Buffer) => {
    stdoutBuffer += chunk.toString();
    const lines = stdoutBuffer.split("\n");
    stdoutBuffer = lines.pop() ?? "";
    for (const line of lines) handleLine(line, false);
  });

  let stderrBuffer = "";
  child.stderr?.on("data", (chunk: Buffer) => {
    stderrBuffer += chunk.toString();
    const lines = stderrBuffer.split("\n");
    stderrBuffer = lines.pop() ?? "";
    for (const line of lines) handleLine(line, true);
  });

  child.on("error", (err) => onError(err.message));

  child.on("close", (code) => {
    if (stderrBuffer.trim()) handleLine(stderrBuffer, true);
    if (stdoutBuffer.trim()) handleLine(stdoutBuffer, false);
    if (!completed && code !== 0 && code !== null) {
      onError(`Legendary exited with code ${code}`);
    }
  });

  return () => {
    try { child.kill(); } catch {}
  };
}

interface GitHubRelease {
  assets: { name: string; browser_download_url: string }[];
}

export const downloadLegendary = async (
  onProgress?: (pct: number) => void
): Promise<string> => {
  const response = await axios.get<GitHubRelease>(
    "https://api.github.com/repos/legendary-gl/legendary/releases/latest",
    { headers: { Accept: "application/vnd.github+json" } }
  );

  const assets = response.data.assets;
  let assetName: string;

  if (process.platform === "win32") {
    assetName = "legendary.exe";
  } else if (process.platform === "darwin") {
    assetName = "legendary_macos";
  } else {
    assetName = "legendary_linux_x86_64";
  }

  const asset = assets.find((a) => a.name === assetName) ?? assets.find((a) => a.name.includes("legendary") && !a.name.endsWith(".tar.gz"));

  if (!asset) throw new Error(`No legendary binary found for ${process.platform}`);

  const destPath = getLegendaryInstallPath();

  const downloadResponse = await axios.get<ArrayBuffer>(asset.browser_download_url, {
    responseType: "arraybuffer",
    onDownloadProgress: (evt) => {
      if (evt.total && onProgress) onProgress(Math.round((evt.loaded / evt.total) * 100));
    },
  });

  fs.writeFileSync(destPath, Buffer.from(downloadResponse.data));

  if (process.platform !== "win32") {
    fs.chmodSync(destPath, 0o755);
  }

  logger.log(`legendary downloaded to ${destPath}`);
  return destPath;
};

