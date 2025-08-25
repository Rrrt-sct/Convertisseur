const fs = require('fs')
const path = require('path')

// Entrées / sorties
const CSV_IN   = path.resolve('./ingredients.csv')
const JSON_OUT = path.resolve('./data/ingredients.json')
const IMG_DIR  = path.resolve('./assets/img')
const MAP_OUT  = path.resolve('./src/imageMap.ts')

// ----- Lecture CSV -----
let csv = fs.readFileSync(CSV_IN, 'utf8').replace(/^\uFEFF/, '')
const lines = csv.split(/\r?\n/).filter(Boolean)
if (lines.length < 2) {
  console.error('❌ CSV vide ou sans données.')
  process.exit(1)
}

// Détection séparateur basée sur la 1re ligne
const firstLine = lines[0]
const countComma = (firstLine.match(/,/g) || []).length
const countSemi  = (firstLine.match(/;/g) || []).length
const delim = countSemi > countComma ? ';' : ','

// Normalisation header
const normalizeHeader = (s) => s
  .trim()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, '_')
  .replace(/[^\w]/g, '_')
  .toLowerCase()

const headers = firstLine.split(delim).map(h => normalizeHeader(h))

// Colonnes numériques
const numericKeys = new Set([
  'avg_unit_g','peeled_yield','juice_ml_per_unit','lgth_g','tbsp_g','tsp_g','density_g_ml'
])

function parseCsvLine(line, sep) {
  const res = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++ } else { inQuotes = !inQuotes }
    } else if (ch === sep && !inQuotes) {
      res.push(cur); cur = ''
    } else {
      cur += ch
    }
  }
  res.push(cur)
  return res
}
const rows = lines.slice(1).map(l => parseCsvLine(l, delim))

function coerce(key, val) {
  const v = (val ?? '').toString().trim()
  if (v === '' || v.toLowerCase() === 'null') return null
  if (numericKeys.has(key)) {
    const n = Number(v.replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }
  return v
}

// ----- Construction des objets -----
const data = rows.map(cols => {
  const obj = {}
  headers.forEach((h, i) => { obj[h] = coerce(h, cols[i]) })
  obj.id = (obj.id || obj.label || '').toString().trim()
  obj.label = (obj.label || obj.id || '').toString().trim()
  return obj
}).filter(r => r.id && r.label)

// ----- Écriture JSON -----
fs.mkdirSync(path.dirname(JSON_OUT), { recursive: true })
fs.writeFileSync(JSON_OUT, JSON.stringify(data, null, 2), 'utf8')
console.log(`✅ JSON OK → ${JSON_OUT}`)
console.log(`   ${data.length} ligne(s), séparateur détecté: '${delim}'`)

// ----- Génération app/imageMap.ts -----
const exts = ['.png', '.webp']
function findImageFile(baseName) {
  if (/\.(png|webp)$/i.test(baseName)) {
    const p = path.join(IMG_DIR, baseName)
    return fs.existsSync(p) ? baseName : null
  }
  for (const ext of exts) {
    const name = baseName + ext
    const p = path.join(IMG_DIR, name)
    if (fs.existsSync(p)) return name
  }
  return null
}

let imports = []
let entries = []

data.forEach(row => {
  const id = String(row.id)
  const preferred = row.image ? String(row.image).trim() : `${id}`
  const file = findImageFile(preferred)
  if (file) {
    const varName = 'img_' + id.replace(/[^a-zA-Z0-9_]/g, '_')
    const relPath = `../assets/img/${file}` // depuis app/imageMap.ts
    imports.push(`const ${varName} = require('${relPath}');`)
    entries.push(`  '${id}': ${varName},`)
  }
})

const mapTs = `// ⚠️ Fichier généré automatiquement. Ne pas éditer.
// Généré par convert-csv-to-json.js
${imports.join('\n')}

export const IMAGES: Record<string, any> = {
${entries.join('\n')}
};
`

fs.mkdirSync(path.dirname(MAP_OUT), { recursive: true })
fs.writeFileSync(MAP_OUT, mapTs, 'utf8')
console.log(`✅ Map d’images OK → ${MAP_OUT}`)
console.log(`   ${entries.length} image(s) liées trouvées dans ${IMG_DIR}`)
