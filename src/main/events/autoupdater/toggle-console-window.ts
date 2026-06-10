import { registerEvent } from "../register-event";
import { WindowManager } from "@main/services";

registerEvent("toggleConsoleWindow", async () => {
  WindowManager.toggleConsoleWindow();
});
