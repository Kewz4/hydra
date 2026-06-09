import { registerEvent } from "../register-event";
import { getHardwareInfo } from "@main/services/hardware-info";

registerEvent("getHardwareInfo", async () => getHardwareInfo());
