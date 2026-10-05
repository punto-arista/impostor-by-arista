// Genera los PNG del logo y los íconos de la PWA a partir del PNG original (brand/arista-logo-original.png):
//
//   public/brand/arista-logo.png   logo recortado, fondo transparente (se usa dentro de la app)
//   public/icons/favicon-32.png    favicon (transparente)
//   public/icons/192.png, 512.png  íconos "any" de la PWA
//   public/icons/maskable-512.png  ícono "maskable" (el SO lo recorta: el logo va en la zona segura)
//   public/icons/apple-180.png     ícono de iOS (pantalla de inicio)
//
// Uso: npm run icons   (requiere sharp, devDependency)
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const SRC = 'brand/arista-logo-original.png';

// Fondo claro de los íconos de la PWA: iOS/Android pintan de negro cualquier transparencia.
const BG = '#F2F1EC';

mkdirSync('public/brand', { recursive: true });
mkdirSync('public/icons', { recursive: true });

// Recorta el margen transparente del original (conserva la sombra suave del borde).
const trimmed = await sharp(SRC).trim({ threshold: 1 }).png().toBuffer();
const { width: tw, height: th } = await sharp(trimmed).metadata();
const aspect = th / tw;

await sharp(trimmed).resize({ width: 512, kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toFile('public/brand/arista-logo.png');

/** Logo reducido a `width` px de ancho, con transparencia. */
const logo = (width) => sharp(trimmed).resize({ width, kernel: 'lanczos3' }).png().toBuffer();

// Favicon: cuadrado transparente con el logo centrado.
{
  const size = 48;
  const input = await logo(size);
  await sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input, gravity: 'centre' }])
    .png({ compressionLevel: 9 })
    .toFile('public/icons/favicon-48.png');
}

/** Cuadrado `size` con fondo sólido y el logo centrado ocupando `scale` del ancho. */
async function tile(file, size, scale) {
  const input = await logo(Math.round(size * scale));
  await sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input, gravity: 'centre' }])
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toFile(file);
}

// Maskable: el SO puede recortar hasta un círculo de ~80 % del lado; la diagonal del logo debe caber.
const diag = (s) => 0.5 * Math.sqrt(s ** 2 + (s * aspect) ** 2);
if (diag(0.58) >= 0.4) throw new Error('el logo maskable se saldría de la zona segura');

await tile('public/icons/192.png', 192, 0.7);
await tile('public/icons/512.png', 512, 0.7);
await tile('public/icons/maskable-512.png', 512, 0.58);
await tile('public/icons/apple-180.png', 180, 0.66);

console.log('✓ logo e íconos generados en public/brand y public/icons');
