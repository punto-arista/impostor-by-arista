// Genera los íconos PNG de la PWA sin dependencias: el punto verde de la marca
// ("impostor.") sobre el fondo oscuro. Reemplaza public/icons/* con tu diseño
// cuando lo tengas; este script solo es un punto de partida.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const BG = [0x11, 0x15, 0x12];
const FG = [0x74, 0xd4, 0x67];

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

function png(size, dotRatio) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  const r = size * dotRatio, c = size / 2;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      // 4x4 supersampling para bordes suaves
      let hit = 0;
      for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) {
        const dx = x + (sx + 0.5) / 4 - c, dy = y + (sy + 0.5) / 4 - c;
        if (dx * dx + dy * dy <= r * r) hit++;
      }
      const t = hit / 16, o = y * (size * 3 + 1) + 1 + x * 3;
      for (let i = 0; i < 3; i++) raw[o + i] = Math.round(BG[i] + (FG[i] - BG[i]) * t);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('public/icons', { recursive: true });
const out = [
  ['192.png', 192, 0.2],
  ['512.png', 512, 0.2],
  ['maskable-512.png', 512, 0.14], // zona segura: el SO recorta hasta ~20% por lado
  ['apple-180.png', 180, 0.2],
];
for (const [name, size, ratio] of out) writeFileSync(`public/icons/${name}`, png(size, ratio));

writeFileSync('public/icons/favicon.svg',
`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#111512"/><circle cx="32" cy="32" r="12.8" fill="#74D467"/></svg>
`);
console.log('íconos generados en public/icons');
