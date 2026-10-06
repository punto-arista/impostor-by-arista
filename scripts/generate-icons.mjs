// Genera los PNG del logo y los íconos de la PWA a partir del PNG original (brand/impostor-logo-original.png):
//
//   public/brand/impostor-logo.png  logo cuadrado con esquinas redondeadas (se usa dentro de la app)
//   public/icons/favicon-48.png     favicon (esquinas transparentes)
//   public/icons/192.png, 512.png   íconos "any" de la PWA
//   public/icons/maskable-512.png   ícono "maskable" (el SO lo recorta: el logo va en la zona segura)
//   public/icons/apple-180.png      ícono de iOS (pantalla de inicio, sin transparencia)
//
// Uso: npm run icons   (requiere sharp, devDependency)
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const SRC = 'brand/impostor-logo-original.png';

// Color de fondo del logo: se usa para rellenar donde el SO no admite transparencia o recorta el ícono.
const BG = '#0C0F0B';

mkdirSync('public/brand', { recursive: true });
mkdirSync('public/icons', { recursive: true });

/** Logo (con esquinas redondeadas transparentes) reducido a `size` px. */
const logo = (size) => sharp(SRC).resize(size, size, { kernel: 'lanczos3' }).png().toBuffer();

/** Cuadrado `size` con fondo sólido y el logo centrado ocupando `scale` del lado. */
async function tile(file, size, scale) {
  const input = await logo(Math.round(size * scale));
  await sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input, gravity: 'centre' }])
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toFile(file);
}

await sharp(SRC).resize(512, 512, { kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toFile('public/brand/impostor-logo.png');
await sharp(SRC).resize(48, 48, { kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toFile('public/icons/favicon-48.png');
await sharp(SRC).resize(192, 192, { kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toFile('public/icons/192.png');
await sharp(SRC).resize(512, 512, { kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toFile('public/icons/512.png');

// Maskable: el SO puede recortar hasta un círculo de ~80 % del lado; el logo (cuadrado) debe caber en él.
await tile('public/icons/maskable-512.png', 512, 0.56);
// iOS aplica su propia máscara y pinta de negro la transparencia: logo a sangre sobre el fondo.
await sharp(SRC).resize(180, 180, { kernel: 'lanczos3' }).flatten({ background: BG }).png({ compressionLevel: 9 }).toFile('public/icons/apple-180.png');

console.log('✓ logo e íconos generados en public/brand y public/icons');
