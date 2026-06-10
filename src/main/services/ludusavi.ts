import type { GameShop, LudusaviBackup, LudusaviConfig } from "@types";

import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import cp from "node:child_process";
import { SystemPath } from "./system-path";
import { logger } from "./logger";

export class Ludusavi {
  private static ludusaviResourcesPath = app.isPackaged
    ? path.join(process.resourcesPath, "ludusavi")
    : path.join(__dirname, "..", "..", "ludusavi");

  private static binaryName =
    process.platform === "win32" ? "ludusavi.exe" : "ludusavi";

  // Lazy getters so app.getPath() is called after app.setPath() runs in portable mode
  private static get configPath() {
    return path.join(SystemPath.getPath("userData"), "ludusavi");
  }

  private static get binaryPath() {
    return path.join(this.configPath, this.binaryName);
  }

  public static async getConfig() {
    const config = YAML.parse(
      fs.readFileSync(path.join(this.configPath, "config.yaml"), "utf-8")
    ) as LudusaviConfig;

    return config;
  }

  public static async copyConfigFileToUserData() {
    const configFile = path.join(this.configPath, "config.yaml");

    if (!fs.existsSync(this.configPath)) {
      fs.mkdirSync(this.configPath, { recursive: true });
    }

    if (!fs.existsSync(configFile)) {
      fs.cpSync(
        path.join(this.ludusaviResourcesPath, "config.yaml"),
        configFile
      );
      return;
    }

    // Self-heal configs from older versions that shipped with the primary
    // manifest disabled — without it ludusavi knows almost no games.
    try {
      const config = YAML.parse(fs.readFileSync(configFile, "utf-8"));
      if (config?.manifest && config.manifest.enable !== true) {
        config.manifest.enable = true;
        fs.writeFileSync(configFile, YAML.stringify(config));
        logger.info("[ludusavi] re-enabled primary manifest in config.yaml");
      }
    } catch (error) {
      logger.warn("[ludusavi] could not check/heal config.yaml", error);
    }
  }

  public static async copyBinaryToUserData() {
    if (!fs.existsSync(this.binaryPath)) {
      fs.cpSync(
        path.join(this.ludusaviResourcesPath, this.binaryName),
        this.binaryPath
      );
    }
  }

  /** Update the ludusavi manifest (downloads game database from CDN). */
  public static async updateManifest(): Promise<void> {
    return new Promise((resolve) => {
      logger.info("[ludusavi] updating manifest…");
      cp.execFile(
        this.binaryPath,
        ["--config", this.configPath, "manifest", "update"],
        { timeout: 60_000 },
        (err, stdout, stderr) => {
          if (err) {
            logger.warn(`[ludusavi] manifest update failed: ${err.message}`);
          } else {
            logger.info("[ludusavi] manifest updated successfully");
          }
          if (stderr?.trim())
            logger.verbose(`[ludusavi:manifest] ${stderr.trim()}`);
          if (stdout?.trim())
            logger.verbose(`[ludusavi:manifest] ${stdout.trim()}`);
          resolve();
        }
      );
    });
  }

  /** Make sure the game database (manifest) has been downloaded. */
  private static async ensureManifest(): Promise<void> {
    const manifestPath = path.join(this.configPath, "manifest.yaml");
    if (!fs.existsSync(manifestPath)) {
      await this.updateManifest();
    }
  }

  /**
   * Resolve the canonical manifest name for a game. The manifest is keyed by
   * exact title, so "Neon Abyss" only matches if it's spelled identically.
   * `find --steam-id` looks the game up by its Steam App ID (exact), and
   * `find --fuzzy <title>` tolerates spelling differences.
   */
  public static async findCanonicalName(
    shop: GameShop,
    title: string,
    objectId?: string | null
  ): Promise<string | null> {
    await this.ensureManifest();

    const attempts: string[][] = [];

    if (shop === "steam" && objectId && /^\d+$/.test(objectId)) {
      attempts.push(["find", "--api", "--steam-id", objectId]);
    }
    if (shop === "gog" && objectId && /^\d+$/.test(objectId)) {
      attempts.push(["find", "--api", "--gog-id", objectId]);
    }
    attempts.push(["find", "--api", "--fuzzy", title]);

    for (const findArgs of attempts) {
      const args = ["--config", this.configPath, ...findArgs];
      const result = await new Promise<string | null>((resolve) => {
        cp.execFile(
          this.binaryPath,
          args,
          { timeout: 30_000 },
          (err, stdout) => {
            if (err) return resolve(null);
            try {
              const parsed = JSON.parse(stdout) as {
                games?: Record<string, unknown>;
              };
              const names = Object.keys(parsed.games ?? {});
              resolve(names[0] ?? null);
            } catch {
              resolve(null);
            }
          }
        );
      });

      if (result) {
        if (result !== title) {
          logger.info(
            `[ludusavi] resolved "${title}" to manifest name "${result}"`
          );
        }
        return result;
      }
    }

    logger.warn(`[ludusavi] could not find "${title}" in manifest`);
    return null;
  }

  public static async backupGame(
    _shop: GameShop,
    gameName: string,
    backupPath?: string | null,
    winePrefix?: string | null,
    preview?: boolean
  ): Promise<LudusaviBackup> {
    return new Promise((resolve, reject) => {
      const args = [
        "--config",
        this.configPath,
        "backup",
        gameName,
        "--api",
        "--force",
      ];

      if (preview) args.push("--preview");
      if (backupPath) args.push("--path", backupPath);
      if (winePrefix) args.push("--wine-prefix", winePrefix);

      logger.verbose(`[ludusavi] ${this.binaryPath} ${args.join(" ")}`);
      cp.execFile(
        this.binaryPath,
        args,
        (err: cp.ExecFileException | null, stdout: string, stderr: string) => {
          if (stderr?.trim()) {
            logger.verbose(`[ludusavi:stderr] ${stderr.trim()}`);
          }
          if (err) {
            logger.error(`[ludusavi] error for ${gameName}: ${err.message}`);
            return reject(err);
          }

          try {
            const parsed = JSON.parse(stdout) as LudusaviBackup;
            const foundGames = Object.keys(parsed.games ?? {});
            logger.verbose(
              `[ludusavi] completed for ${gameName} — games found: ${
                foundGames.length ? foundGames.join(", ") : "none"
              }`
            );
            return resolve(parsed);
          } catch (parseErr) {
            logger.error(
              `[ludusavi] could not parse output for ${gameName}: ${stdout.slice(0, 500)}`
            );
            return reject(parseErr);
          }
        }
      );
    });
  }

  public static async getBackupPreview(
    shop: GameShop,
    gameTitle: string,
    objectId?: string | null,
    winePrefix?: string | null
  ): Promise<LudusaviBackup | null> {
    const config = await this.getConfig();

    await this.ensureManifest();

    let backupData = await this.backupGame(
      shop,
      gameTitle,
      null,
      winePrefix,
      true
    );

    // If the exact title isn't in the manifest, resolve the canonical name
    // (by Steam/GOG ID or fuzzy title) and retry.
    if (!backupData.games?.[gameTitle]) {
      const canonicalName = await this.findCanonicalName(
        shop,
        gameTitle,
        objectId
      );

      if (canonicalName && canonicalName !== gameTitle) {
        backupData = await this.backupGame(
          shop,
          canonicalName,
          null,
          winePrefix,
          true
        );

        // Alias under the requested title so callers can index by it
        if (backupData.games?.[canonicalName]) {
          backupData.games[gameTitle] = backupData.games[canonicalName];
        }
      }
    }

    const customGame = config.customGames.find(
      (game) => game.name === gameTitle
    );

    return {
      ...backupData,
      customBackupPath: customGame?.files[0] || null,
    };
  }

  static async addCustomGame(title: string, savePath: string | null) {
    const config = await this.getConfig();
    const filteredGames = config.customGames.filter(
      (game) => game.name !== title
    );

    if (savePath) {
      filteredGames.push({
        name: title,
        files: [savePath],
        registry: [],
      });
    }

    config.customGames = filteredGames;

    fs.writeFileSync(
      path.join(this.configPath, "config.yaml"),
      YAML.stringify(config)
    );
  }
}
