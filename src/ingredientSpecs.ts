// src/ingredientSpecs.ts

/** Clés qu'on autorise à éditer au départ (génériques) */
export const SPEC_GENERIC = [
  { key: 'avg_unit_g',   label: 'Poids moyen (1 pièce, g)',    step: 1 },
  { key: 'peeled_yield', label: 'Taux d’épluchage (×)',        step: 0.01 },
] as const

/** Pour “cuillères” */
export const SPEC_SPOONS = [
  { key: 'tsp_g',  label: '1 c. à café (g)', step: 0.1 },
  { key: 'tbsp_g', label: '1 c. à soupe (g)', step: 0.1 },
] as const

/** Pour “taille ⇆ poids” */
export const SPEC_LENGTH = [
  { key: 'lgth_g', label: 'g par cm de longueur', step: 0.1 },
] as const

/** Pour “jus” (si tu as ces colonnes) */
export const SPEC_JUICE = [
  { key: 'juice_ml_per_g',    label: 'ml de jus / g',  step: 0.01 },
  { key: 'juice_ml_per_unit', label: 'ml de jus / pièce', step: 1 },
] as const
