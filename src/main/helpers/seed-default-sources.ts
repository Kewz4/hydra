import { downloadSourcesSublevel } from "@main/level";
import { DownloadSourceStatus } from "@shared";
import { randomUUID } from "node:crypto";

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
};
