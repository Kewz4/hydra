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

// Write GOG credentials to a temp file for gogdl to use
export const writeGogdlCredentials = (accessToken: string, refreshToken: string): string => {
  const configDir = path.join(SystemPath.getPath("userData"), "gogdl-config");
  fs.mkdirSync(configDir, { recursive: true });
  const credPath = path.join(configDir, "credentials.json");
  const creds = {
    access_token: accessToken,
    refresh_token: refreshToken,
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
  binaryPath: string | null | undefined,
  onProgress: (progress: number, downloadedMB: number, totalMB: number, speedMBs: number) => void,
  onComplete: () => void,
  onError: (err: string) => void
): () => void {
  const binary = findGogdlBinary(binaryPath);
  if (!binary) {
    onError("gogdl binary not found");
    return () => {};
  }

  const configDir = writeGogdlCredentials(accessToken, refreshToken);

  // gogdl download <gameId> --platform windows --path <downloadPath> --auth-config-path <configDir>
  const child = spawn(binary, [
    "download",
    gameId,
    "--platform", "windows",
    "--path", downloadPath,
    "--auth-config-path", configDir,
  ], {
    stdio: ["ignore", "pipe", "pipe"],
  });

  // gogdl outputs progress lines like:
  // "Progress: 45.23% [1234.56 MiB / 2345.67 MiB] @ 50.00 MiB/s"
  const progressRegex = /Progress:\s*(\d+\.?\d*)%.*?(\d+\.?\d*)\s*MiB\s*\/\s*(\d+\.?\d*)\s*MiB.*?(\d+\.?\d*)\s*MiB\/s/i;
  const completeRegex = /Download\s+complete|Finished|Successfully/i;

  const handleLine = (line: string) => {
    logger.log(`[gogdl] ${line}`);
    const m = line.match(progressRegex);
    if (m) {
      const pct = parseFloat(m[1]) / 100;
      const downloaded = parseFloat(m[2]);
      const total = parseFloat(m[3]);
      const speed = parseFloat(m[4]);
      onProgress(pct, downloaded, total, speed);
      return;
    }
    if (completeRegex.test(line)) {
      onComplete();
    }
  };

  let stdoutBuf = "";
  child.stdout?.on("data", (chunk: Buffer) => {
    stdoutBuf += chunk.toString();
    const lines = stdoutBuf.split("\n");
    stdoutBuf = lines.pop() ?? "";
    for (const line of lines) handleLine(line);
  });

  let stderrBuf = "";
  child.stderr?.on("data", (chunk: Buffer) => {
    stderrBuf += chunk.toString();
    const lines = stderrBuf.split("\n");
    stderrBuf = lines.pop() ?? "";
    for (const line of lines) handleLine(line);
  });

  child.on("error", (err) => onError(err.message));
  child.on("close", (code) => {
    if (stderrBuf) handleLine(stderrBuf);
    if (stdoutBuf) handleLine(stdoutBuf);
    if (code !== 0 && code !== null) onError(`gogdl exited with code ${code}`);
  });

  return () => { try { child.kill(); } catch {} };
}
