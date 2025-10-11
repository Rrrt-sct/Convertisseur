// src/overridesConfig.ts
export const ENABLE_OVERRIDES = true;

export type Spec = {
  key: string;
  label: string;
  type: 'number' | 'text';
  hint?: string;
};

const SPEC_MAP: Record<string, Spec> = {
  avg_unit_g:       { key: 'avg_unit_g',       label: 'Poids moyen (1 pièce)', type: 'number', hint: 'g' },
  peeled_yield:     { key: 'peeled_yield',     label: "Taux d'épluchage",      type: 'number', hint: 'ex: 0.85' },
  density_g_ml:     { key: 'density_g_ml',     label: 'Densité',               type: 'number', hint: 'g/ml' },
  tbsp_g:           { key: 'tbsp_g',           label: '1 c. à soupe (g)',      type: 'number', hint: 'g' },
  tsp_g:            { key: 'tsp_g',            label: '1 c. à café (g)',       type: 'number', hint: 'g' },
  juice_ml_per_g:   { key: 'juice_ml_per_g',   label: 'Jus (ml) par g',        type: 'number', hint: 'ml/g' },
  juice_ml_per_unit:{ key: 'juice_ml_per_unit',label: 'Jus (ml) par pièce',    type: 'number', hint: 'ml' },
  lgth_g:           { key: 'lgth_g',           label: 'Poids par cm',          type: 'number', hint: 'g/cm' },

  // Œufs
  egg_s:            { key: 'egg_s',            label: 'Œuf S (g)',             type: 'number', hint: 'g' },
  egg_m:            { key: 'egg_m',            label: 'Œuf M (g)',             type: 'number', hint: 'g' },
  egg_l:            { key: 'egg_l',            label: 'Œuf L (g)',             type: 'number', hint: 'g' },
  whte_pctge:       { key: 'whte_pctge',       label: 'Blanc %',               type: 'number', hint: 'ex: 0.6' },
  ylw_pctge:        { key: 'ylw_pctge',        label: 'Jaune %',               type: 'number', hint: 'ex: 0.4' },

  // Pâtes
  psta_wter:        { key: 'psta_wter',        label: 'Eau pour pâtes (l/100 g)', type: 'number', hint: 'ex: 0.01' },
  psta_slt:         { key: 'psta_slt',         label: 'Sel pour pâtes (g/100 g)', type: 'number', hint: 'ex: 0.1' },

  // Café (utilisés après choix d’usage)
  coffee_mouture:           { key: 'coffee_mouture',           label: 'Mouture',                type: 'text'   },
  coffee_tmp:               { key: 'coffee_tmp',               label: 'Température (°C)',       type: 'number', hint: '°C' },
  coffee_tme:               { key: 'coffee_tme',               label: 'Temps (min)',            type: 'number', hint: 'min' },
  // 👇 laisse de côté coffee_cup_cl si tu ne veux pas l’éditer
  // coffee_cup_ml:            { key: 'coffee_cup_ml',            label: 'Volume tasse (ml)',      type: 'number', hint: 'ml' },
  coffee_g_per_cl_lght:     { key: 'coffee_g_per_cl_lght',     label: 'Dosage doux (g/cl)',     type: 'number', hint: 'g/cl' },
  coffee_g_per_cl_strng:    { key: 'coffee_g_per_cl_strng',    label: 'Dosage corsé (g/cl)',    type: 'number', hint: 'g/cl' },
  coffee_g_per_cl_intense:  { key: 'coffee_g_per_cl_intense',  label: 'Dosage intense (g/cl)',  type: 'number', hint: 'g/cl' },
  coffee_spcfc_tbsp_g:      { key: 'coffee_spcfc_tbsp_g',      label: '1 c. à soupe café (g)',  type: 'number', hint: 'g' },
};

export const SPEC_GENERIC: Spec[] = [
  SPEC_MAP.avg_unit_g,
  SPEC_MAP.peeled_yield,
];

export function getSpecsFromRow(row: Record<string, any> | null | undefined): Spec[] {
  if (!row) return SPEC_GENERIC;
  const out: Spec[] = [];
  for (const key of Object.keys(SPEC_MAP)) {
    const val = (row as any)[key];
    const has = val !== null && val !== undefined && !(typeof val === 'string' && val.trim() === '');
    if (has) out.push(SPEC_MAP[key]);
  }
  return out.length > 0 ? out : SPEC_GENERIC;
}

export default { ENABLE_OVERRIDES, SPEC_GENERIC, getSpecsFromRow };
