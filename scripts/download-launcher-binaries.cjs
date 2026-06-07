/**
 * Download legendary and gogdl binaries into binaries/bin/ before the Electron build.
 * Run via: node scripts/download-launcher-binaries.cjs
 * Or add to package.json prebuild script.
 *
 * Downloads:
 *  - legendary (Epic Games launcher CLI)
 *  - gogdl (heroic-gogdl for GOG downloads)
 *
 * Binaries land in binaries/bin/ and are picked up by electron-builder
 * via the extraResources entry in electron-builder.yml.
 */

const https = require("node:https");
const fs = require("node:fs");
const path = require("node:path");

const OUT_DIR = path.join(__dirname, "..", "binaries", "bin");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const get = (u) => {
      https.get(u, { headers: { "User-Agent": "gamehub-build-script" } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          get(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          file.close();
          reject(new Error(`HTTP ${res.statusCode} for ${u}`));
          return;
        }
        res.pipe(file);
        file.on("finish", () => file.close(resolve));
      }).on("error", reject);
    };
    get(url);
  });
}

async function getLatestRelease(owner, repo) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: "api.github.com",
      path: `/repos/${owner}/${repo}/releases/latest`,
      headers: { "User-Agent": "gamehub-build-script", Accept: "application/vnd.github+json" },
    };
    https.get(opts, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on("error", reject);
  });
}

async function downloadLegendary(platform) {
  console.log("Fetching legendary release info…");
  const release = await getLatestRelease("derrod", "legendary");
  const assetName = platform === "win32" ? "legendary.exe"
    : platform === "darwin" ? "legendary_macos"
    : "legendary_linux_x86_64";
  const asset = release.assets.find((a) => a.name === assetName)
    ?? release.assets.find((a) => a.name.startsWith("legendary") && !a.name.endsWith(".zip"));
  if (!asset) throw new Error(`No legendary asset for platform=${platform}`);
  const ext = platform === "win32" ? ".exe" : "";
  const dest = path.join(OUT_DIR, `legendary${ext}`);
  console.log(`Downloading legendary from ${asset.browser_download_url}…`);
  await download(asset.browser_download_url, dest);
  if (platform !== "win32") fs.chmodSync(dest, 0o755);
  console.log(`✓ legendary → ${dest}`);
}

async function downloadGogdl(platform) {
  console.log("Fetching gogdl release info…");
  const release = await getLatestRelease("Heroic-Games-Launcher", "heroic-gogdl");
  const assetName = platform === "win32" ? "gogdl.exe"
    : platform === "darwin" ? "gogdl_macos"
    : "gogdl_linux";
  const asset = release.assets.find((a) => a.name === assetName)
    ?? release.assets.find((a) => a.name.startsWith("gogdl") && !a.name.endsWith(".tar.gz"));
  if (!asset) throw new Error(`No gogdl asset for platform=${platform}`);
  const ext = platform === "win32" ? ".exe" : "";
  const dest = path.join(OUT_DIR, `gogdl${ext}`);
  console.log(`Downloading gogdl from ${asset.browser_download_url}…`);
  await download(asset.browser_download_url, dest);
  if (platform !== "win32") fs.chmodSync(dest, 0o755);
  console.log(`✓ gogdl → ${dest}`);
}

async function main() {
  const platform = process.argv[2] || process.platform;
  ensureDir(OUT_DIR);
  await Promise.all([downloadLegendary(platform), downloadGogdl(platform)]);
  console.log("All launcher binaries ready in", OUT_DIR);
}

main().catch((err) => {
  console.error("Error downloading binaries:", err);
  process.exit(1);
});
