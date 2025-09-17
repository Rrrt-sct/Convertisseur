// AUTO-GENERATED — do not edit manually
export type ImageEntry = { detail?: any; thumb?: any };
export const IMAGE_MAP: Record<string, ImageEntry> = {
  'ail': { detail: require('../assets/illustrations_opt/ail.webp'), thumb: require('../assets/illustrations_opt/ail_t.webp') },
  'aubergine': { detail: require('../assets/illustrations_opt/aubergine.webp'), thumb: require('../assets/illustrations_opt/aubergine_t.webp') },
  'avocat': { detail: require('../assets/illustrations_opt/avocat.webp'), thumb: require('../assets/illustrations_opt/avocat_t.webp') },
  'cafe': { detail: require('../assets/illustrations_opt/cafe.webp'), thumb: require('../assets/illustrations_opt/cafe_t.webp') },
  'carotte': { detail: require('../assets/illustrations_opt/carotte.webp'), thumb: require('../assets/illustrations_opt/carotte_t.webp') },
  'celeri': { detail: require('../assets/illustrations_opt/celeri.webp'), thumb: require('../assets/illustrations_opt/celeri_t.webp') },
  'citron': { detail: require('../assets/illustrations_opt/citron.webp'), thumb: require('../assets/illustrations_opt/citron_t.webp') },
  'courgette': { detail: require('../assets/illustrations_opt/courgette.webp'), thumb: require('../assets/illustrations_opt/courgette_t.webp') },
  'cumin_moulu': { detail: require('../assets/illustrations_opt/cumin_moulu.webp'), thumb: require('../assets/illustrations_opt/cumin_moulu_t.webp') },
  'eau': { detail: require('../assets/illustrations_opt/eau.webp'), thumb: require('../assets/illustrations_opt/eau_t.webp') },
  'echalote': { detail: require('../assets/illustrations_opt/echalote.webp'), thumb: require('../assets/illustrations_opt/echalote_t.webp') },
  'farine': { detail: require('../assets/illustrations_opt/farine.webp'), thumb: require('../assets/illustrations_opt/farine_t.webp') },
  'gingembre_moulu': { detail: require('../assets/illustrations_opt/gingembre_moulu.webp'), thumb: require('../assets/illustrations_opt/gingembre_moulu_t.webp') },
  'gingembre_racine': { detail: require('../assets/illustrations_opt/gingembre_racine.webp'), thumb: require('../assets/illustrations_opt/gingembre_racine_t.webp') },
  'grenade': { detail: require('../assets/illustrations_opt/grenade.webp'), thumb: require('../assets/illustrations_opt/grenade_t.webp') },
  'gros_sel': { detail: require('../assets/illustrations_opt/gros_sel.webp'), thumb: require('../assets/illustrations_opt/gros_sel_t.webp') },
  'huile': { detail: require('../assets/illustrations_opt/huile.webp'), thumb: require('../assets/illustrations_opt/huile_t.webp') },
  'noisette': { detail: require('../assets/illustrations_opt/noisette.webp'), thumb: require('../assets/illustrations_opt/noisette_t.webp') },
  'oeuf': { detail: require('../assets/illustrations_opt/oeuf.webp'), thumb: require('../assets/illustrations_opt/oeuf_t.webp') },
  'oignon': { detail: require('../assets/illustrations_opt/oignon.webp'), thumb: require('../assets/illustrations_opt/oignon_t.webp') },
  'paprika': { detail: require('../assets/illustrations_opt/paprika.webp'), thumb: require('../assets/illustrations_opt/paprika_t.webp') },
  'pates': { detail: require('../assets/illustrations_opt/pates.webp'), thumb: require('../assets/illustrations_opt/pates_t.webp') },
  'poivron': { detail: require('../assets/illustrations_opt/poivron.webp'), thumb: require('../assets/illustrations_opt/poivron_t.webp') },
  'pomme_de_terre': { detail: require('../assets/illustrations_opt/pomme_de_terre.webp'), thumb: require('../assets/illustrations_opt/pomme_de_terre_t.webp') },
  'riz': { detail: require('../assets/illustrations_opt/riz.webp'), thumb: require('../assets/illustrations_opt/riz_t.webp') },
  'sel': { detail: require('../assets/illustrations_opt/sel.webp'), thumb: require('../assets/illustrations_opt/sel_t.webp') },
  'sucre': { detail: require('../assets/illustrations_opt/sucre.webp'), thumb: require('../assets/illustrations_opt/sucre_t.webp') },
  'the': { detail: require('../assets/illustrations_opt/the.webp'), thumb: require('../assets/illustrations_opt/the_t.webp') },
  'tomate': { detail: require('../assets/illustrations_opt/tomate.webp'), thumb: require('../assets/illustrations_opt/tomate_t.webp') },
};

export const getImage = (id: string) => IMAGE_MAP[id]?.detail;
export const getThumb = (id: string) => IMAGE_MAP[id]?.thumb || IMAGE_MAP[id]?.detail;
