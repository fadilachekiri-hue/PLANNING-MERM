// Génère des icônes PNG simples (fond bleu + lettres "PM") sans dépendance
// externe, juste pour que la PWA soit installable dès le départ. Remplaçable
// plus tard par un vrai logo.
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = [];
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function makePng(size, bg, letterColor) {
  const raw = Buffer.alloc(size * (1 + size * 3));
  // Lettres "PM" dessinées grossièrement au centre via un pavé de pixels simple.
  const barW = Math.round(size * 0.10);
  const cx = size / 2;
  const cy = size / 2;
  for (let y = 0; y < size; y++) {
    const rowStart = y * (1 + size * 3);
    raw[rowStart] = 0; // filter type
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      let isLetter = false;
      // Deux barres verticales simulant "P" et "M" au centre, simple et lisible.
      if (Math.abs(dx + size * 0.12) < barW / 2 && Math.abs(dy) < size * 0.22) isLetter = true;
      if (Math.abs(dx - size * 0.12) < barW / 2 && Math.abs(dy) < size * 0.22) isLetter = true;
      if (Math.abs(dx) < size * 0.22 && Math.abs(dy - (dx > 0 ? -dx : dx)) < barW * 0.6 && Math.abs(dy) < size * 0.22) isLetter = true;

      const color = isLetter ? letterColor : bg;
      const off = rowStart + 1 + x * 3;
      raw[off] = color[0];
      raw[off + 1] = color[1];
      raw[off + 2] = color[2];
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idat = zlib.deflateSync(raw);
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  return Buffer.concat([signature, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

const outDir = path.join(__dirname, "..", "public", "icons");
fs.mkdirSync(outDir, { recursive: true });

const brandBlue = [29, 78, 216];
const white = [255, 255, 255];

for (const size of [192, 512]) {
  const png = makePng(size, brandBlue, white);
  fs.writeFileSync(path.join(outDir, `icon-${size}.png`), png);
}

console.log("Icônes générées dans public/icons/");
