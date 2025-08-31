// scripts/optimize-images.js
const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const SRC_DIRS = [
  path.resolve('./assets/img'),
  path.resolve('./assets/illustrations'),
].filter(fs.existsSync)

const OUT_DIR = path.resolve('./assets/illustrations_opt')
fs.mkdirSync(OUT_DIR, { recursive: true })

const VALID_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp'])

async function processOne(srcPath, baseOutNoExt) {
  const outDetail = path.join(OUT_DIR, baseOutNoExt + '.webp')     // 512px
  const outThumb  = path.join(OUT_DIR, baseOutNoExt + '_t.webp')   // 96px

  // DETAIL
  const bufDetail = await sharp(srcPath)
    .resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer()
  fs.writeFileSync(outDetail, bufDetail)
  console.log('✅ detail', path.relative(process.cwd(), outDetail))

  // THUMB
  const bufThumb = await sharp(srcPath)
    .resize({ width: 96, height: 96, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer()
  fs.writeFileSync(outThumb, bufThumb)
  console.log('✅ thumb ', path.relative(process.cwd(), outThumb))
}

async function run() {
  if (SRC_DIRS.length === 0) {
    console.error('❌ Aucun dossier source (assets/img ou assets/illustrations).')
    process.exit(1)
  }
  let count = 0
  for (const dir of SRC_DIRS) {
    for (const f of fs.readdirSync(dir)) {
      const ext = path.extname(f).toLowerCase()
      if (!VALID_EXT.has(ext)) continue
      const base = path.basename(f, ext)
      await processOne(path.join(dir, f), base)
      count++
    }
  }
  console.log(`\n✅ Terminé : ${count} fichier(s) optimisés → ${OUT_DIR}`)
}

run().catch(e => {
  console.error('❌ Erreur:', e)
  process.exit(1)
})
