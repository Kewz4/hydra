import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import axios from "axios";
import { SystemPath } from "./system-path";
import { logger } from "./logger";

// This is GOG's public OAuth2 client ID — hardcoded in heroic-gogdl
const GOG_CLIENT_ID = "46899977096215655";

export const getGogdlInstallPath = (): string => {
  const binDir = path.join(SystemPath.getPath("userData"), "bin");
  fs.mkdirSync(binDir, { recursive: true });
  const ext = process.platform === "win32" ? ".exe" : "";
  return path.join(binDir, `gogdl${ext}`);
};

export const findGogdlBinary = (customPath?: string | null): string | null => {
  if (customPath && fs.existsSync(customPath)) return customPath;
  const ext = process.platform === "win32" ? ".exe" : "";
  const resourcesBin = path.join(process.resourcesPath ?? "", "bin");
  const execAdjacentBin = path.join(
    path.dirname(process.execPath ?? ""),
    "resources",
    "bin"
  );
  for (const dir of [resourcesBin, execAdjacentBin]) {
    const candidate = path.join(dir, `gogdl${ext}`);
    if (fs.existsSync(candidate)) return candidate;
  }
  const installPath = getGogdlInstallPath();
  if (fs.existsSync(installPath)) return installPath;
  try {
    const whichCmd = process.platform === "win32" ? "where" : "which";
    const { stdout } = require("node:child_process").execSync(
      `${whichCmd} gogdl`,
      { encoding: "utf8", timeout: 3000 }
    );
    const bin = stdout.trim().split("\n")[0].trim();
    if (bin && fs.existsSync(bin)) return bin;
  } catch {}
  return null;
};

interface GitHubRelease {
  assets: { name: string; browser_download_url: string }[];
}

export const downloadGogdl = async (
  onProgress?: (pct: number) => void
): Promise<string> => {
  const response = await axios.get<GitHubRelease>(
    "https://api.github.com/repos/Heroic-Games-Launcher/heroic-gogdl/releases/latest",
    { headers: { Accept: "application/vnd.github+json" } }
  );

  const assets = response.data.assets;
  const arch = process.arch === "arm64" ? "arm64" : "x86_64";
  let assetName: string;
  if (process.platform === "win32") {
    assetName = `gogdl_windows_${arch}.exe`;
  } else if (process.platform === "darwin") {
    assetName = `gogdl_macos_${arch}`;
  } else {
    assetName = `gogdl_linux_${arch}`;
  }

  const asset =
    assets.find((a) => a.name === assetName) ??
    assets.find(
      (a) => a.name.startsWith("gogdl_windows") && a.name.endsWith(".exe")
    ) ??
    assets.find(
      (a) =>
        a.name.startsWith("gogdl") &&
        !a.name.endsWith(".tar.gz") &&
        !a.name.endsWith(".zip")
    );
  if (!asset) throw new Error(`No gogdl binary found for ${process.platform}`);

  const destPath = getGogdlInstallPath();
  const downloadResponse = await axios.get<ArrayBuffer>(
    asset.browser_download_url,
    {
      responseType: "arraybuffer",
      onDownloadProgress: (evt) => {
        if (evt.total && onProgress)
          onProgress(Math.round((evt.loaded / evt.total) * 100));
      },
    }
  );

  fs.writeFileSync(destPath, Buffer.from(downloadResponse.data));
  if (process.platform !== "win32") fs.chmodSync(destPath, 0o755);
  logger.log(`gogdl downloaded to ${destPath}`);
  return destPath;
};

/**
 * Write the auth config file that heroic-gogdl expects.
 *
 * heroic-gogdl reads --auth-config-path as a JSON file whose top-level keys
 * are GOG OAuth2 client IDs. The entry for the public client ID must contain
 * access_token, refresh_token, expires_in, and loginTime (unix seconds).
 *
 * Returns the path to the written auth file.
 */
export const writeGogdlAuthConfig = (
  accessToken: string,
  refreshToken: string
): string => {
  const configDir = path.join(SystemPath.getPath("userData"), "gogdl-config");
  fs.mkdirSync(configDir, { recursive: true });
  const authPath = path.join(configDir, "auth.json");

  const config = {
    [GOG_CLIENT_ID]: {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 3600,
      loginTime: Math.floor(Date.now() / 1000),
    },
  };

  fs.writeFileSync(authPath, JSON.stringify(config, null, 2));
  return authPath;
};

export function spawnGogdlInstall(
  gameId: string,
  downloadPath: string,
  accessToken: string,
  refreshToken: string,
  binaryPath: string | null | undefined,
  onProgress: (
    progress: number,
    downloadedMB: number,
    totalMB: number,
    speedMBs: number
  ) => void,
  onComplete: () => void,
  onError: (err: string) => void,
  onLog?: (line: string, isError: boolean) => void
): () => void {
  const binary = findGogdlBinary(binaryPath);
  if (!binary) {
    onError("gogdl binary not found");
    return () => {};
  }

  const authConfigPath = writeGogdlAuthConfig(accessToken, refreshToken);

  const child = spawn(
    binary,
    [
      "--auth-config-path",
      authConfigPath,
      "download",
      gameId,
      "--platform",
      "windows",
      "--path",
      downloadPath,
      "--skip-dlcs",
      "--max-workers",
      "4",
    ],
    {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
    }
  );

  // heroic-gogdl emits human-readable progress lines on stderr, for example:
  //   [PROGRESS] INFO: = Progress: 45.50% /900000000//2000000000, Running for: 00:05:30, ETA: 00:03:15
  //   [PROGRESS] INFO:  + Download	- 5.25 MiB/s (raw) / 8.75 MiB/s (decompressed)
  //   [PROGRESS] INFO: = Downloaded: 450.00 MiB, Written: 425.50 MiB
  // Completion is signalled by a clean exit (code 0).

  let completed = false;
  let lastSpeedMBs = 0;
  let lastTotalMB = 0;
  let lastDownloadedMB = 0;

  const handleLine = (line: string, isStderr = false) => {
    if (!line.trim()) return;
    logger.log(`[gogdl] ${line}`);
    onLog?.(line, isStderr);
    if (completed) return;

    // Progress line: "Progress: 45.50% /900000000//2000000000, ..."
    // The bytes fields are written_total // total (bytes)
    const progressMatch = line.match(
      /Progress:\s+(\d+\.?\d*)%\s+\/(\d+)\/\/(\d+)/
    );
    if (progressMatch) {
      const pct = parseFloat(progressMatch[1]) / 100;
      const writtenBytes = parseFloat(progressMatch[2]);
      const totalBytes = parseFloat(progressMatch[3]);
      lastDownloadedMB = writtenBytes / (1024 * 1024);
      lastTotalMB = totalBytes / (1024 * 1024);
      onProgress(pct, lastDownloadedMB, lastTotalMB, lastSpeedMBs);
      return;
    }

    // Speed line: "Download	- 5.25 MiB/s (raw) / ..."
    const speedMatch = line.match(/Download\s+-\s+(\d+\.?\d*)\s+MiB\/s/);
    if (speedMatch) {
      lastSpeedMBs = parseFloat(speedMatch[1]);
      // Re-emit progress with updated speed if we already have totals
      if (lastTotalMB > 0) {
        const pct = lastTotalMB > 0 ? lastDownloadedMB / lastTotalMB : 0;
        onProgress(pct, lastDownloadedMB, lastTotalMB, lastSpeedMBs);
      }
      return;
    }

    // Downloaded/written summary line: "Downloaded: 450.00 MiB, Written: 425.50 MiB"
    const downloadedMatch = line.match(/Downloaded:\s+(\d+\.?\d*)\s+MiB/);
    if (downloadedMatch) {
      lastDownloadedMB = parseFloat(downloadedMatch[1]);
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
    // Flush any remaining buffered output
    if (stderrBuf.trim()) handleLine(stderrBuf, true);
    if (stdoutBuf.trim()) handleLine(stdoutBuf, false);

    if (completed) return;

    if (code === 0) {
      // Clean exit = success
      completed = true;
      onComplete();
    } else if (code !== null) {
      onError(`gogdl exited with code ${code}`);
    }
  });

  return () => {
    try {
      child.kill();
    } catch {}
  };
}
