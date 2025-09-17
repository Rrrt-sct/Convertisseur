// scripts/generateImageMap.js
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.resolve('./assets/illustrations_opt');
const DEST = path.resolve('./src/imageMap.ts');

function run() {
  if (!fs.existsSync(OUT_DIR)) {
    console.error('ERROR: missing folder ' + OUT_DIR);
    process.exit(1);
  }

  const files = fs.readdirSync(OUT_DIR).filter(function (f) {
    return /\.webp$/i.test(f);
  });

  // Construire une map { id: { detailPath?: string, thumbPath?: string } }
  const map = {};
  files.forEach(function (f) {
    const base = path.basename(f, '.webp');
    const isThumb = /_t$/i.test(base);
    const key = isThumb ? base.slice(0, -2) : base; // enlève le suffixe "_t"
    const rel = '../assets/illustrations_opt/' + f; // chemin relatif depuis src/

    if (!map[key]) map[key] = {};
    if (isThumb) map[key].thumbPath = rel;
    else map[key].detailPath = rel;
  });

  // Écriture du fichier TypeScript
  const lines = [];
  lines.push('// AUTO-GENERATED — do not edit manually');
  lines.push('export type ImageEntry = { detail?: any; thumb?: any };');
  lines.push('export const IMAGE_MAP: Record<string, ImageEntry> = {');

  Object.keys(map).sort().forEach(function (id) {
    const entry = map[id];
    const parts = [];
    if (entry.detailPath) parts.push("detail: require('" + entry.detailPath + "')");
    if (entry.thumbPath) parts.push("thumb: require('" + entry.thumbPath + "')");
    lines.push("  '" + id + "': { " + parts.join(', ') + " },");
  });

  lines.push('};');
  lines.push('');
  lines.push('export const getImage = (id: string) => IMAGE_MAP[id]?.detail;');
  lines.push('export const getThumb = (id: string) => IMAGE_MAP[id]?.thumb || IMAGE_MAP[id]?.detail;');
  lines.push('');

  fs.mkdirSync(path.dirname(DEST), { recursive: true });
  fs.writeFileSync(DEST, lines.join('\n'), 'utf8');

  console.log('OK: imageMap.ts generated with ' + files.length + ' files -> ' + DEST);
}

run();
