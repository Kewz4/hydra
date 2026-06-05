import path from "node:path";
import fs from "node:fs";
import { SystemPath } from "./system-path";

export interface BattleNetGame {
  productCode: string;
  title: string;
  iconUrl: string;
  launchUri: string;
  defaultInstallPaths: string[];
}

export const BATTLENET_GAMES: BattleNetGame[] = [
  {
    productCode: "WoW",
    title: "World of Warcraft",
    iconUrl: "https://blz-contentstack-images.akamaized.net/v3/assets/blt0e00eb81bc3100ea/blt6a8e6c8a1b2e4bdf/wow_icon.png",
    launchUri: "battlenet://WoW",
    defaultInstallPaths: [
      "C:\\Program Files (x86)\\World of Warcraft",
      "C:\\Program Files\\World of Warcraft",
    ],
  },
  {
    productCode: "Fenris",
    title: "Diablo IV",
    iconUrl: "https://blz-contentstack-images.akamaized.net/v3/assets/blt0e00eb81bc3100ea/blt9c5d4aef00e38a05/d4_icon.png",
    launchUri: "battlenet://Fenris",
    defaultInstallPaths: [
      "C:\\Program Files (x86)\\Diablo IV",
      "C:\\Program Files\\Diablo IV",
    ],
  },
  {
    productCode: "OSI",
    title: "Overwatch 2",
    iconUrl: "https://blz-contentstack-images.akamaized.net/v3/assets/blt0e00eb81bc3100ea/blt5c6b8a7ab5c5b8a7/ow2_icon.png",
    launchUri: "battlenet://OSI",
    defaultInstallPaths: [
      "C:\\Program Files (x86)\\Overwatch",
      "C:\\Program Files\\Overwatch",
    ],
  },
  {
    productCode: "D3",
    title: "Diablo III",
    iconUrl: "https://blz-contentstack-images.akamaized.net/v3/assets/blt0e00eb81bc3100ea/blt6e4f8f8f8f8f8f8f/d3_icon.png",
    launchUri: "battlenet://D3",
    defaultInstallPaths: [
      "C:\\Program Files (x86)\\Diablo III",
      "C:\\Program Files\\Diablo III",
    ],
  },
  {
    productCode: "S2",
    title: "StarCraft II",
    iconUrl: "https://blz-contentstack-images.akamaized.net/v3/assets/blt0e00eb81bc3100ea/blt7e4f8f8f8f8f8f8f/sc2_icon.png",
    launchUri: "battlenet://S2",
    defaultInstallPaths: [
      "C:\\Program Files (x86)\\StarCraft II",
      "C:\\Program Files\\StarCraft II",
    ],
  },
  {
    productCode: "HSB",
    title: "Hearthstone",
    iconUrl: "https://blz-contentstack-images.akamaized.net/v3/assets/blt0e00eb81bc3100ea/blt8e4f8f8f8f8f8f8f/hs_icon.png",
    launchUri: "battlenet://HSB",
    defaultInstallPaths: [
      "C:\\Program Files (x86)\\Hearthstone",
      "C:\\Program Files\\Hearthstone",
    ],
  },
  {
    productCode: "Hero",
    title: "Heroes of the Storm",
    iconUrl: "https://blz-contentstack-images.akamaized.net/v3/assets/blt0e00eb81bc3100ea/blt9e4f8f8f8f8f8f8f/hots_icon.png",
    launchUri: "battlenet://Hero",
    defaultInstallPaths: [
      "C:\\Program Files (x86)\\Heroes of the Storm",
      "C:\\Program Files\\Heroes of the Storm",
    ],
  },
  {
    productCode: "S1",
    title: "StarCraft Remastered",
    iconUrl: "https://blz-contentstack-images.akamaized.net/v3/assets/blt0e00eb81bc3100ea/bltae4f8f8f8f8f8f8f/sc1_icon.png",
    launchUri: "battlenet://S1",
    defaultInstallPaths: [
      "C:\\Program Files (x86)\\StarCraft",
      "C:\\Program Files\\StarCraft",
    ],
  },
  {
    productCode: "W3",
    title: "Warcraft III: Reforged",
    iconUrl: "https://blz-contentstack-images.akamaized.net/v3/assets/blt0e00eb81bc3100ea/bltbe4f8f8f8f8f8f8f/wc3_icon.png",
    launchUri: "battlenet://W3",
    defaultInstallPaths: [
      "C:\\Program Files (x86)\\Warcraft III",
      "C:\\Program Files\\Warcraft III",
    ],
  },
];

export const getBattleNetInstallPath = (): string | null => {
  if (process.platform === "win32") {
    const candidates = [
      "C:\\Program Files (x86)\\Battle.net\\Battle.net.exe",
      "C:\\Program Files\\Battle.net\\Battle.net.exe",
    ];
    return candidates.find((p) => fs.existsSync(p)) ?? null;
  }
  if (process.platform === "darwin") {
    const p = "/Applications/Battle.net.app/Contents/MacOS/Battle.net";
    return fs.existsSync(p) ? p : null;
  }
  return null;
};

export const detectInstalledBattleNetGames = (): BattleNetGame[] => {
  return BATTLENET_GAMES.filter((game) =>
    game.defaultInstallPaths.some((p) => fs.existsSync(p))
  );
};

export const isBattleNetInstalled = (): boolean => {
  return getBattleNetInstallPath() !== null;
};
