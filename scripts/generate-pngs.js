const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPng(width, height, getPixel) {
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(height * rowSize);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getPixel(x, y, width, height);
      const pxOffset = rowOffset + 1 + x * 4;
      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(rawData);

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth: 8
  ihdr[9] = 6; // Color type: 6 (RGBA)
  ihdr[10] = 0; // Compression: 0
  ihdr[11] = 0; // Filter: 0
  ihdr[12] = 0; // Interlace: 0

  function makeChunk(type, data) {
    const len = data.length;
    const buf = Buffer.alloc(8 + len + 4);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4, 4, 'ascii');
    data.copy(buf, 8);
    // CRC calculation
    const crc = crc32(buf.subarray(4, 8 + len));
    buf.writeUInt32BE(crc, 8 + len);
    return buf;
  }

  // Standard CRC32 table
  function crc32(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc ^= buf[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Brand Gradient: #4f35ff (79, 53, 255) to #ff5f9e (255, 95, 158)
function brandPixel(x, y, w, h, isMaskable = false) {
  const t = (x + y) / (w + h);
  const r = Math.round(79 * (1 - t) + 255 * t);
  const g = Math.round(53 * (1 - t) + 95 * t);
  const b = Math.round(255 * (1 - t) + 158 * t);

  // Corner radius for non-maskable icons
  if (!isMaskable) {
    const radius = w * 0.22;
    const dx = Math.min(x, w - 1 - x);
    const dy = Math.min(y, h - 1 - y);
    if (dx < radius && dy < radius) {
      const dist = Math.hypot(radius - dx, radius - dy);
      if (dist > radius) {
        return [0, 0, 0, 0]; // Transparent outside corner
      }
    }
  }

  // Draw simple white central glyph circle
  const cx = w / 2;
  const cy = h / 2;
  const distCenter = Math.hypot(x - cx, y - cy);
  if (distCenter >= w * 0.26 && distCenter <= w * 0.3) {
    return [255, 255, 255, 240];
  }

  return [r, g, b, 255];
}

const iconsDir = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), createPng(192, 192, (x, y, w, h) => brandPixel(x, y, w, h, false)));
fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), createPng(512, 512, (x, y, w, h) => brandPixel(x, y, w, h, false)));
fs.writeFileSync(path.join(iconsDir, 'icon-maskable-192.png'), createPng(192, 192, (x, y, w, h) => brandPixel(x, y, w, h, true)));
fs.writeFileSync(path.join(iconsDir, 'icon-maskable-512.png'), createPng(512, 512, (x, y, w, h) => brandPixel(x, y, w, h, true)));
fs.writeFileSync(path.join(iconsDir, 'apple-touch-icon.png'), createPng(180, 180, (x, y, w, h) => brandPixel(x, y, w, h, false)));

console.log('Successfully generated PNG icons in public/icons/');

