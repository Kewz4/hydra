import { registerEvent } from "../register-event";
import { findGameByTitle } from "@main/helpers/find-game-by-title";

const findLibraryGameByTitle = async (
  _event: Electron.IpcMainInvokeEvent,
  title: string
) => {
  const match = await findGameByTitle(title);
  if (!match) return null;
  return match[1];
};

registerEvent("findLibraryGameByTitle", findLibraryGameByTitle);
