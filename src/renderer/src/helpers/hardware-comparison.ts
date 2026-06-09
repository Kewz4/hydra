export type HardwareRating =
  | "perfect"
  | "good"
  | "low"
  | "struggle"
  | "unknown";

interface ParsedReqs {
  ramMB: number | null;
  cpuScore: number | null;
  gpuScore: number | null;
}

function parseRamMB(text: string): number | null {
  const m = text.match(/(\d+)\s*GB\s*RAM/i);
  if (m) return parseInt(m[1]) * 1024;
  const mb = text.match(/(\d+)\s*MB\s*RAM/i);
  if (mb) return parseInt(mb[1]);
  return null;
}

function gpuScore(name: string): number {
  if (!name) return 0;
  const n = name.toUpperCase();

  // NVIDIA RTX 40xx
  if (/RTX\s*4090/.test(n)) return 4090;
  if (/RTX\s*4080/.test(n)) return 4080;
  if (/RTX\s*4070\s*TI/.test(n)) return 4071;
  if (/RTX\s*4070/.test(n)) return 4070;
  if (/RTX\s*4060\s*TI/.test(n)) return 4061;
  if (/RTX\s*4060/.test(n)) return 4060;

  // NVIDIA RTX 30xx
  if (/RTX\s*3090/.test(n)) return 3900;
  if (/RTX\s*3080\s*TI/.test(n)) return 3810;
  if (/RTX\s*3080/.test(n)) return 3800;
  if (/RTX\s*3070\s*TI/.test(n)) return 3710;
  if (/RTX\s*3070/.test(n)) return 3700;
  if (/RTX\s*3060\s*TI/.test(n)) return 3610;
  if (/RTX\s*3060/.test(n)) return 3600;
  if (/RTX\s*3050/.test(n)) return 3500;

  // NVIDIA RTX 20xx
  if (/RTX\s*2080\s*TI/.test(n)) return 3400;
  if (/RTX\s*2080\s*SUPER/.test(n)) return 3350;
  if (/RTX\s*2080/.test(n)) return 3300;
  if (/RTX\s*2070\s*SUPER/.test(n)) return 3250;
  if (/RTX\s*2070/.test(n)) return 3200;
  if (/RTX\s*2060\s*SUPER/.test(n)) return 3150;
  if (/RTX\s*2060/.test(n)) return 3100;

  // NVIDIA GTX 16xx
  if (/GTX\s*1660\s*TI/.test(n)) return 2700;
  if (/GTX\s*1660\s*SUPER/.test(n)) return 2680;
  if (/GTX\s*1660/.test(n)) return 2660;
  if (/GTX\s*1650\s*SUPER/.test(n)) return 2630;
  if (/GTX\s*1650/.test(n)) return 2600;

  // NVIDIA GTX 10xx
  if (/GTX\s*1080\s*TI/.test(n)) return 2550;
  if (/GTX\s*1080/.test(n)) return 2500;
  if (/GTX\s*1070\s*TI/.test(n)) return 2470;
  if (/GTX\s*1070/.test(n)) return 2450;
  if (/GTX\s*1060\s*6/.test(n)) return 2400;
  if (/GTX\s*1060/.test(n)) return 2380;
  if (/GTX\s*1050\s*TI/.test(n)) return 2300;
  if (/GTX\s*1050/.test(n)) return 2250;

  // NVIDIA older
  if (/GTX\s*970/.test(n)) return 2100;
  if (/GTX\s*980/.test(n)) return 2150;
  if (/GTX\s*960/.test(n)) return 2000;
  if (/GTX\s*950/.test(n)) return 1900;

  // AMD RX 7xxx
  if (/RX\s*7900\s*XTX/.test(n)) return 4085;
  if (/RX\s*7900\s*XT/.test(n)) return 4050;
  if (/RX\s*7800\s*XT/.test(n)) return 3750;
  if (/RX\s*7700\s*XT/.test(n)) return 3680;
  if (/RX\s*7600/.test(n)) return 3580;

  // AMD RX 6xxx
  if (/RX\s*6950\s*XT/.test(n)) return 3880;
  if (/RX\s*6900\s*XT/.test(n)) return 3850;
  if (/RX\s*6800\s*XT/.test(n)) return 3800;
  if (/RX\s*6800/.test(n)) return 3750;
  if (/RX\s*6700\s*XT/.test(n)) return 3700;
  if (/RX\s*6700/.test(n)) return 3650;
  if (/RX\s*6650\s*XT/.test(n)) return 3620;
  if (/RX\s*6600\s*XT/.test(n)) return 3580;
  if (/RX\s*6600/.test(n)) return 3540;
  if (/RX\s*6500\s*XT/.test(n)) return 3300;

  // AMD RX 5xxx
  if (/RX\s*5700\s*XT/.test(n)) return 3450;
  if (/RX\s*5700/.test(n)) return 3400;
  if (/RX\s*5600\s*XT/.test(n)) return 3350;
  if (/RX\s*5500\s*XT/.test(n)) return 3200;

  // AMD older
  if (/RX\s*590/.test(n)) return 2350;
  if (/RX\s*580/.test(n)) return 2300;
  if (/RX\s*570/.test(n)) return 2200;
  if (/RX\s*560/.test(n)) return 2000;
  if (/RX\s*480/.test(n)) return 2280;
  if (/RX\s*470/.test(n)) return 2180;

  // Intel Arc
  if (/ARC\s*A770/.test(n)) return 3550;
  if (/ARC\s*A750/.test(n)) return 3480;
  if (/ARC\s*A580/.test(n)) return 3200;
  if (/ARC\s*A380/.test(n)) return 2800;

  return 0;
}

function cpuScore(name: string): number {
  if (!name) return 0;
  const n = name.toUpperCase();

  // Intel Core Ultra (Gen 2 / Arrow Lake)
  if (/CORE\s*ULTRA\s*9/.test(n)) return 10000;
  if (/CORE\s*ULTRA\s*7/.test(n)) return 9000;
  if (/CORE\s*ULTRA\s*5/.test(n)) return 8000;

  // Extract Intel i-series generation from model number
  // Pattern: i[3/5/7/9]-[generation][model] e.g., i7-13700K, i5-12600
  const intelMatch = n.match(/I([3579])[- ](\d{2,5})/);
  if (intelMatch) {
    const tier = parseInt(intelMatch[1]); // 3,5,7,9
    const model = parseInt(intelMatch[2]);
    // Extract generation (first 2 digits for 4-5 digit model, first 1 for 3 digit)
    const gen =
      model >= 10000
        ? Math.floor(model / 1000)
        : model >= 1000
          ? Math.floor(model / 100)
          : Math.floor(model / 100);
    return tier * 1000 + gen * 50;
  }

  // AMD Ryzen
  // Pattern: RYZEN [3/5/7/9] [gen][model] e.g., Ryzen 5 5600X, Ryzen 7 7700X
  const ryzenMatch = n.match(/RYZEN\s*([3579])\s+(\d{4})/);
  if (ryzenMatch) {
    const tier = parseInt(ryzenMatch[1]);
    const model = parseInt(ryzenMatch[2]);
    const gen = Math.floor(model / 1000);
    return tier * 1000 + gen * 50 - 50; // Slightly below Intel equivalent tier
  }

  // Ryzen Threadripper
  if (/THREADRIPPER/.test(n)) return 9500;

  // AMD FX
  if (/FX[- ]8/.test(n)) return 1500;
  if (/FX[- ]6/.test(n)) return 1200;

  // Intel Pentium/Celeron
  if (/PENTIUM/.test(n)) return 500;
  if (/CELERON/.test(n)) return 300;
  if (/ATOM/.test(n)) return 200;

  return 0;
}

function parseRequirements(html: string | undefined): ParsedReqs {
  if (!html) return { ramMB: null, cpuScore: null, gpuScore: null };

  const text = html.replace(/<[^>]+>/g, " ").replace(/&[^;]+;/g, " ");

  const ram = parseRamMB(text);

  // CPU: look for "Processor:" or "CPU:" line
  const cpuLine = text.match(/(?:Processor|CPU)\s*:?\s*([^\n<]{5,80})/i);
  const cpu = cpuScore(cpuLine ? cpuLine[1] : "");

  // GPU: look for "Graphics:" or "GPU:" or "Video:" line
  const gpuLine = text.match(/(?:Graphics|GPU|Video Card|Video)\s*:?\s*([^\n<]{5,80})/i);
  const gpu = gpuScore(gpuLine ? gpuLine[1] : "");

  return {
    ramMB: ram,
    cpuScore: cpu || null,
    gpuScore: gpu || null,
  };
}

export interface HardwareInfo {
  cpu: string;
  gpu: string;
  ramMB: number;
  diskFreeGB: number;
}

export function computeHardwareRating(
  hardware: HardwareInfo,
  minimumHtml: string | undefined,
  recommendedHtml: string | undefined
): HardwareRating {
  const minReqs = parseRequirements(minimumHtml);
  const recReqs = parseRequirements(recommendedHtml);

  const userCpuScore = cpuScore(hardware.cpu);
  const userGpuScore = gpuScore(hardware.gpu);
  const userRamMB = hardware.ramMB;

  // Need at least RAM info to make a determination
  if (!minReqs.ramMB && !minReqs.cpuScore && !minReqs.gpuScore) {
    return "unknown";
  }

  // Check against recommended first
  const meetsRecRam = !recReqs.ramMB || userRamMB >= recReqs.ramMB;
  const meetsRecCpu =
    !recReqs.cpuScore || !userCpuScore || userCpuScore >= recReqs.cpuScore;
  const meetsRecGpu =
    !recReqs.gpuScore || !userGpuScore || userGpuScore >= recReqs.gpuScore;

  if (meetsRecRam && meetsRecCpu && meetsRecGpu) return "perfect";

  // Check against minimum
  const meetsMinRam = !minReqs.ramMB || userRamMB >= minReqs.ramMB;
  const meetsMinCpu =
    !minReqs.cpuScore || !userCpuScore || userCpuScore >= minReqs.cpuScore;
  const meetsMinGpu =
    !minReqs.gpuScore || !userGpuScore || userGpuScore >= minReqs.gpuScore;

  if (meetsMinRam && meetsMinCpu && meetsMinGpu) return "good";

  // Check if close to minimum (within 20% below)
  const ramRatio = minReqs.ramMB ? userRamMB / minReqs.ramMB : 1;
  const cpuRatio =
    minReqs.cpuScore && userCpuScore ? userCpuScore / minReqs.cpuScore : 1;
  const gpuRatio =
    minReqs.gpuScore && userGpuScore ? userGpuScore / minReqs.gpuScore : 1;

  if (ramRatio >= 0.75 && cpuRatio >= 0.75 && gpuRatio >= 0.75) return "low";

  return "struggle";
}
