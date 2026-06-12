/** Folder names that identify an official store/launcher install. A scanned
 * executable under one of these is a game the user genuinely owns on that
 * platform ("sync"). Anything else found on disk (C:\Games, repack installs,
 * arbitrary folders) is NOT proof of store ownership. */
const STORE_FOLDER_MARKERS = [
  "steamapps", // Steam
  "epic games", // Epic Games Launcher
  "gog galaxy", // GOG Galaxy
  "gog games",
  "ubisoft game launcher", // Ubisoft Connect
  "ea games", // EA app
  "origin games",
  "battle.net",
  "riot games",
  "windowsapps", // Xbox / Microsoft Store
  "xboxgames",
];

type LibraryOrigin = "sync" | "catalog" | "custom";

/**
 * Decide the libraryOrigin for a game whose executable was found by a disk
 * scan. Store folders → "sync"; otherwise keep how the game originally
 * entered the library (e.g. a catalogue repack stays "catalog"/Retigga), and
 * games with no prior origin become "custom" — per the scan-found-games
 * definition of the Custom filter.
 */
export function classifyScannedOrigin(
  executablePath: string,
  existingOrigin?: LibraryOrigin
): LibraryOrigin {
  const normalized = executablePath.toLowerCase().replace(/\\/g, "/");
  if (STORE_FOLDER_MARKERS.some((marker) => normalized.includes(marker))) {
    return "sync";
  }
  return existingOrigin ?? "custom";
}
