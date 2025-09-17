// scripts/optimize-images.js
// Optimise les images en WebP + génère des miniatures uniformes
// - Trim des bords transparents (réglable)
// - Recentrage sur un canvas carré transparent
// - Sortie 512px (detail) et 96px (thumb)
//
// Prérequis : `npm i -D sharp`
// Lance :     `npm run optimize:images`

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Dossiers sources scannés (ajoute/retire si besoin)
const SRC_DIRS = [
  path.resolve('./assets/img'),
  path.resolve('./assets/illustrations'),
].filter(fs.existsSync);

// Dossier de sortie
const OUT_DIR = path.resolve('./assets/illustrations_opt');
fs.mkdirSync(OUT_DIR, { recursive: true });

// Extensions prises en charge
const VALID_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp']);

// Réglages par défaut
const TRIM_THRESHOLD_DEFAULT = 22; // plus haut = trim plus agressif (coupe mieux les halos)

// Overrides par fichier (nom SANS extension), si deux images restent visuellement plus petites
// Exemple : 'pomme_de_terre': { trim: 30 }
const OVERRIDES = {
  // 'pomme_de_terre': { trim: 30 },
  // 'gingembre': { trim: 30 },
};

// ---------- Helpers ----------
function listFiles(dir) {
  return fs
    .readdirSync(dir)
    .filter((f) => VALID_EXT.has(path.extname(f).toLowerCase()))
    .map((f) => ({ dir, name: f, base: path.basename(f, path.extname(f)) }));
}

function log(...args) {
  console.log(...args);
}

function warn(...args) {
  console.warn(...args);
}

function err(...args) {
  console.error(...args);
}

// ----------- Pipeline image -----------
async function normalize(inputAbsPath, baseName) {
  // 1) coupe les bords transparents (API sharp >= 0.34)
  const threshold =
    (OVERRIDES[baseName] && OVERRIDES[baseName].trim) ??
    TRIM_THRESHOLD_DEFAULT;

  const trimmed = sharp(inputAbsPath).trim({ threshold });

  // 2) récupère taille post-trim
  const meta = await trimmed.metadata();
  const width = meta.width || 1;
  const height = meta.height || 1;

  // 3) pad en carré transparent (centre le sujet)
  const side = Math.max(width, height);
  const padX = (side - width) / 2;
  const padY = (side - height) / 2;

  const squareBuf = await trimmed
    .extend({
      top: Math.floor(padY),
      bottom: Math.ceil(padY),
      left: Math.floor(padX),
      right: Math.ceil(padX),
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .toBuffer();

  return sharp(squareBuf);
}

async function processOne(srcPath, baseOutNoExt) {
  const outDetail = path.join(OUT_DIR, baseOutNoExt + '.webp');   // 512px
  const outThumb  = path.join(OUT_DIR, baseOutNoExt + '_t.webp'); // 96px

  const sq = await normalize(srcPath, baseOutNoExt);

  // DETAIL (512x512, contain, fond transparent)
  const bufDetail = await sq
    .resize({
      width: 512,
      height: 512,
      fit: 'contain',
      withoutEnlargement: false,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({ quality: 80 })
    .toBuffer();
  fs.writeFileSync(outDetail, bufDetail);
  log('✅ detail', path.relative(process.cwd(), outDetail));

  // THUMB (96x96)
  const bufThumb = await sq
    .resize({
      width: 96,
      height: 96,
      fit: 'contain',
      withoutEnlargement: false,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({ quality: 80 })
    .toBuffer();
  fs.writeFileSync(outThumb, bufThumb);
  log('✅ thumb ', path.relative(process.cwd(), outThumb));
}

// ----------- Programme principal -----------
async function run() {
  if (SRC_DIRS.length === 0) {
    err('❌ Aucun dossier source (assets/img ou assets/illustrations).');
    process.exit(1);
  }

  const entries = SRC_DIRS.flatMap((dir) => listFiles(dir));
  if (entries.length === 0) {
    warn('ℹ️  Aucun fichier image trouvé dans', SRC_DIRS.join(' ; '));
    return;
  }

  let ok = 0, ko = 0;
  for (const { dir, name, base } of entries) {
    const abs = path.join(dir, name);
    try {
      await processOne(abs, base);
      ok++;
    } catch (e) {
      ko++;
      err('❌ Erreur sur', abs, '\n', e && e.stack ? e.stack : e);
    }
  }

  log('');
  if (ko === 0) {
    log(`✅ Terminé : ${ok} fichier(s) optimisés → ${OUT_DIR}`);
  } else {
    warn(`⚠️  Terminé avec erreurs : ${ok} OK, ${ko} KO → ${OUT_DIR}`);
  }
}

run().catch((e) => {
  err('❌ Erreur fatale:', e && e.stack ? e.stack : e);
  process.exit(1);
});
