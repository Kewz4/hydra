const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

// CRC32 table
const crc32table = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (const byte of buf) crc = crc32table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBytes, data]);
  const crcVal = Buffer.alloc(4);
  crcVal.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([len, typeBytes, data, crcVal]);
}

function createPNG(width, height, getPixel) {
  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // no interlace

  // Raw image data (filter byte + RGBA per row)
  const rawRows = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 4);
    row[0] = 0; // filter None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getPixel(x, y);
      row[1 + x * 4] = r;
      row[2 + x * 4] = g;
      row[3 + x * 4] = b;
      row[4 + x * 4] = a;
    }
    rawRows.push(row);
  }
  const raw = Buffer.concat(rawRows);
  const compressed = zlib.deflateSync(raw);

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    makeChunk("IHDR", ihdr),
    makeChunk("IDAT", compressed),
    makeChunk("IEND", Buffer.alloc(0)),
  ]);
}

const G_GRID = [
  [0, 1, 1, 1, 1, 0, 0],
  [1, 1, 0, 0, 1, 1, 0],
  [1, 0, 0, 0, 0, 0, 0],
  [1, 0, 0, 0, 0, 0, 0],
  [1, 0, 0, 1, 1, 1, 0],
  [1, 0, 0, 1, 1, 1, 0],
  [1, 0, 0, 0, 1, 1, 0],
  [1, 1, 0, 0, 1, 1, 0],
  [0, 1, 1, 1, 1, 1, 0],
  [0, 0, 0, 0, 0, 0, 0],
];

function makeGPixelFn(
  width,
  height,
  scale,
  bgR,
  bgG,
  bgB,
  bgA,
  fgR,
  fgG,
  fgB,
  fgA
) {
  const gW = 7 * scale;
  const gH = 10 * scale;
  const ox = Math.floor((width - gW) / 2);
  const oy = Math.floor((height - gH) / 2);
  return (x, y) => {
    const gx = x - ox;
    const gy = y - oy;
    if (gx >= 0 && gx < gW && gy >= 0 && gy < gH) {
      const col = Math.floor(gx / scale);
      const row = Math.floor(gy / scale);
      if (G_GRID[row]?.[col]) return [fgR, fgG, fgB, fgA];
    }
    return [bgR, bgG, bgB, bgA];
  };
}

const resourcesDir = path.join(__dirname, "..", "resources");

// icon.png: 256x256, black bg, white G
const iconPixels = makeGPixelFn(
  256,
  256,
  22,
  20,
  20,
  20,
  255,
  255,
  255,
  255,
  255
);
fs.writeFileSync(
  path.join(resourcesDir, "icon.png"),
  createPNG(256, 256, iconPixels)
);
console.log("icon.png created");

// tray-icon.png: 32x32, transparent bg, white G
const trayPixels = makeGPixelFn(32, 32, 3, 0, 0, 0, 0, 255, 255, 255, 255);
fs.writeFileSync(
  path.join(resourcesDir, "tray-icon.png"),
  createPNG(32, 32, trayPixels)
);
console.log("tray-icon.png created");
