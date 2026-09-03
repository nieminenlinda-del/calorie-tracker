import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'icons');

function crc32(buf) {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const payload = Buffer.concat([typeBytes, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(payload));
  return Buffer.concat([len, payload, crc]);
}

function png(size) {
  const pine = [15, 61, 46];
  const cream = [247, 243, 234];
  const gold = [243, 210, 122];
  const rows = [];
  for (let y = 0; y < size; y += 1) {
    const row = Buffer.alloc(1 + size * 3);
    for (let x = 0; x < size; x += 1) {
      const nx = x / (size - 1) - 0.5;
      const ny = y / (size - 1) - 0.5;
      const cx = nx;
      const cy = ny + 0.08;
      const inDot = cx * cx + (cy + 0.12) * (cy + 0.12) < 0.012;
      const bowl = Math.abs(cy - 0.08) < 0.02 && Math.abs(nx) < 0.32 && ny > 0;
      const i = 1 + x * 3;
      const color = inDot ? cream : bowl ? gold : pine;
      row[i] = color[0];
      row[i + 1] = color[1];
      row[i + 2] = color[2];
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const idat = deflateSync(Buffer.concat(rows));
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

await mkdir(outDir, { recursive: true });
for (const size of [192, 512]) {
  const dest = join(outDir, `icon-${size}.png`);
  createWriteStream(dest).end(png(size));
  console.log('wrote', dest);
}
