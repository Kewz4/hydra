import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import axios from "axios";
import { SystemPath } from "./system-path";
import { logger } from "./logger";

export const getGogdlInstallPath = (): string => {
  const binDir = path.join(SystemPath.getPath("userData"), "bin");
  fs.mkdirSync(binDir, { recursive: true });
  const ext = process.platform === "win32" ? ".exe" : "";
  return path.join(binDir, `gogdl${ext}`);
};

export const findGogdlBinary = (customPath?: string | null): string | null => {
  if (customPath && fs.existsSync(customPath)) return customPath;
  const ext = process.platform === "win32" ? ".exe" : "";
  // Check bundled binary first; also check exe-adjacent resources for portable builds
  const resourcesBin = path.join(process.resourcesPath ?? "", "bin");
  const execAdjacentBin = path.join(path.dirname(process.execPath ?? ""), "resources", "bin");
  for (const dir of [resourcesBin, execAdjacentBin]) {
    const candidate = path.join(dir, `gogdl${ext}`);
    if (fs.existsSync(candidate)) return candidate;
  }
  // Then user-downloaded binary
  const installPath = getGogdlInstallPath();
  if (fs.existsSync(installPath)) return installPath;
  // Check PATH
  try {
    const whichCmd = process.platform === "win32" ? "where" : "which";
    const { stdout } = require("node:child_process").execSync(`${whichCmd} gogdl`, { encoding: "utf8", timeout: 3000 });
    const bin = stdout.trim().split("\n")[0].trim();
    if (bin && fs.existsSync(bin)) return bin;
  } catch {}
  return null;
};

interface GitHubRelease {
  assets: { name: string; browser_download_url: string }[];
}

export const downloadGogdl = async (onProgress?: (pct: number) => void): Promise<string> => {
  const response = await axios.get<GitHubRelease>(
    "https://api.github.com/repos/Heroic-Games-Launcher/heroic-gogdl/releases/latest",
    { headers: { Accept: "application/vnd.github+json" } }
  );

  const assets = response.data.assets;
  let assetName: string;
  if (process.platform === "win32") {
    assetName = "gogdl.exe";
  } else if (process.platform === "darwin") {
    assetName = "gogdl_macos";
  } else {
    assetName = "gogdl_linux";
  }

  const asset = assets.find((a) => a.name === assetName) ?? assets.find((a) => a.name.startsWith("gogdl") && !a.name.endsWith(".tar.gz"));
  if (!asset) throw new Error(`No gogdl binary found for ${process.platform}`);

  const destPath = getGogdlInstallPath();
  const downloadResponse = await axios.get<ArrayBuffer>(asset.browser_download_url, {
    responseType: "arraybuffer",
    onDownloadProgress: (evt) => {
      if (evt.total && onProgress) onProgress(Math.round((evt.loaded / evt.total) * 100));
    },
  });

  fs.writeFileSync(destPath, Buffer.from(downloadResponse.data));
  if (process.platform !== "win32") fs.chmodSync(destPath, 0o755);
  logger.log(`gogdl downloaded to ${destPath}`);
  return destPath;
};

// Write GOG credentials to auth.json — heroic-gogdl expects this exact filename and fields
export const writeGogdlCredentials = (accessToken: string, refreshToken: string, userId: string): string => {
  const configDir = path.join(SystemPath.getPath("userData"), "gogdl-config");
  fs.mkdirSync(configDir, { recursive: true });
  // heroic-gogdl reads "auth.json" (NOT credentials.json) with user_id + access_token_created_at
  const credPath = path.join(configDir, "auth.json");
  const creds = {
    access_token: accessToken,
    refresh_token: refreshToken,
    user_id: userId,
    access_token_created_at: Math.floor(Date.now() / 1000),
    expires_in: 3600,
    token_type: "Bearer",
  };
  fs.writeFileSync(credPath, JSON.stringify(creds));
  return configDir;
};

export function spawnGogdlInstall(
  gameId: string,
  downloadPath: string,
  accessToken: string,
  refreshToken: string,
  userId: string,
  binaryPath: string | null | undefined,
  onProgress: (progress: number, downloadedMB: number, totalMB: number, speedMBs: number) => void,
  onComplete: () => void,
  onError: (err: string) => void,
  onLog?: (line: string, isError: boolean) => void
): () => void {
  const binary = findGogdlBinary(binaryPath);
  if (!binary) {
    onError("gogdl binary not found");
    return () => {};
  }

  const configDir = writeGogdlCredentials(accessToken, refreshToken, userId);

  // heroic-gogdl: --auth-config-path MUST come before the subcommand
  // Progress is output as JSON lines to stdout
  const child = spawn(binary, [
    "--auth-config-path", configDir,
    "download",
    gameId,
    "--platform", "windows",
    "--path", downloadPath,
  ], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PYTHONUNBUFFERED: "1" },
  });

  // heroic-gogdl outputs JSON lines:
  // {"status":"downloading","download_percent":45.2,"downloaded_size":900000000,"total_size":2000000000,"download_speed":52428800}
  // {"status":"done"} or {"status":"finished"}
  let completed = false;

  const handleLine = (line: string, isStderr = false) => {
    if (!line.trim()) return;
    logger.log(`[gogdl] ${line}`);
    onLog?.(line, isStderr);
    if (completed) return;

    // Try JSON parse first
    try {
      const json = JSON.parse(line.trim());
      const status = json.status as string | undefined;

      if (status === "done" || status === "finished" || status === "complete") {
        completed = true;
        onComplete();
        return;
      }

      if (status === "error") {
        onError(json.error ?? json.message ?? "gogdl error");
        return;
      }

      if (typeof json.download_percent === "number" || typeof json.progress === "number") {
        const pct = (json.download_percent ?? json.progress ?? 0) / 100;
        // sizes may be in bytes
        const toMB = (v: number) => v > 1_000_000 ? v / (1024 * 1024) : v;
        const downloaded = toMB(json.downloaded_size ?? json.downloaded ?? 0);
        const total = toMB(json.total_size ?? json.total ?? 0);
        // speed in bytes/s
        const speedMBs = (json.download_speed ?? json.speed ?? 0) / (1024 * 1024);
        onProgress(pct, downloaded, total, speedMBs);
        return;
      }
      return;
    } catch {}

    // Fallback: text progress patterns
    // "Progress: 45.23% [1234.56 MiB / 2345.67 MiB] @ 50.00 MiB/s"
    const textRegex = /(\d+\.?\d*)%.*?(\d+\.?\d*)\s*(?:MiB|MB)\s*\/\s*(\d+\.?\d*)\s*(?:MiB|MB).*?(\d+\.?\d*)\s*(?:MiB|MB)\/s/i;
    const m = line.match(textRegex);
    if (m) {
      onProgress(parseFloat(m[1]) / 100, parseFloat(m[2]), parseFloat(m[3]), parseFloat(m[4]));
      return;
    }
    if (/download\s+complete|finished|successfully/i.test(line)) {
      completed = true;
      onComplete();
    }
  };

  const splitLines = (buf: string): [string[], string] => {
    const parts = buf.split(/\r\n|\r|\n/);
    const remaining = parts.pop() ?? "";
    return [parts, remaining];
  };

  let stdoutBuf = "";
  child.stdout?.on("data", (chunk: Buffer) => {
    stdoutBuf += chunk.toString();
    const [lines, rest] = splitLines(stdoutBuf);
    stdoutBuf = rest;
    for (const line of lines) handleLine(line, false);
  });

  let stderrBuf = "";
  child.stderr?.on("data", (chunk: Buffer) => {
    stderrBuf += chunk.toString();
    const [lines, rest] = splitLines(stderrBuf);
    stderrBuf = rest;
    for (const line of lines) handleLine(line, true);
  });

  child.on("error", (err) => onError(err.message));
  child.on("close", (code) => {
    if (stderrBuf.trim()) handleLine(stderrBuf, true);
    if (stdoutBuf.trim()) handleLine(stdoutBuf, false);
    if (code !== 0 && code !== null) onError(`gogdl exited with code ${code}`);
  });

  return () => { try { child.kill(); } catch {} };
}
