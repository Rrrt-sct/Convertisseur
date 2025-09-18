// scripts/resize-hero.js
const sharp = require("sharp");
const path = require("path");

const SRC = path.join(__dirname, "..", "assets", "hero-splash.webp");
const OUT = path.join(__dirname, "..", "assets", "hero-splash.jpg");

async function run() {
  try {
    console.log("📦 Optimisation de l’image d’accueil…");

    await sharp(SRC)
      .resize({ width: 640 })      // largeur max
      .jpeg({ quality: 82 })       // conversion JPEG qualité 82
      .toFile(OUT);

    console.log("✅ Image optimisée créée :", OUT);
  } catch (err) {
    console.error("❌ Erreur:", err);
    process.exit(1);
  }
}

run();
