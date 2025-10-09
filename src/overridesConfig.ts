// src/overridesConfig.ts
// ======================================================
// ⚙️ Configuration des paramètres modifiables par ingrédient
// ======================================================

export const ENABLE_OVERRIDES = true;

// ------------------------------------------------------
// Typage d’une spécification de paramètre
// ------------------------------------------------------
export type Spec = {
  key: string;
  label: string;
  type: 'number' | 'text';
  hint?: string;
};

// ------------------------------------------------------
// Liste centrale de toutes les specs possibles
// (elles ne s’affichent que si l’ingrédient a une valeur pour cette clé)
// ------------------------------------------------------
const SPEC_MAP: Record<string, Spec> = {
  avg_unit_g: {
    key: 'avg_unit_g',
    label: 'Poids moyen (1 pièce)',
    type: 'number',
    hint: 'g',
  },
  peeled_yield: {
    key: 'peeled_yield',
    label: 'Taux d’épluchage',
    type: 'number',
    hint: 'ex: 0.85',
  },
  density_g_ml: {
    key: 'density_g_ml',
    label: 'Densité',
    type: 'number',
    hint: 'g/ml',
  },
  tbsp_g: {
    key: 'tbsp_g',
    label: '1 c. à soupe (g)',
    type: 'number',
    hint: 'g',
  },
  tsp_g: {
    key: 'tsp_g',
    label: '1 c. à café (g)',
    type: 'number',
    hint: 'g',
  },
  juice_ml_per_g: {
    key: 'juice_ml_per_g',
    label: 'Jus (ml) par g',
    type: 'number',
    hint: 'ml/g',
  },
  juice_ml_per_unit: {
    key: 'juice_ml_per_unit',
    label: 'Jus (ml) par pièce',
    type: 'number',
    hint: 'ml',
  },
  lgth_g: {
    key: 'lgth_g',
    label: 'Poids par cm',
    type: 'number',
    hint: 'g/cm',
  },
  egg_s: {
    key: 'egg_s',
    label: 'Œuf S (g)',
    type: 'number',
    hint: 'g',
  },
  egg_m: {
    key: 'egg_m',
    label: 'Œuf M (g)',
    type: 'number',
    hint: 'g',
  },
  egg_l: {
    key: 'egg_l',
    label: 'Œuf L (g)',
    type: 'number',
    hint: 'g',
  },
  whte_pctge: {
    key: 'whte_pctge',
    label: 'Blanc %',
    type: 'number',
    hint: 'ex: 0.6',
  },
  ylw_pctge: {
    key: 'ylw_pctge',
    label: 'Jaune %',
    type: 'number',
    hint: 'ex: 0.4',
  },
  psta_wter: {
    key: 'psta_wter',
    label: 'Eau pour pâtes (ml/g)',
    type: 'number',
    hint: 'ml / 100 g',
  },
  psta_slt: {
    key: 'psta_slt',
    label: 'Sel pour pâtes (g/L)',
    type: 'number',
    hint: 'g / L',
  },
};

// ------------------------------------------------------
// Spécification générique (fallback par défaut)
// ------------------------------------------------------
export const SPEC_GENERIC: Spec[] = [
  SPEC_MAP.avg_unit_g,
  SPEC_MAP.peeled_yield,
];

// ------------------------------------------------------
// Fonction utilitaire : retourne uniquement les specs utiles
// à l’ingrédient courant (celles dont le CSV a une valeur)
// ------------------------------------------------------
export function getSpecsFromRow(row: Record<string, any> | null | undefined): Spec[] {
  if (!row) return SPEC_GENERIC;

  const out: Spec[] = [];

  for (const key of Object.keys(SPEC_MAP)) {
    const value = (row as any)[key];
    const has =
      value !== null &&
      value !== undefined &&
      !(typeof value === 'string' && value.trim() === '');
    if (has) out.push(SPEC_MAP[key]);
  }

  // Si aucune valeur trouvée dans le CSV → on retourne les deux génériques
  return out.length > 0 ? out : SPEC_GENERIC;
}

// ------------------------------------------------------
// Export par défaut (facultatif)
// ------------------------------------------------------
export default {
  ENABLE_OVERRIDES,
  SPEC_GENERIC,
  getSpecsFromRow,
};
