import si from "systeminformation";
import { logger } from "./logger";

export interface HardwareInfo {
  cpu: string;
  gpu: string;
  ramMB: number;
  diskFreeGB: number;
}

let cachedInfo: HardwareInfo | null = null;

export async function getHardwareInfo(): Promise<HardwareInfo> {
  if (cachedInfo) return cachedInfo;

  try {
    const [cpu, graphics, mem, disk] = await Promise.all([
      si.cpu(),
      si.graphics(),
      si.mem(),
      si.fsSize(),
    ]);

    const gpuControllers = graphics.controllers ?? [];
    const primaryGpu =
      gpuControllers.find(
        (c) =>
          c.vendor?.toLowerCase().includes("nvidia") ||
          c.vendor?.toLowerCase().includes("amd") ||
          c.vendor?.toLowerCase().includes("advanced micro")
      ) ?? gpuControllers[0];

    const cpuName = `${cpu.manufacturer} ${cpu.brand}`.trim();
    const gpuName = primaryGpu
      ? `${primaryGpu.vendor ?? ""} ${primaryGpu.model ?? ""}`.trim()
      : "Unknown GPU";

    const ramMB = Math.round((mem.total ?? 0) / 1024 / 1024);

    const diskFreeGB = disk.reduce((sum, d) => {
      const free = (d.available ?? 0) / 1024 / 1024 / 1024;
      return sum + free;
    }, 0);

    cachedInfo = { cpu: cpuName, gpu: gpuName, ramMB, diskFreeGB };
    return cachedInfo;
  } catch (err) {
    logger.error("Failed to get hardware info", err);
    return { cpu: "Unknown", gpu: "Unknown", ramMB: 0, diskFreeGB: 0 };
  }
}
