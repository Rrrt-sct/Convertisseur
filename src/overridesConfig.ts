// src/overridesConfig.ts

/** Active ou désactive tout le système de valeurs personnalisées */
export const ENABLE_OVERRIDES = true

/** Liste des paramètres modifiables dans l’éditeur ⚙️ */
export const SPEC_GENERIC = [
  {
    key: 'avg_unit_g',
    label: 'Poids moyen (1 pièce)',
    type: 'number',
    hint: 'g',
  },
  {
    key: 'peeled_yield',
    label: 'Taux d’épluchage',
    type: 'number',
    hint: 'ex: 0.85',
  },
] as const
