import { registerEvent } from "../register-event";
import { getLegendaryConfigPath } from "@main/services/legendary";
import { getLegendaryStatus } from "@main/services/legendary";
import fs from "node:fs";
import path from "node:path";

const epicSignOut = async (_event: Electron.IpcMainInvokeEvent) => {
  const configPath = getLegendaryConfigPath();
  // Remove the auth token file — legendary stores it as user.json
  const authFiles = ["user.json", "auth.json"];
  for (const file of authFiles) {
    const filePath = path.join(configPath, file);
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {
      // ignore
    }
  }
  return getLegendaryStatus();
};

registerEvent("epicSignOut", epicSignOut);
