export type HardwareRating =
  | "ultra"
  | "high"
  | "medium"
  | "low"
  | "struggle"
  | "unknown";

export interface HardwareRatingDetails {
  rating: HardwareRating;
  headline: string;
  detail: string;
}

export interface HardwareInfo {
  cpu: string;
  gpu: string;
  ramMB: number;
  diskFreeGB: number;
}

// ---------------------------------------------------------------------------
// PassMark G3D Mark scores (approximate, sourced from passmark.com benchmarks)
// Entries are ordered so more specific names come before shorter ones to avoid
// partial-match false positives (e.g. "RTX 3080 Ti" before "RTX 3080").
// ---------------------------------------------------------------------------
const GPU_DB: [string, number][] = [
  // NVIDIA RTX 40 series
  ["RTX 4090", 39500],
  ["RTX 4080 Super", 34000],
  ["RTX 4080", 32000],
  ["RTX 4070 Ti Super", 30000],
  ["RTX 4070 Ti", 27500],
  ["RTX 4070 Super", 25000],
  ["RTX 4070", 22000],
  ["RTX 4060 Ti 16GB", 19500],
  ["RTX 4060 Ti", 18500],
  ["RTX 4060", 15000],
  ["RTX 4050", 11000],
  // NVIDIA RTX 30 series
  ["RTX 3090 Ti", 29000],
  ["RTX 3090", 25500],
  ["RTX 3080 Ti", 24500],
  ["RTX 3080 12GB", 23500],
  ["RTX 3080", 22500],
  ["RTX 3070 Ti", 20000],
  ["RTX 3070", 18000],
  ["RTX 3060 Ti", 16000],
  ["RTX 3060", 13000],
  ["RTX 3050", 9500],
  // NVIDIA RTX 20 series
  ["RTX 2080 Ti", 16000],
  ["RTX 2080 Super", 14500],
  ["RTX 2080", 13500],
  ["RTX 2070 Super", 13000],
  ["RTX 2070", 12000],
  ["RTX 2060 Super", 11500],
  ["RTX 2060", 10500],
  // NVIDIA GTX 16 series
  ["GTX 1660 Ti", 9500],
  ["GTX 1660 Super", 9000],
  ["GTX 1660", 8500],
  ["GTX 1650 Super", 7000],
  ["GTX 1650", 5500],
  // NVIDIA GTX 10 series
  ["GTX 1080 Ti", 12000],
  ["GTX 1080", 10000],
  ["GTX 1070 Ti", 9500],
  ["GTX 1070", 9000],
  ["GTX 1060 6GB", 7200],
  ["GTX 1060 3GB", 6000],
  ["GTX 1060", 7000],
  ["GTX 1050 Ti", 5000],
  ["GTX 1050", 4000],
  // NVIDIA GTX 900 series
  ["GTX 980 Ti", 8000],
  ["GTX 980", 7000],
  ["GTX 970", 6000],
  ["GTX 960", 4500],
  ["GTX 950", 3500],
  // NVIDIA GTX 700 series
  ["GTX 780 Ti", 5500],
  ["GTX 780", 5000],
  ["GTX 770", 4000],
  ["GTX 760", 3000],
  // NVIDIA older / mobile
  ["RTX 3080 Laptop", 14000],
  ["RTX 3070 Laptop", 12000],
  ["RTX 3060 Laptop", 9000],
  ["RTX 2070 Laptop", 9500],
  ["RTX 2060 Laptop", 8000],
  ["GTX 1660 Ti Mobile", 7500],
  ["GTX 1070 Max-Q", 7000],
  ["GTX 1060 Max-Q", 5500],
  // AMD RX 7000 series
  ["RX 7900 XTX", 36000],
  ["RX 7900 GRE", 30000],
  ["RX 7900 XT", 32000],
  ["RX 7800 XT", 22000],
  ["RX 7700 XT", 18000],
  ["RX 7600 XT", 16000],
  ["RX 7600", 15000],
  ["RX 7500 XT", 10000],
  // AMD RX 6000 series
  ["RX 6950 XT", 27500],
  ["RX 6900 XT", 25500],
  ["RX 6800 XT", 23500],
  ["RX 6800", 21000],
  ["RX 6750 XT", 19500],
  ["RX 6700 XT", 17500],
  ["RX 6700", 15500],
  ["RX 6650 XT", 14000],
  ["RX 6600 XT", 13000],
  ["RX 6600", 12000],
  ["RX 6500 XT", 7000],
  ["RX 6400", 5000],
  // AMD RX 5000 series
  ["RX 5700 XT", 12500],
  ["RX 5700", 11000],
  ["RX 5600 XT", 10000],
  ["RX 5500 XT 8GB", 8000],
  ["RX 5500 XT", 7500],
  ["RX 5500", 7000],
  // AMD RX 500 series
  ["RX 590", 7000],
  ["RX 580 8GB", 6500],
  ["RX 580", 6500],
  ["RX 570 8GB", 5800],
  ["RX 570", 5500],
  ["RX 560", 3500],
  ["RX 480 8GB", 6500],
  ["RX 480", 6200],
  ["RX 470 8GB", 5500],
  ["RX 470", 5000],
  ["RX 460", 3000],
  // AMD R9 series
  ["R9 390X", 5000],
  ["R9 390", 4500],
  ["R9 380X", 3500],
  ["R9 380", 3000],
  ["R9 290X", 4500],
  ["R9 290", 4000],
  ["R9 280X", 3500],
  // Intel Arc
  ["Arc A770 16GB", 14000],
  ["Arc A770", 13500],
  ["Arc A750", 11500],
  ["Arc A580", 10000],
  ["Arc A380", 6500],
  ["Arc A310", 4000],
  // Integrated (rough estimates)
  ["Intel Iris Xe", 2000],
  ["Intel UHD 770", 1500],
  ["Intel UHD 750", 1200],
  ["Intel UHD 730", 1000],
  ["Intel UHD 630", 800],
  ["AMD Radeon 680M", 3000],
  ["AMD Radeon 660M", 2000],
  ["AMD Vega 8", 1500],
  ["AMD Vega 11", 1800],
];

// ---------------------------------------------------------------------------
// PassMark CPU Mark scores (approximate, sourced from passmark.com)
// ---------------------------------------------------------------------------
const CPU_DB: [string, number][] = [
  // Intel Core Ultra (Meteor Lake / Arrow Lake)
  ["Core Ultra 9 285K", 72000],
  ["Core Ultra 7 265K", 62000],
  ["Core Ultra 5 245K", 50000],
  ["Core Ultra 9 185H", 40000],
  ["Core Ultra 7 165H", 35000],
  ["Core Ultra 5 125H", 28000],
  // Intel 14th gen
  ["i9-14900KS", 68000],
  ["i9-14900K", 65000],
  ["i9-14900KF", 64000],
  ["i9-14900F", 55000],
  ["i9-14900", 55000],
  ["i7-14700K", 54000],
  ["i7-14700KF", 53000],
  ["i7-14700F", 46000],
  ["i7-14700", 46000],
  ["i5-14600K", 45000],
  ["i5-14600KF", 44000],
  ["i5-14500", 35000],
  ["i5-14400F", 32000],
  ["i5-14400", 32000],
  ["i3-14100F", 17000],
  ["i3-14100", 17000],
  // Intel 13th gen
  ["i9-13900KS", 65000],
  ["i9-13900K", 62000],
  ["i9-13900KF", 61000],
  ["i9-13900F", 50000],
  ["i9-13900", 50000],
  ["i7-13700K", 50000],
  ["i7-13700KF", 49000],
  ["i7-13700F", 42000],
  ["i7-13700", 42000],
  ["i5-13600K", 43000],
  ["i5-13600KF", 42000],
  ["i5-13500", 33000],
  ["i5-13400F", 32000],
  ["i5-13400", 31000],
  ["i3-13100F", 16500],
  ["i3-13100", 16500],
  // Intel 12th gen
  ["i9-12900KS", 53000],
  ["i9-12900K", 51000],
  ["i9-12900KF", 50000],
  ["i9-12900F", 44000],
  ["i9-12900", 44000],
  ["i7-12700K", 42000],
  ["i7-12700KF", 41000],
  ["i7-12700F", 38000],
  ["i7-12700", 38000],
  ["i5-12600K", 34000],
  ["i5-12600KF", 33000],
  ["i5-12500", 27000],
  ["i5-12400F", 27000],
  ["i5-12400", 27000],
  ["i3-12100F", 15000],
  ["i3-12100", 15000],
  // Intel 11th gen
  ["i9-11900K", 29000],
  ["i9-11900KF", 28500],
  ["i7-11700K", 26000],
  ["i7-11700KF", 25500],
  ["i5-11600K", 21000],
  ["i5-11600KF", 20500],
  ["i5-11400F", 18500],
  ["i5-11400", 18500],
  ["i3-11100", 11000],
  // Intel 10th gen
  ["i9-10900K", 26000],
  ["i9-10900KF", 25500],
  ["i9-10900F", 22000],
  ["i9-10900", 22000],
  ["i7-10700K", 23000],
  ["i7-10700KF", 22500],
  ["i7-10700F", 19000],
  ["i7-10700", 19000],
  ["i5-10600K", 18000],
  ["i5-10600KF", 17500],
  ["i5-10400F", 14500],
  ["i5-10400", 14500],
  ["i3-10100F", 9500],
  ["i3-10100", 9500],
  // Intel 9th gen
  ["i9-9900K", 21000],
  ["i9-9900KF", 20500],
  ["i7-9700K", 17500],
  ["i7-9700KF", 17000],
  ["i5-9600K", 13500],
  ["i5-9600KF", 13000],
  ["i5-9400F", 11500],
  ["i5-9400", 11500],
  ["i3-9100F", 7500],
  ["i3-9100", 7500],
  // Intel 8th gen
  ["i7-8700K", 15500],
  ["i7-8700", 14000],
  ["i5-8600K", 12500],
  ["i5-8400", 11000],
  ["i3-8100", 7500],
  // Intel 7th gen
  ["i7-7700K", 12000],
  ["i7-7700", 10500],
  ["i5-7600K", 9000],
  ["i5-7400", 7500],
  ["i3-7100", 5500],
  // Intel 6th gen
  ["i7-6700K", 10000],
  ["i7-6700", 9000],
  ["i5-6600K", 8000],
  ["i5-6400", 6500],
  ["i3-6100", 5000],
  // Intel Pentium/Celeron
  ["Pentium G4560", 4000],
  ["Pentium G4400", 3500],
  ["Celeron G4930", 2500],
  // AMD Ryzen 9000 series
  ["Ryzen 9 9950X", 80000],
  ["Ryzen 9 9900X", 68000],
  ["Ryzen 7 9700X", 56000],
  ["Ryzen 5 9600X", 46000],
  // AMD Ryzen 7000 series
  ["Ryzen 9 7950X3D", 78000],
  ["Ryzen 9 7950X", 75000],
  ["Ryzen 9 7900X3D", 65000],
  ["Ryzen 9 7900X", 63000],
  ["Ryzen 9 7900", 58000],
  ["Ryzen 7 7800X3D", 55000],
  ["Ryzen 7 7700X", 50000],
  ["Ryzen 7 7700", 46000],
  ["Ryzen 5 7600X", 41000],
  ["Ryzen 5 7600", 38000],
  ["Ryzen 5 7500F", 36000],
  ["Ryzen 3 7300X", 22000],
  // AMD Ryzen 5000 series
  ["Ryzen 9 5950X", 57000],
  ["Ryzen 9 5900X", 48000],
  ["Ryzen 9 5900", 44000],
  ["Ryzen 7 5800X3D", 41000],
  ["Ryzen 7 5800X", 37000],
  ["Ryzen 7 5800", 34000],
  ["Ryzen 7 5700X", 33000],
  ["Ryzen 7 5700G", 28000],
  ["Ryzen 5 5600X", 28000],
  ["Ryzen 5 5600G", 23000],
  ["Ryzen 5 5600", 26000],
  ["Ryzen 5 5500", 21000],
  ["Ryzen 3 5300G", 14000],
  ["Ryzen 3 5100", 10000],
  // AMD Ryzen 3000 series
  ["Ryzen 9 3950X", 40000],
  ["Ryzen 9 3900X", 36000],
  ["Ryzen 9 3900", 34000],
  ["Ryzen 7 3800X", 28000],
  ["Ryzen 7 3800XT", 29000],
  ["Ryzen 7 3700X", 26000],
  ["Ryzen 5 3600X", 22000],
  ["Ryzen 5 3600XT", 22500],
  ["Ryzen 5 3600", 20000],
  ["Ryzen 5 3500X", 17000],
  ["Ryzen 5 3500", 15000],
  ["Ryzen 3 3300X", 14000],
  ["Ryzen 3 3100", 13000],
  // AMD Ryzen 2000 series
  ["Ryzen 7 2700X", 16000],
  ["Ryzen 7 2700", 15000],
  ["Ryzen 5 2600X", 13000],
  ["Ryzen 5 2600", 12000],
  ["Ryzen 3 2300X", 8000],
  ["Ryzen 3 2200G", 6500],
  // AMD Ryzen 1000 series
  ["Ryzen 7 1800X", 13000],
  ["Ryzen 7 1700X", 12000],
  ["Ryzen 7 1700", 11000],
  ["Ryzen 5 1600X", 10000],
  ["Ryzen 5 1600", 9500],
  ["Ryzen 5 1500X", 8000],
  ["Ryzen 5 1400", 7000],
  ["Ryzen 3 1300X", 6500],
  ["Ryzen 3 1200", 5500],
  // AMD FX
  ["FX-8370", 5000],
  ["FX-8350", 4800],
  ["FX-8300", 4500],
  ["FX-6300", 3500],
  ["FX-4300", 2500],
  // Laptop CPUs (common)
  ["Ryzen 9 6900HX", 38000],
  ["Ryzen 7 6800H", 32000],
  ["Ryzen 5 6600H", 24000],
  ["Ryzen 9 5900HX", 34000],
  ["Ryzen 7 5800H", 28000],
  ["Ryzen 5 5600H", 20000],
  ["i9-13900H", 36000],
  ["i7-13700H", 30000],
  ["i5-13500H", 22000],
  ["i9-12900H", 32000],
  ["i7-12700H", 27000],
  ["i5-12500H", 19000],
];

// ---------------------------------------------------------------------------
// Name normalization and fuzzy matching
// ---------------------------------------------------------------------------

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(
      /\b(nvidia|geforce|amd|ati|radeon|intel|mobile|laptop|max-q|notebook|oem|gddr\d|gb|oc|gaming|strix|msi|asus|gigabyte|evga|zotac|sapphire|powercolor|xfx|palit|inno3d|pny|founders edition|fe|ti\b(?=\s)|super\b(?=\s))/gi,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

function scoreFromDB<T extends [string, number]>(
  db: T[],
  rawName: string
): number {
  if (!rawName) return 0;
  const norm = normalize(rawName);

  // 1. Try exact match on normalized name
  for (const [key, score] of db) {
    if (normalize(key) === norm) return score;
  }

  // 2. Try: db entry name is a substring of the normalized input
  // (longer entries win — db is ordered specific→general)
  let best = 0;
  let bestLen = 0;
  for (const [key, score] of db) {
    const normKey = normalize(key);
    if (norm.includes(normKey) && normKey.length > bestLen) {
      best = score;
      bestLen = normKey.length;
    }
  }
  if (best) return best;

  // 3. Try: normalized input is a substring of db entry name
  for (const [key, score] of db) {
    const normKey = normalize(key);
    if (normKey.includes(norm) && norm.length > bestLen) {
      best = score;
      bestLen = norm.length;
    }
  }
  if (best) return best;

  // 4. Token overlap — at least 2 meaningful tokens must match
  const inputTokens = norm.split(" ").filter((t) => t.length > 1);
  let bestOverlap = 0;
  let bestOverlapScore = 0;
  for (const [key, score] of db) {
    const keyTokens = normalize(key)
      .split(" ")
      .filter((t) => t.length > 1);
    const overlap = keyTokens.filter((t) => inputTokens.includes(t)).length;
    if (overlap >= 2 && overlap > bestOverlap) {
      bestOverlap = overlap;
      bestOverlapScore = score;
    }
  }
  return bestOverlapScore;
}

// Some requirement strings list alternatives: "GTX 1060 or RX 580"
// We extract all candidates and return the best (highest req = strictest).
function extractAlternatives(text: string): string[] {
  return text
    .split(/\bor\b|\//i)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);
}

function bestScoreFromText(db: [string, number][], text: string): number {
  const parts = extractAlternatives(text);
  // For requirements we want the LOWEST alternative (any of them meets the req)
  const scores = parts.map((p) => scoreFromDB(db, p)).filter((s) => s > 0);
  return scores.length ? Math.min(...scores) : 0;
}

// ---------------------------------------------------------------------------
// Parse HTML requirements into structured data
// ---------------------------------------------------------------------------

interface ParsedReqs {
  ramMB: number | null;
  cpuScore: number | null;
  gpuScore: number | null;
  rawCpu: string;
  rawGpu: string;
  rawRam: string;
}

function parseReqHtml(html: string | undefined): ParsedReqs {
  const empty: ParsedReqs = {
    ramMB: null,
    cpuScore: null,
    gpuScore: null,
    rawCpu: "",
    rawGpu: "",
    rawRam: "",
  };
  if (!html) return empty;

  // Strip tags, decode entities
  const text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ");

  const lines = text.split("\n").map((l) => l.trim());

  let ramMB: number | null = null;
  let rawCpu = "";
  let rawGpu = "";
  let rawRam = "";
  let cpuScore: number | null = null;
  let gpuScore: number | null = null;

  for (const line of lines) {
    const lower = line.toLowerCase();

    if (!rawRam && (lower.includes("memory") || lower.includes("ram"))) {
      rawRam = line;
      const gbMatch = line.match(/(\d+(?:\.\d+)?)\s*GB/i);
      const mbMatch = line.match(/(\d+)\s*MB/i);
      if (gbMatch) ramMB = Math.round(parseFloat(gbMatch[1]) * 1024);
      else if (mbMatch) ramMB = parseInt(mbMatch[1]);
    }

    if (!rawCpu && (lower.includes("processor") || lower.includes("cpu"))) {
      // Extract the value after the colon
      const val = line.replace(/^.*?(?:processor|cpu)\s*:?\s*/i, "").trim();
      if (val.length > 3) {
        rawCpu = val;
        const s = bestScoreFromText(CPU_DB, val);
        if (s) cpuScore = s;
      }
    }

    if (
      !rawGpu &&
      (lower.includes("graphics") ||
        lower.includes("video card") ||
        lower.includes("gpu"))
    ) {
      const val = line
        .replace(/^.*?(?:graphics|video card|gpu)\s*:?\s*/i, "")
        .trim();
      if (val.length > 3) {
        rawGpu = val;
        const s = bestScoreFromText(GPU_DB, val);
        if (s) gpuScore = s;
      }
    }
  }

  return { ramMB, cpuScore, gpuScore, rawCpu, rawGpu, rawRam };
}

// ---------------------------------------------------------------------------
// Main rating function
// ---------------------------------------------------------------------------

export interface RatingResult {
  rating: HardwareRating;
  headline: string;
  detail: string;
  userGpuScore: number;
  reqMinGpuScore: number;
  reqRecGpuScore: number;
}

export function computeHardwareRating(
  hardware: HardwareInfo,
  minimumHtml: string | undefined,
  recommendedHtml: string | undefined
): RatingResult {
  const unknown: RatingResult = {
    rating: "unknown",
    headline: "",
    detail: "",
    userGpuScore: 0,
    reqMinGpuScore: 0,
    reqRecGpuScore: 0,
  };

  const minReqs = parseReqHtml(minimumHtml);
  const recReqs = parseReqHtml(recommendedHtml);

  // Need at least one data point
  if (!minReqs.ramMB && !minReqs.cpuScore && !minReqs.gpuScore) return unknown;

  const userCpu = scoreFromDB(CPU_DB, hardware.cpu);
  const userGpu = scoreFromDB(GPU_DB, hardware.gpu);
  const userRam = hardware.ramMB;

  // Build a composite score for each tier (GPU-weighted since it's most important for gaming)
  // Weights: GPU 60%, CPU 25%, RAM 15%
  const ratio = (user: number, req: number | null, fallback = 1): number => {
    if (!req || !user) return fallback;
    return user / req;
  };

  const minGpuRatio = ratio(userGpu, minReqs.gpuScore);
  const minCpuRatio = ratio(userCpu, minReqs.cpuScore);
  const minRamRatio = ratio(userRam, minReqs.ramMB);

  const recGpuRatio = ratio(userGpu, recReqs.gpuScore ?? minReqs.gpuScore);
  const recCpuRatio = ratio(userCpu, recReqs.cpuScore ?? minReqs.cpuScore);
  const recRamRatio = ratio(userRam, recReqs.ramMB ?? minReqs.ramMB);

  // Composite ratios (weakest link matters most — use min across components)
  const minComposite = Math.min(minGpuRatio, minCpuRatio, minRamRatio);
  const recComposite = Math.min(recGpuRatio, recCpuRatio, recRamRatio);

  // Identify the primary bottleneck for the detail message
  const bottleneck = (() => {
    const ratios = [
      { name: "GPU", ratio: recGpuRatio },
      { name: "CPU", ratio: recCpuRatio },
      { name: "RAM", ratio: recRamRatio },
    ];
    return ratios.sort((a, b) => a.ratio - b.ratio)[0];
  })();

  // Compute the multiplier over recommended for ultra detection
  const overRecMultiplier = recComposite;

  let rating: HardwareRating;
  let headline: string;
  let detail: string;

  if (overRecMultiplier >= 1.5) {
    rating = "ultra";
    headline = "Your PC will run this flawlessly";
    detail = `Your hardware significantly exceeds recommended specs — expect max settings at high resolutions (1440p/4K) with high framerates. ${bottleneck.name} headroom is excellent.`;
  } else if (overRecMultiplier >= 1.0) {
    rating = "high";
    headline = "Your PC will run this very well";
    detail = `Your hardware meets or exceeds recommended specs. Expect smooth gameplay at high/ultra settings at 1080p, likely 60+ fps. ${bottleneck.name} is closest to the limit.`;
  } else if (minComposite >= 1.0) {
    rating = "medium";
    const gap = Math.round((1 - recComposite) * 100);
    headline = "Your PC should run this";
    detail = `Your hardware meets minimum requirements but is ~${gap}% below recommended. ${bottleneck.name} is the main bottleneck.`;
  } else if (minComposite >= 0.7) {
    rating = "low";
    const gap = Math.round((1 - minComposite) * 100);
    headline = "Your PC may not run this well";
    detail = `Your hardware is ~${gap}% below minimum specs. ${bottleneck.name} is holding you back most — consider upgrading it.`;
  } else {
    rating = "struggle";
    headline = "Your PC will not run this";
    detail = `Your hardware is significantly below minimum requirements. The game likely won't run playably. Consider upgrading your ${bottleneck.name.toLowerCase()} first.`;
  }

  return {
    rating,
    headline,
    detail,
    userGpuScore: userGpu,
    reqMinGpuScore: minReqs.gpuScore ?? 0,
    reqRecGpuScore: recReqs.gpuScore ?? minReqs.gpuScore ?? 0,
  };
}
