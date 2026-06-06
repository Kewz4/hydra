import { downloadSourcesSublevel } from "@main/level";
import { HydraApi } from "@main/services/hydra-api";
import { DownloadSourceStatus } from "@shared";
import { randomUUID } from "node:crypto";
import type { DownloadSource } from "@types";
import { logger } from "@main/services/logger";

const DEFAULT_SOURCES = [
  {
    url: "https://wkeynhk.online/steamgg.json",
    name: "SteamGG",
  },
  {
    url: "https://hydralinks.cloud/sources/rexagames.json",
    name: "RexaGames",
  },
  {
    url: "https://hydralinks.cloud/sources/onlinefix.json",
    name: "OnlineFix",
  },
  {
    url: "https://hydralinks.cloud/sources/fitgirl.json",
    name: "FitGirl",
  },
];

export const seedDefaultSources = async () => {
  const existingSources = await downloadSourcesSublevel.values().all();
  const existingUrls = new Set(existingSources.map((s) => s.url));

  for (const source of DEFAULT_SOURCES) {
    if (existingUrls.has(source.url)) continue;

    try {
      // Register with the Hydra API so the server assigns a known ID for repack matching
      const registered = await HydraApi.post<DownloadSource>(
        "/download-sources",
        { url: source.url },
        { needsAuth: false }
      );

      await downloadSourcesSublevel.put(registered.id, {
        ...registered,
        name: source.name,
        isRemote: true,
        createdAt: registered.createdAt ?? new Date().toISOString(),
      });

      logger.log(`Seeded download source via API: ${source.name}`);
    } catch (err) {
      logger.warn(
        `Could not register source ${source.name} with API, falling back to local ID`,
        err
      );

      // Fallback: store locally with a random ID (download links won't be matched
      // until the user is online and syncDownloadSources succeeds)
      const id = randomUUID();
      await downloadSourcesSublevel.put(id, {
        id,
        name: source.name,
        url: source.url,
        status: DownloadSourceStatus.PendingMatching,
        downloadCount: 0,
        isRemote: true,
        createdAt: new Date().toISOString(),
      });
    }
  }
};
