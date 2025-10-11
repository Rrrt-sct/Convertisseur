// app/results.tsx — IMPORTS

import { router, useLocalSearchParams } from 'expo-router';
import { Calculator } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import ParamEditor from '../src/ParamEditor'; // ✅ export par défaut OK
import { msToMMSS, useTimer } from '../src/timerContext';

import {
  ENABLE_OVERRIDES,
  SPEC_GENERIC,
  getSpecsFromRow
} from '../src/overridesConfig';

import {
  hasOverrides,
  mergeWithOverrides,
  normalizeId,
  useIngredientOverrides,
} from '../src/useIngredientOverrides';






// --- Spécifications des champs éditables par type d'ingrédient ---
// (tu peux enrichir au fur et à mesure)
const SPEC_BY_TYPE: Record<string, Array<{ key: string; label: string; type: 'number' | 'text'; hint?: string }>> = {
  generic: [
    { key: 'avg_unit_g',     label: 'Poids moyen (1 pièce)',      type: 'number', hint: 'g' },
    { key: 'peeled_yield',   label: 'Taux d’épluchage',           type: 'number', hint: 'ex: 0.85' },
    { key: 'density_g_ml',   label: 'Densité (g/ml)',             type: 'number', hint: 'ex: 1' },
  ],

  // Cuillères / densité
  spoons: [
    { key: 'tbsp_g',         label: '1 c. à soupe (g)',           type: 'number' },
    { key: 'tsp_g',          label: '1 c. à café (g)',            type: 'number' },
  ],

  // Jus
  juice: [
    { key: 'juice_ml_per_g',   label: 'Jus par gramme (ml/g)',    type: 'number', hint: 'ex: 0.6' },
    { key: 'juice_ml_per_unit',label: 'Jus par pièce (ml/pièce)', type: 'number' },
  ],

  // Longueur → poids
  length: [
    { key: 'lgth_g',           label: 'Poids par cm (g/cm)',      type: 'number' },
  ],

  // Œufs
  eggs: [
    { key: 'egg_s',          label: 'Œuf S (g)',                  type: 'number' },
    { key: 'egg_m',          label: 'Œuf M (g)',                  type: 'number' },
    { key: 'egg_l',          label: 'Œuf L (g)',                  type: 'number' },
    { key: 'whte_pctge',     label: 'Pourcentage blanc',          type: 'number', hint: 'ex: 0.6' },
    { key: 'ylw_pctge',      label: 'Pourcentage jaune',          type: 'number', hint: 'ex: 0.4' },
  ],

  // Pâtes (eau/sel)
  pasta: [
    { key: 'psta_wter',      label: 'Eau / g de pâtes (l/100g)',  type: 'number', hint: 'ex: 0.01' },
    { key: 'psta_slt',       label: 'Sel / g de pâtes (g/100g)',  type: 'number', hint: 'ex: 0.1' },
  ],
}

// Retourne la liste finale des champs à éditer pour un ingrédient normalisé
function getSpecsFor(normId: string) {
  const specs = [...SPEC_BY_TYPE.generic]

  // familles par usage
  const isPasta   = ['pates', 'pâtes', 'pasta'].includes(normId)
  const isEggs    = ['oeuf', 'œuf', 'oeufs', 'œufs', 'eggs'].includes(normId)
  const isOnion   = ['oignon', 'oignons'].includes(normId)
  const isTomato  = ['tomate', 'tomates'].includes(normId)
  const isGarlic  = ['ail', 'gousse_d_ail', 'gousses_d_ail'].includes(normId)
  const isCelery  = ['celeri'].includes(normId)

  // modules transverses
  specs.push(...SPEC_BY_TYPE.spoons)   // bcp d’ingrédients peuvent en bénéficier
  specs.push(...SPEC_BY_TYPE.juice)    // idem
  specs.push(...SPEC_BY_TYPE.length)   // au cas où

  if (isPasta) specs.push(...SPEC_BY_TYPE.pasta)
  if (isEggs)  specs.push(...SPEC_BY_TYPE.eggs)

  // Tu peux affiner : retirer 'juice' si l’ingrédient n’a pas de jus, etc.
  return specs
}



// DB statique
// @ts-ignore
const DB = require('../data/ingredients.json') as any[]

// Map d’images (IMAGES ou IMAGE_MAP supportés)
let IMAGES: Record<string, any> = {}
try {
  const mod = require('../src/imageMap')
  IMAGES = (mod.IMAGES || mod.IMAGE_MAP || {}) as Record<string, any>
} catch {
  try {
    const mod2 = require('./imageMap')
    IMAGES = (mod2.IMAGES || mod2.IMAGE_MAP || {}) as Record<string, any>
  } catch {}
}
/** normalise la source d'image (accepte require, {detail,thumb}, etc.) */
const imgSrc = (id: string) => {
  const v: any = IMAGES?.[id]
  return v?.thumb ?? v?.detail ?? v ?? null
}
/** Helpers pour accéder aux images */
const imgThumb = (id: string) =>
  IMAGES?.[id]?.thumb ?? IMAGES?.[id]?.detail ?? IMAGES?.[id] ?? null

const imgDetail = (id: string) =>
  IMAGES?.[id]?.detail ?? IMAGES?.[id]?.thumb ?? IMAGES?.[id] ?? null


/* =======================
   PDT — Usages & helpers
   ======================= */
const PDT_METHODS = [
  { label: 'Frites',            keys: ['frites'] },
  { label: 'Purée',             keys: ['puree'] },
  { label: 'Gratin',            keys: ['gratin'] },
  { label: 'Sautées',           keys: ['saute', 'sautee', 'sautees', 'sautes'] },
  { label: 'Rissolées',         keys: ['rissolee', 'rissolees'] },
  { label: 'Vapeur',            keys: ['vapeur', 'steam'] },
  { label: 'Entières au four',  keys: ['four', 'entieres_four', 'entiere_four'] },
  { label: 'Rôties au four',    keys: ['roties', 'rotie', 'roti', 'roast', 'oties'] },
  { label: 'Potage',            keys: ['potage', 'soupe'] },
] as const
type PdtMethod = (typeof PDT_METHODS)[number]

function hasVal(v: any) { return v !== undefined && v !== null && String(v).trim() !== '' }

/** Helper booléen pour flags CSV (1/true/x/oui/yes) */
function isTrue(v: any) {
  const s = (v ?? '').toString().trim().toLowerCase()
  return s === '1' || s === 'true' || s === 'x' || s === 'oui' || s === 'yes'
}


function scoreFor(row: any, method: PdtMethod): number {
  for (const k of method.keys) {
    const raw = row?.[k]
    if (!hasVal(raw)) continue
    const n = Number(String(raw).replace(',', '.'))
    if (Number.isFinite(n) && n > 0) return n
  }
  return 0
}
const starsFor = (s: number) => (s >= 3 ? '★★★' : s === 2 ? '★★' : s === 1 ? '★' : '')
const verdictFor = (s: number) =>
  s >= 3 ? 'Parfaite' : s === 2 ? 'Convient très bien' : s === 1 ? 'Possible' : ''

// ---- Textes explicatifs PDT (placeholders) ----
const __P = { color: '#444', lineHeight: 20, marginBottom: 6 } as const
const PdtAdvice: Record<string, React.ReactNode> = {
  Gratin: (<View><Text style={__P}>Pour réussir un gratin…</Text></View>),
  Frites: (<View><Text style={__P}>Pour obtenir des frites…</Text></View>),
  Vapeur: (<View><Text style={__P}>La cuisson vapeur…</Text></View>),
  'Entières au four': (<View><Text style={__P}>Pour des pommes entières…</Text></View>),
  'Rôties au four': (<View><Text style={__P}>En morceaux rôtis…</Text></View>),
  Rissolées: (<View><Text style={__P}>Les rissolées demandent…</Text></View>),
  Purée: (<View><Text style={__P}>La qualité d’une purée…</Text></View>),
  Potage: (<View><Text style={__P}>Pour un potage…</Text></View>),
}

/* ========= PÂTES — constantes ========= */
const PASTA_TYPES = [
  { key: 'lg',   label: 'Pâtes longues',     pst: 'pst_lg',   pfct: 'pfct_lg_pst' },
  { key: 'shrt', label: 'Pâtes courtes',     pst: 'pst_shrt', pfct: 'pfct_shrt_pst' },
  { key: 'sml',  label: 'Petites pâtes',     pst: 'pst_sml',  pfct: 'pfct_sml_pst' },
  { key: 'flf',  label: 'Farfalles & Co.',   pst: 'pst_flf',  pfct: 'pfct_flf_pst' },
  { key: 'ovn',  label: 'Pour le four',      pst: 'pst_ovn',  pfct: 'pfct_ovn_pst' },
] as const

// palette 9 couleurs stables (même numéro ⇒ même couleur)
const PALETTE9 = [
  '#d97706', '#059669', '#2563eb', '#db2777', '#16a34a',
  '#7c3aed', '#dc2626', '#0ea5e9', '#9333ea',
]

/* ========= TOMATES — constantes ========= */
const TOMATO_USAGES = [
  { key: 'sld', label: 'Salade',                  col: 'tmt_sld' },
  { key: 'sc',  label: 'Sauce & cuisson longue',  col: 'tmt_sc'  },
  { key: 'frc', label: 'Farcies',                 col: 'tmt_frc' },
  { key: 'ap',  label: 'Apéritif',                col: 'tmt_ap'  },
] as const

const TOMATO_FAMILIES = [
  { col: 'tmt_rd',   label: 'rondes' },
  { col: 'tmt_all',  label: 'allongées' },
  { col: 'tmt_cktl', label: 'cocktail' },
  { col: 'tmt_ch',   label: 'charnues' },
  { col: 'tmt_anc',  label: 'anciennes' },
] as const

/* ========= OIGNONS — constantes ========= */
const ONION_USAGES = [
  { key: 'cru',    label: 'Cru',                         col: 'cru_onn' },
  { key: 'csndc',  label: 'Cuisson douce / mijotée',     col: 'csndc_onn' },
  { key: 'pltrpd', label: 'Plats rapides / sautés',      col: 'pltrpd_onn' },
] as const

// -------- Types --------
type Item = {
  id: string
  label: string
  avg_unit_g?: number | null
  peeled_yield?: number | null
  juice_ml_per_unit?: number | null
  juice_ml_per_g?: number | null
  lgth_g?: number | null
  tbsp_g?: number | null
  tsp_g?: number | null
  density_g_ml?: number | null
  psta_wter?: number | null
  psta_slt?: number | null
  egg_s?: number | null
  egg_m?: number | null
  egg_l?: number | null
  whte_pctge?: number | null
  ylw_pctge?: number | null
  wght_pdt_s?: number | null
  wght_pdt_m?: number | null
  wght_pdt_l?: number | null
  pdt_spcfc_wght?: number | null
  pdt_spcfc_peel?: number | null
  clr_lgth?: number | null
  genre?: string | null
  gender?: string | null
  tea?: string | number | null
  grn_tp?: string | number | null
  grn_tm?: string | number | null
  bck_tp?: string | number | null
  bck_tm?: string | number | null
  olg_tp?: string | number | null
  olg_tm?: string | number | null
  rbs_tp?: string | number | null
  rbs_tm?: string | number | null
  appl_spcfc_wght?: number | null
  is_appl?: any
  is_cheese?: any
  milk_cheese?: string | null
  fmly_cheese?: string | null
  croute_cheese?: string | null
  origin_cheese?: string | null
  aop_cheese?: string | null
  is_coffee_use?: any
  coffee_mouture?: string | null
  coffee_spcfc_tbsp_g?: number | null
  coffee_tmp?: number | null
  coffee_tme?: number | null
  coffee_cup_cl?: number | null
  coffee_g_per_cl_lght?: number | null
  coffee_g_per_cl_strng?: number | null
  coffee_g_per_cl_intense?: number | null
  is_pear?: any
  pear_spcfc_wght?: number | null
  pear_spcfc_peel?: number | null
  crok_pear?: any
  cook_pear?: any
  syrup_pear?: any
  salt_pear?: any
  is_flour_use?: any
  flour_T?: string | null
  Flour_W?: string | number | null
  flour_w?: string | number | null // fallback si CSV en minuscule


}

// -------- Helpers génériques --------
const teaTemp = (v: any) => {
  if (v === null || v === undefined || v === '') return '—'
  const n = Number(String(v).replace(',', '.'))
  return Number.isFinite(n) ? `${fmt(n)} °C` : String(v)
}
const teaTime = (v: any) => {
  if (v === null || v === undefined || v === '') return '—'
  const n = Number(String(v).replace(',', '.'))
  return Number.isFinite(n) ? `${fmt(n)} min` : String(v)
}
const num = (s: string) => {
  const n = Number((s ?? '').toString().replace(',', '.'))
  return isNaN(n) ? 0 : n
}
function fmt(n: any, digits = 2) {
  if (n == null || isNaN(Number(n))) return '—'
  const r = Number(Number(n).toFixed(digits))
  const s = String(r)
  return /\.\d+$/.test(s) ? s.replace(/\.?0+$/, '') : s
}
function fmtAllUnits(grams: number) {
  const g = Math.max(0, grams || 0)
  const mg = Math.round(g * 1000)
  const kg = g / 1000
  return `${fmt(g)} g  |  ${fmt(mg, 0)} mg  |  ${fmt(kg, 3)} kg`
}
function fmtVolAllUnits(ml: number) {
  const m = Math.max(0, ml || 0)
  const cl = m / 10
  const l  = m / 1000
  return `${fmt(m)} ml  |  ${fmt(cl)} cl  |  ${fmt(l, 3)} l`
}
function toNumPos(v: any): number | null {
  const n = toNumMaybe(v)
  return n !== null && n > 0 ? n : null
}
function juicePerUnitMl(d: Item): number | null {
  const perG = toNumPos(d.juice_ml_per_g)
  const avgG = toNumPos(d.avg_unit_g)
  if (perG && avgG) return avgG * perG            // priorité au per g
  const perUnit = toNumPos(d.juice_ml_per_unit)   // fallback
  return perUnit ?? null
}
function hasJuice(d: Item): boolean {
  return (toNumPos(d.juice_ml_per_g) && toNumPos(d.avg_unit_g)) || toNumPos(d.juice_ml_per_unit) ? true : false
}
function juiceFromWeightMl(weightG: number, d: Item): number | null {
  const perG = toNumPos(d.juice_ml_per_g)
  if (!perG) return null
  return Math.max(0, weightG || 0) * perG
}
function toNumMaybe(v: any): number | null {
  if (v === undefined || v === null || v === '') return null
  const n = Number(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
function getPeelYield(d: any): number | null {
  const keys = [
    'pdt_spcfc_peel',
    'appl_spcfc_peel',
    'tmt_spcfc_peel',
    'avoc_spcfc_peel',
    'pepr_spcfc_peel',
    'pear_spcfc_peel',
    'peeled_yield',
  ] as const;

  for (const k of keys) {
    const raw = (d as any)[k];
    if (raw === undefined || raw === null || raw === '') continue;
    const n = Number(String(raw).replace(',', '.'));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

// Normalise un id/label et renvoie la mention "préparation épluchée" adaptée
function peeledLabelFor(nameOrId: string): string {
  const s = (nameOrId || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // retire accents

  if (s.includes('pomme'))   return '(Pomme pelée & évidée)';
  if (s.includes('poire'))   return '(Poire épluchée et évidée)'; 
  if (s.includes('ail'))     return '(gousse pelée et dégermée)';
  if (s.includes('tomate'))  return '(tomate équeutée et époinçonnée, non pelée)';
  if (s.includes('avocat'))  return '(avocat pelé et dénoyauté)';
  if (s.includes('poivron')) return '(poivron équeuté, épépiné, non pelé)';
  return '(préparation standard)';
}


/** Récupère le 1er entier présent dans une cellule (ex: "8#xx" -> 8) */
function firstInt(v: any): number | null {
  if (!hasVal(v)) return null
  const m = String(v).match(/(\d+)/)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) ? n : null
}
/** Parse "info_sls" -> map numero -> texte (formats: "8:txt;9:autre" ou "8=txt | 9=...") */
function parseInfoMap(info: any): Record<number, string> {
  const txt = String(info ?? '').trim()
  if (!txt) return {}
  const parts = txt.split(/[;|]\s*/g)
  const map: Record<number, string> = {}
  for (const p of parts) {
    const m = p.match(/^\s*(\d+)\s*[:=]\s*(.+)$/)
    if (m) {
      map[Number(m[1])] = m[2].trim()
    }
  }
  return map
}
function infoTextFor(row: any, n: number): string {
  const map = parseInfoMap(row?.info_sls)
  if (map[n]) return map[n]
  return String(row?.info_sls ?? '').trim()
}
/* ========= Composant principal ========= */

export default function Results() {
  const { running, remainingMs } = useTimer()
  const { items } = useLocalSearchParams<{ items?: string }>()
  const ids: string[] = useMemo(() => {
    try { return items ? JSON.parse(items) : [] } catch { return [] }
  }, [items])

  const data: Item[] = useMemo(() => {
    const map = Object.fromEntries((DB as Item[]).map(d => [d.id, d]))
    return ids.map(id => map[id]).filter(Boolean)
  }, [ids])

  // Modal d’info global (pour usages pâtes)
  const [infoModal, setInfoModal] = useState<{ title: string; text: string } | null>(null)

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={st.container} contentContainerStyle={{ padding: 16, paddingTop: 28 }}>
        <View style={st.headerWrap}>
          <Text style={st.h1}>Convertisseurs</Text>

          <View style={st.actionsWrap}>
            <TouchableOpacity onPress={() => router.push('/timer')}>
              <Text style={st.actionLink}>⏱️ Minuteur</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/universel')}>
              <Text style={st.actionLink}>🌎 Convertisseur universel</Text>
            </TouchableOpacity>
            {/* dans <View style={st.actionsWrap}> */}
            <TouchableOpacity onPress={() => router.push('/parts')}>
  <Text style={st.actionLink}>🍽️ Conversion de parts</Text>
</TouchableOpacity>

            <TouchableOpacity onPress={() => router.push('/calculatrice')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Calculator size={18} color="#57324B" strokeWidth={2} />
                      <Text style={st.actionLink}>Calculatrice</Text>
                    </TouchableOpacity>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={st.actionLinkSecondary}>↩︎ Modifier</Text>
            </TouchableOpacity>
          </View>
        </View>

        {running && (
          <TouchableOpacity
            onPress={() => router.push('/timer')}
            style={st.timerBanner}
            activeOpacity={0.9}
          >
            <Text style={st.timerBannerText}>
              ⏱ Temps restant : {msToMMSS(remainingMs)} — toucher pour ouvrir
            </Text>
          </TouchableOpacity>
        )}

        {data.length === 0 && <Text>Aucun ingrédient sélectionné.</Text>}

        {data.map(d => (
          <IngredientCard
            key={d.id}
            d={d}
            openInfo={(title, text) => setInfoModal({ title, text })}
          />
        ))}
      </ScrollView>

      {/* Overlay d’info */}
      {infoModal && (
        <View style={st.infoOverlay} pointerEvents="box-none">
          <Pressable style={st.infoBackdrop} onPress={() => setInfoModal(null)} />
          <View style={st.infoCard}>
            <View style={st.infoHeader}>
              <Text style={st.infoTitle}>{infoModal.title}</Text>
              <TouchableOpacity
                onPress={() => setInfoModal(null)}
                style={st.closeBtn}
                activeOpacity={0.9}
              >
                <Text style={st.closeBtnTxt}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 240 }} contentContainerStyle={{ paddingBottom: 6 }}>
              <Text style={st.infoBody}>{infoModal.text}</Text>
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  )
}


/* ========= Sous-composants ========= */

function Row({ left, right }: { left: string; right: string }) {
  return (
    <View style={st.row}>
      <Text style={st.k}>{left}</Text>
      <Text style={st.v}>{right}</Text>
    </View>
  )
}

function InputWithEcho(props: {
  value: string
  onChangeText: (t: string) => void
  placeholder: string
  echoLabel: string
  keyboardType?: 'default' | 'numeric'
}) {
  const { value, onChangeText, placeholder, echoLabel, keyboardType = 'numeric' } = props
  return (
    <View style={st.inputWrap}>
      <TextInput
        style={st.input}
        keyboardType={keyboardType}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#ff8fcd"
      />
      {!!value && (
        <Text numberOfLines={1} ellipsizeMode="tail" style={st.echo}>
          {echoLabel}: {value}
        </Text>
      )}
    </View>
  )
}

function InfoButton({
  tint,
  onPress,
  variant = 'light',
  disabled = false,
}: {
  tint: string
  onPress: (e?: any) => void
  variant?: 'light' | 'solid'
  disabled?: boolean
}) {
  if (disabled) return null
  const isLight = variant === 'light'
  return (
    <TouchableOpacity
      onPress={(e) => {
        e?.stopPropagation?.()
        onPress(e)
      }}
      activeOpacity={0.9}
      style={[
        st.infoBtn,
        isLight
          ? { borderColor: '#fff', backgroundColor: 'rgba(255,255,255,0.2)' }
          : { borderColor: tint, backgroundColor: '#FFFFFF' },
      ]}
    >
      <Text style={[st.infoBtnTxt, { color: isLight ? '#fff' : tint }]}>i</Text>
    </TouchableOpacity>
  )
}

function IngredientCard({
  d,
  openInfo,
}: {
  d: Item
  openInfo: (title: string, text: string) => void
}) {
  // ================== États UI saisis ==================
  const [qtyEpl, setQtyEpl] = useState('')
  const [qtyNon, setQtyNon] = useState('')
  const [countNon, setCountNon] = useState('')
  const [countEpl, setCountEpl] = useState('')
  const [genWeightEpl, setGenWeightEpl] = useState('')
  const [genWeightNon, setGenWeightNon] = useState('')
  const [countJuice, setCountJuice] = useState('')
  const [volMl, setVolMl] = useState('')
  const [lengthCm, setLengthCm] = useState('')
  const [lenWeightG, setLenWeightG] = useState('')
  const [tsp, setTsp] = useState('')
  const [tbsp, setTbsp] = useState('')
  const [weightToSpoons, setWeightToSpoons] = useState('')
  const [pastaG, setPastaG] = useState('')
  const [waterL, setWaterL] = useState('')
  const [eggSize, setEggSize] = useState<'S' | 'M' | 'L'>('S')
  const [eggTargetTotal, setEggTargetTotal] = useState('')
  const [eggTargetWhite, setEggTargetWhite] = useState('')
  const [eggTargetYolk, setEggTargetYolk] = useState('')
  const [pdtSize, setPdtSize] = useState<'S' | 'M' | 'L'>('M')
  const [pdtWeightNon, setPdtWeightNon] = useState('')
  const [pdtWeightEpl, setPdtWeightEpl] = useState('')
  const [celeryBranches, setCeleryBranches] = useState('')
  const [celeryWeight, setCeleryWeight] = useState('')

  // Usages / Variétés
  const [pdtMethod, setPdtMethod] = useState<PdtMethod | null>(null)
  const [pdtSelected, setPdtSelected] = useState<any | null>(null)

  // PÂTES — états UI
  const [showPastaUsages, setShowPastaUsages] = useState(false)
  const [pastaUsageSelId, setPastaUsageSelId] = useState<string | null>(null)
  const [pastaSelected, setPastaSelected] = useState<any | null>(null)

  // TOMATES — états UI
  const [tomatoUsageSelKey, setTomatoUsageSelKey] =
    useState<null | (typeof TOMATO_USAGES)[number]['key']>(null)
  const [tomatoSelected, setTomatoSelected] = useState<any | null>(null)

  // OIGNONS — états UI
  const [onionUsageSelKey, setOnionUsageSelKey] =
    useState<null | (typeof ONION_USAGES)[number]['key']>(null)
  const [onionSelected, setOnionSelected] = useState<any | null>(null)

  // ================== Overrides (molette unique par ingrédient) ==================
  const targetId = normalizeId(d.id || d.label || 'unknown')
  const { values: ov, reload, version } = useIngredientOverrides(targetId)

  // Données fusionnées (CSV + overrides utilisateur)
  const dOV = mergeWithOverrides(d as any, ov, [
  'avg_unit_g','peeled_yield','density_g_ml','tbsp_g','tsp_g',
  'juice_ml_per_g','juice_ml_per_unit','lgth_g',
  'egg_s','egg_m','egg_l','whte_pctge','ylw_pctge',
  'psta_wter','psta_slt',
  // 👇👇 AJOUTE les clés café pour que CoffeeSection voie bien les overrides
  'coffee_mouture','coffee_tmp','coffee_tme','coffee_cup_cl',
  'coffee_g_per_cl_lght','coffee_g_per_cl_strng','coffee_g_per_cl_intense',
  'coffee_spcfc_tbsp_g',
])

  // version simple pour forcer un re-render local si besoin
  const [ovRev, setOvRev] = useState(0)
  const bump = () => setOvRev((x) => x + 1)

  // état du modal ⚙️
  const [showEditor, setShowEditor] = useState(false)

  // Specs dynamiques (afficher seulement les champs présents dans le CSV pour cet ingrédient)
  const specsForThis = getSpecsFromRow(d as any)

  // Savoir s’il existe des données utilisateur (bannière)
  const [hasUserOverrides, setHasUserOverrides] = useState(false)
  useEffect(() => {
    let mounted = true
    hasOverrides(targetId).then((ok) => { if (mounted) setHasUserOverrides(ok) })
    return () => { mounted = false }
  }, [targetId, version])

  // ================== Flags par id (utilisés pour l’affichage) ==================
  const normIdFlags = (d.id || d.label || '')
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '_')
  const isPotato = ['pomme_de_terre', 'pommes_de_terre', 'pdt'].includes(normIdFlags)
  const isCelery = normIdFlags === 'celeri'
  const isPasta = ['pates', 'pâtes', 'pasta'].includes(normIdFlags)
  const isTomato = ['tomate', 'tomates'].includes(normIdFlags)
  const isOnion = ['oignon', 'oignons'].includes(normIdFlags)
  const isAvocado = ['avocat', 'avocats'].includes(normIdFlags)
  const isPepper = ['poivron', 'poivrons'].includes(normIdFlags)
  const isApple = ['pomme', 'pommes'].includes(normIdFlags)
  const isPear = ['poire', 'poires'].includes(normIdFlags)
  const isGarlic = ['ail', 'gousse_d_ail', 'gousses_d_ail', 'tete_d_ail', 'tête_d_ail'].includes(normIdFlags)
  const isCoffee = ['cafe', 'café', 'coffee'].includes(normIdFlags)
  const isFlour = ['farine', 'farines', 'flour'].includes(normIdFlags)
  const isZucchini = ['courgette', 'courgettes'].includes(normIdFlags)
  const isEggplant = ['aubergine', 'aubergines'].includes(normIdFlags)


  // ================== Constantes dOV (utiliser dOV pour les calculs) ==================
  const peelYEff = getPeelYield(dOV)
  const showPeeled = !isPotato && peelYEff !== null && Number.isFinite(peelYEff) && peelYEff > 0

  // Accord "épluché / épluchée"
  const g = (dOV.genre ?? dOV.gender ?? '').toString().trim().toLowerCase()
  const isF = g === 'f' || g.startsWith('fem')
  const EPL = `Épluch${isF ? 'ée' : 'é'}`
  const NON_EPL = `Non épluch${isF ? 'ée' : 'é'}`
  const NON_EPL_SHORT = 'non épl.'

  // Poids unitaire PDT selon taille
  const pdtS = toNumMaybe(dOV.wght_pdt_s) ?? null
  const pdtM = toNumMaybe(dOV.wght_pdt_m) ?? null
  const pdtL = toNumMaybe(dOV.wght_pdt_l) ?? null
  const hasPdt = pdtS !== null || pdtM !== null || pdtL !== null
  const pdtUnit = pdtSize === 'S' ? pdtS ?? 0 : pdtSize === 'M' ? pdtM ?? 0 : pdtL ?? 0

  // Constantes générales
  const density = dOV.density_g_ml ?? 1
  const tsp_gEff = dOV.tsp_g ?? (dOV.tbsp_g ? dOV.tbsp_g / 3 : null)
  const tbsp_gEff = dOV.tbsp_g ?? (tsp_gEff ? tsp_gEff * 3 : null)

  // Pâtes (eau/sel)
  const pastaW = toNumMaybe(dOV.psta_wter)
  const pastaS = toNumMaybe(dOV.psta_slt)
  const hasPasta = pastaW !== null || pastaS !== null

  // Œufs
  const eggS = toNumMaybe(dOV.egg_s) ?? null
  const eggM = toNumMaybe(dOV.egg_m) ?? null
  const eggL = toNumMaybe(dOV.egg_l) ?? null
  const whitePct = toNumMaybe(dOV.whte_pctge) ?? null
  const yolkPct = toNumMaybe(dOV.ylw_pctge) ?? null
  const hasEggs = (eggS || eggM || eggL) !== null && (whitePct !== null || yolkPct !== null)
  const eggUnit = eggSize === 'S' ? (eggS ?? 0) : eggSize === 'M' ? (eggM ?? 0) : (eggL ?? 0)

  // Céleri
  const celeryG = toNumMaybe(dOV.clr_lgth) ?? null
  const hasCelery = isCelery && celeryG !== null

  // THÉ (affichage)
  const hasTea = dOV.tea !== undefined && dOV.tea !== null && String(dOV.tea).trim() !== ''
  const t_grn_tp = (dOV as any).grn_tp
  const t_grn_tm = (dOV as any).grn_tm
  const t_bck_tp = (dOV as any).bck_tp
  const t_bck_tm = (dOV as any).bck_tm
  const t_olg_tp = (dOV as any).olg_tp
  const t_olg_tm = (dOV as any).olg_tm
  const t_rbs_tp = (dOV as any).rbs_tp
  const t_rbs_tm = (dOV as any).rbs_tm

  // ================== Infos clés ==================
  
  // ================== Infos clés (standardisées) ==================
const infoRows: React.ReactNode[] = []

// 1) Poids moyen (1 pièce) — si dispo
const avgUnit = toNumMaybe(dOV.avg_unit_g)
if (avgUnit !== null) {
  infoRows.push(
    <Row key="avg_unit_g" left="Poids moyen (1 pièce)" right={`${fmt(avgUnit)} g`} />
  )
}

// 2) Taux d’épluchage — si dispo
const peelRate = getPeelYield(dOV)
if (peelRate !== null && Number.isFinite(peelRate)) {
  // NOTE : peeledLabelFor() inclut déjà les parenthèses.
  const note = (isApple || isPear) ? peeledLabelFor(dOV.id || dOV.label || '') : ''
  infoRows.push(
    <Row
      key="peeled_yield"
      left={`Taux d'épluchage${note ? ' ' + note : ''}`}
      right={`×${fmt(peelRate)}`}
    />
  )
}

// 3) Poids épluché (avec précision) — si les 2 sont dispo
if (
  avgUnit !== null &&
  peelRate !== null &&
  Number.isFinite(peelRate) &&
  !(isApple || isPear)  // ⬅️ NE PAS afficher pour pomme/poire
) {
  const special =
    isTomato   ? ' (Tomate équeutée et époinçonnée, non pelée)' :
    isAvocado  ? ' (Avocat pelé et dénoyauté)' :
    isPepper   ? ' (Poivron équeuté, épépiné, non pelé)' :
    isZucchini ? ' (Courgette équeutée et épluchée une tranche sur deux)' :
    isEggplant ? ' (Aubergine équeutée)' :
  ''; // 👉 supprime la parenthèse (×0.85)

  infoRows.push(
    <Row
      key="peeled"
      left={`Poids ${EPL.toLowerCase()}${special}`}
      right={`${fmt(avgUnit * peelRate)} g`}
    />
  )
}


// (optionnel) Infos complémentaires si présentes dans le CSV / overrides.
// On les ajoute APRES le trio standard pour garder l’ordre cohérent.

// Cuillères
const tbspNum = toNumMaybe(dOV.tbsp_g)
if (tbspNum !== null) {
  infoRows.push(<Row key="tbsp_g" left="1 cuillère à soupe" right={`${fmt(tbspNum)} g`} />)
}
const tspNum = toNumMaybe(dOV.tsp_g)
if (tspNum !== null) {
  infoRows.push(<Row key="tsp_g" left="1 cuillère à café" right={`${fmt(tspNum)} g`} />)
}

// Densité
const densNum = toNumMaybe(dOV.density_g_ml)
if (densNum !== null) {
  infoRows.push(<Row key="density" left="Densité" right={`${fmt(densNum)} g/ml`} />)
}

// Jus moyen (1 pièce)
const jPerUnit = juicePerUnitMl(dOV)
if (jPerUnit != null) {
  infoRows.push(<Row key="juice" left="Jus moyen (1 pièce)" right={fmtVolAllUnits(jPerUnit)} />)
}


  if (isGarlic) {
    const cloves = toNumMaybe((dOV as any).ail_nmbr) ?? toNumMaybe((dOV as any).ail_nmber) ?? null
    if (cloves && Number.isFinite(cloves) && cloves > 0) {
      const n = Math.round(cloves)
      const unit = n > 1 ? 'gousses' : 'gousse'
      infoRows.push(<Row key="garlic-head" left="Tête d'ail" right={`≈ ${n} ${unit}`} />)
    }
  }



  // ================== Variétés / Usages (inchangé) ==================
  const pdtVarieties = useMemo(() => (DB as any[]).filter((v) => Number(v?.is_pdt) === 1), [])
  const pastaUsages = useMemo(() => {
    const rows = (DB as any[]).filter((r) =>
      ['pfct_lg_pst','pfct_shrt_pst','pfct_sml_pst','pfct_flf_pst','pfct_ovn_pst'].some((k) => hasVal(r?.[k]))
    )
    return rows.map((r) => {
      const nums = ['pfct_lg_pst','pfct_shrt_pst','pfct_sml_pst','pfct_flf_pst','pfct_ovn_pst']
        .map((k) => firstInt(r?.[k])).filter((n): n is number => n !== null)
      const numMain = nums[0] ?? 0
      const flags = {
        lg: hasVal(r?.pfct_lg_pst),
        shrt: hasVal(r?.pfct_shrt_pst),
        sml: hasVal(r?.pfct_sml_pst),
        flf: hasVal(r?.pfct_flf_pst),
        ovn: hasVal(r?.pfct_ovn_pst),
      }
      const isGen = hasVal(r?.gnrc_sls)
      return { row: r, num: numMain, flags, isGen }
    }).filter(x => x.num > 0)
  }, [])
  const tomatoVarieties = useMemo(() => (DB as any[]).filter((v) => hasVal(v?.is_tmt)), [])
  const onionVarieties  = useMemo(() => (DB as any[]).filter((v) => hasVal(v?.is_onn)), [])

  const selectedUsage = useMemo(
    () => pastaUsages.find(u => u.row?.id === pastaUsageSelId) || null,
    [pastaUsages, pastaUsageSelId]
  )

  // ================== RENDER ==================
  return (
    <View style={st.card}>
      {/* Titre + molette + image */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={[st.h2, { flex: 1 }]}>{d.label}</Text>

       
        {imgSrc(d.id) && (
          <Image source={imgSrc(d.id)} style={{ width: 44, height: 44, marginLeft: 8 }} resizeMode="contain" />
        )}
      </View>

      {/* Bannière “Données personnalisées” */}
      {hasUserOverrides && (
        <View
          style={{
            backgroundColor: '#FFF0F5',
            borderColor: '#FF4FA2',
            borderWidth: 1,
            borderRadius: 10,
            padding: 8,
            marginTop: 6,
            marginBottom: 6,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}
        >
          
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#FF4FA2', fontWeight: '700' }}>⚠️ Données personnalisées</Text>
<Text style={{ color: '#57324B', fontSize: 13 }}>
  Ces valeurs remplacent celles de base. Appuyez sur ⚙️ pour revoir ou réinitialiser.
</Text>

          </View>
        </View>
      )}


{(infoRows.length > 0 || (ENABLE_OVERRIDES && specsForThis.length > 0)) && (
  <View style={st.section}>
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
      <Text style={[st.sTitle, { flex: 1 }]}>Infos clés</Text>

      {/* ⚙️ masquer pour le café ici */}
      {ENABLE_OVERRIDES && specsForThis.length > 0 && !isCoffee && (
        <TouchableOpacity
          onPress={() => setShowEditor(true)}
          activeOpacity={0.9}
          style={{
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 999,
            borderWidth: 2,
            borderColor: '#FFB6F9',
            backgroundColor: '#FFE4F6',
          }}
        >
          <Text style={{ fontWeight: '900', color: '#FF4FA2' }}>⚙️</Text>
        </TouchableOpacity>
      )}
    </View>

    {/* Si aucune info (cas café), on garde un corps vide pour conserver la structure */}
    {infoRows}
  </View>
)}



      {/* ========= Épluché ⇆ Non épluché (si peeled_yield) ========= */}
      {(() => {
        if (isApple || isPear) return null
        if (isGarlic) return null
        const peelY = getPeelYield(dOV)
        if (!peelY) return null

        const nonFromEpl = num(qtyEpl) / peelY
        const eplFromNon = num(qtyNon) * peelY

        return (
          <View style={st.section}>
            <Text style={st.sTitle}>
  Épluché <Text style={st.arrow}>⇆</Text> Non épluché
  <Text>
    {isTomato    ? ' (Tomate équeutée et époinçonnée, non pelée)'
    : isAvocado  ? ' (Avocat pelé et dénoyauté)'
    : isPepper   ? ' (Poivron équeuté, épépiné, non pelé)'
    : isZucchini ? ' (Courgette équeutée et épluchée une tranche sur deux)'
    : isEggplant ? ' (Aubergine équeutée)'
    : ''}
  </Text>
</Text>

            <InputWithEcho
              value={qtyEpl}
              onChangeText={setQtyEpl}
              placeholder="Quantité épluchée (g)"
              echoLabel="Épluchée (g)"
            />
            <Row left="Équiv. non épluché" right={fmtAllUnits(nonFromEpl)} />

            <InputWithEcho
              value={qtyNon}
              onChangeText={setQtyNon}
              placeholder="Quantité non épluchée (g)"
              echoLabel="Non épluchée (g)"
            />
            <Row left="Équiv. épluché" right={fmtAllUnits(eplFromNon)} />
          </View>
        )
      })()}

      {/* ========= Module Œufs ========= */}
      {(() => {
        const eggS = toNumMaybe(dOV.egg_s) ?? null
        const eggM = toNumMaybe(dOV.egg_m) ?? null
        const eggL = toNumMaybe(dOV.egg_l) ?? null
        const whitePct = toNumMaybe(dOV.whte_pctge) ?? null
        const yolkPct  = toNumMaybe(dOV.ylw_pctge)  ?? null
        const hasEggs =
          (eggS || eggM || eggL) !== null && (whitePct !== null || yolkPct !== null)
        if (!hasEggs) return null
        return <EggsSection d={dOV} />
      })()}

      {/* --------- Module VOLAILLE --------- */}
      {(() => {
        const normId = (dOV.id || dOV.label || '').toString().toLowerCase().replace(/\s+/g, '_')
        const isChicken = normId === 'volaille'
        if (!isChicken) return null
        return <ChickenSection d={dOV} />
      })()}

      {/* --------- Module ÉPICES --------- */}
      {(() => {
        const normId = (dOV.id || dOV.label || '').toString().toLowerCase().replace(/\s+/g, '_')
        const isSpices = normId === 'epices' || normId === 'epice'
        if (!isSpices) return null
        return <SpicesSection d={dOV} />
      })()}

      {/* --------- Pommes de terre --------- */}
      {(() => {
        const normId = (dOV.id || dOV.label || '').toString().toLowerCase().replace(/\s+/g, '_')
        const isPotato = ['pomme_de_terre', 'pommes_de_terre', 'pdt'].includes(normId)
        if (!isPotato) return null
        return <PotatoSection d={dOV} openInfo={openInfo} />
      })()}

      {/* --------- Module PÂTES --------- */}
      {(() => {
        const normId = (dOV.id || dOV.label || '').toString().toLowerCase().replace(/\s+/g, '_')
        const isPasta = ['pates', 'pâtes', 'pasta'].includes(normId)
        if (!isPasta) return null
        return <PastaSection d={dOV} openInfo={openInfo} />
      })()}

      {/* --------- Module TOMATES --------- */}
      {(() => {
        const normId = (dOV.id || dOV.label || '').toString().toLowerCase().replace(/\s+/g, '_')
        const isTomato = ['tomate', 'tomates'].includes(normId)
        if (!isTomato) return null
        return <TomatoSection d={dOV} />
      })()}

      {/* --------- Module FROMAGES --------- */}
      {(() => {
        const normId = (dOV.id || dOV.label || '').toString().toLowerCase().replace(/\s+/g, '_')
        const isCheese = normId === 'fromages' || normId === 'fromage' || normId === 'cheese'
        if (!isCheese) return null
        return <CheeseSection d={dOV} />
      })()}

      {/* --------- Module OIGNONS --------- */}
      {(() => {
        const normId = (dOV.id || dOV.label || '').toString().toLowerCase().replace(/\s+/g, '_')
        const isOnion = ['oignon', 'oignons'].includes(normId)
        if (!isOnion) return null
        return <OnionSection d={dOV} />
      })()}

      {/* --------- Module CHOUX --------- */}
      {(() => {
        const normId = (dOV.id || dOV.label || '').toString().toLowerCase().replace(/\s+/g, '_')
        const isCabbage = normId === 'choux' || normId === 'chou'
        if (!isCabbage) return null
        return <CabbageSection d={dOV} />
      })()}

      {/* --------- Module AIL --------- */}
      {(() => {
        const normId = (dOV.id || dOV.label || '').toString().toLowerCase().replace(/\s+/g, '_')
        const isGarlic = ['ail','gousse_d_ail','gousses_d_ail'].includes(normId)
        if (!isGarlic) return null
        return <GarlicSection d={dOV} />
      })()}

      {/* --------- Module POMMES --------- */}
      {(() => {
        const normId = (dOV.id || dOV.label || '').toString().toLowerCase().replace(/\s+/g, '_')
        const isApple = ['pomme', 'pommes'].includes(normId)
        if (!isApple) return null
        return <AppleSection d={dOV} />
      })()}

      {/* --------- Module POIRES --------- */}
      {(() => {
        const normId = (dOV.id || dOV.label || '').toString().toLowerCase().replace(/\s+/g, '_')
        const isPear = ['poire', 'poires'].includes(normId)
        if (!isPear) return null
        return <PearSection d={dOV} />
      })()}

      {/* --------- Module FARINE --------- */}
      {(() => {
        const normId = (dOV.id || dOV.label || '').toString().toLowerCase().replace(/\s+/g, '_')
        const isFlour = ['farine', 'farines', 'flour'].includes(normId)
        if (!isFlour) return null
        return <FlourSection d={dOV} />
      })()}

      {/* --------- Jus (priorité) --------- */}
      {(() => {
        if (!hasJuice(dOV)) return null
        return <JuiceSection d={dOV} />
      })()}

      {/* --------- Module CAFÉ --------- */}
      {(() => {
        const ref = (dOV.id || dOV.label || '')
          .toString()
          .toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/\s+/g, '_')
        const isCoffee = ['cafe','coffee'].includes(ref)
        if (!isCoffee) return null
        return <CoffeeSection d={dOV} />
      })()}

      {/* --------- Conversions génériques --------- */}
      {/* --------- Conversions génériques --------- */}
{(() => {
  const normId = (dOV.id || dOV.label || '').toString().toLowerCase().replace(/\s+/g, '_')
  const isPotato   = ['pomme_de_terre', 'pommes_de_terre', 'pdt'].includes(normId)
  const isPasta    = ['pates', 'pâtes', 'pasta'].includes(normId)
  const isApple    = ['pomme', 'pommes'].includes(normId)
  const isPear     = ['poire', 'poires'].includes(normId)
  const isGarlic   = ['ail', 'gousse_d_ail', 'gousses_d_ail'].includes(normId)
  const isZucchini = ['courgette', 'courgettes'].includes(normId)
  const isEggplant = ['aubergine', 'aubergines'].includes(normId)

  if (isPotato || isPasta || isApple || isPear || isGarlic || !dOV.avg_unit_g) return null
  return <GenericConversions d={dOV} />
})()}


      {/* --------- Céleri --------- */}
      {(() => {
        const normId = (dOV.id || dOV.label || '').toString().toLowerCase().replace(/\s+/g, '_')
        const isCelery = normId === 'celeri'
        const celeryG = toNumMaybe(dOV.clr_lgth) ?? null
        if (!isCelery || celeryG === null) return null
        return <CelerySection d={dOV} />
      })()}

      {/* --------- Taille ⇆ Poids --------- */}
      {dOV.lgth_g ? <LengthWeightSection d={dOV} /> : null}

      {/* --------- Cuillères ⇆ Poids --------- */}
      {(dOV.tbsp_g || dOV.tsp_g) ? <SpoonsSection d={dOV} /> : null}

      {/* --------- Pâtes — eau & sel --------- */}
      {(() => {
        const pw = toNumMaybe(dOV.psta_wter)
        const ps = toNumMaybe(dOV.psta_slt)
        const hp = pw !== null || ps !== null
        if (!hp) return null
        return <PastaWaterSaltSection d={dOV} />
      })()}

      {/* ======= PARAM EDITOR (modal) ======= */}
      <ParamEditor
        visible={showEditor}
        onClose={() => setShowEditor(false)}
        targetId={targetId}
        base={d as any}              // CSV d’origine (pour "valeurs par défaut")
        specs={specsForThis as any}  // champs dynamiques (carotte = juste avg_unit_g + peeled_yield, etc.)
        onSaved={async () => {
          await reload()
          const ok = await hasOverrides(targetId)
          setHasUserOverrides(ok)
          setShowEditor(false)
          bump()
        }}
        onReset={async () => {
          await reload()
          const ok = await hasOverrides(targetId)
          setHasUserOverrides(ok)
          setShowEditor(false)
          bump()
        }}
      />
    </View>
  )
}
 

  function EggsSection({ d }: { d: Item }) {
    const [eggSize, setEggSize] = useState<'S' | 'M' | 'L'>('S')
    const [eggTargetTotal, setEggTargetTotal] = useState('')
    const [eggTargetWhite, setEggTargetWhite] = useState('')
    const [eggTargetYolk, setEggTargetYolk] = useState('')
    const [eggCount, setEggCount] = useState('')


    const eggS = toNumMaybe(d.egg_s) ?? 0
    const eggM = toNumMaybe(d.egg_m) ?? 0
    const eggL = toNumMaybe(d.egg_l) ?? 0
    const whitePct = toNumMaybe(d.whte_pctge) ?? 0
    const yolkPct  = toNumMaybe(d.ylw_pctge)  ?? 0
    const eggUnit = eggSize === 'S' ? eggS : eggSize === 'M' ? eggM : eggL

    return (
      <View style={st.section}>
        <Text style={st.sTitle}>Infos clés</Text>
        <Row left="Œuf petit (S)" right="< 50 g" />
        <Row left="Œuf moyen (M)" right="50–60 g" />
        <Row left="Œuf gros (L)" right="60–70 g" />
        <View style={{ height: 6 }} />
        <Text style={st.sTitle}>Cuisson (départ eau bouillante)</Text>
        <Row left="Pochés" right="2 min" />
        <Row left="À la coque" right="3 min" />
        <Row left="Durs" right="9 min" />

        <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
          {(['S', 'M', 'L'] as const).map(sz => {
            const on = eggSize === sz
            return (
              <TouchableOpacity key={sz} onPress={() => setEggSize(sz)} activeOpacity={0.9} style={[st.sizeBtn, on && st.sizeBtnOn]}>
                <Text style={[st.sizeBtnText, on && st.sizeBtnTextOn]}>{sz}</Text>
              </TouchableOpacity>
            )
          })}
        </View>

        <Text style={[st.sTitle, { marginTop: 10 }]}>Poids <Text style={st.arrow}>⇆</Text> Quantité</Text>

        <InputWithEcho value={eggTargetTotal} onChangeText={setEggTargetTotal} placeholder="Pds voulu Blanc+Jaune (g)" echoLabel="Blanc+Jaune (g)" />
        {(() => {
          const sumPct = whitePct + yolkPct
          const denom = (eggUnit || 0) * sumPct
          const eggs = denom > 0 ? Math.ceil(num(eggTargetTotal) / denom) : 0
          return <Row left="Nombre d'œufs estimés" right={`${eggs} œufs`} />
        })()}

        <InputWithEcho value={eggTargetWhite} onChangeText={setEggTargetWhite} placeholder="Poids voulu Blancs (g)" echoLabel="Blancs (g)" />
        {(() => {
          const denom = (eggUnit || 0) * whitePct
          const eggs = denom > 0 ? Math.ceil(num(eggTargetWhite) / denom) : 0
          return <Row left="Nombre d'œufs estimés" right={`${eggs} œufs`} />
        })()}

        <InputWithEcho value={eggTargetYolk} onChangeText={setEggTargetYolk} placeholder="Poids voulu Jaune (g)" echoLabel="Jaune (g)" />
        {(() => {
          const denom = (eggUnit || 0) * yolkPct
          const eggs = denom > 0 ? Math.ceil(num(eggTargetYolk) / denom) : 0
          return <Row left="Nombre d'œufs estimés" right={`${eggs} œufs`} />
        })()}

        {/* Nombre d'œufs → Poids (blanc, jaune, total) */}


    <InputWithEcho
      value={eggCount}
      onChangeText={setEggCount}
      placeholder="Nombre d'œufs (ex: 3)"
      echoLabel="Œufs"
    />

    {(() => {
      const n = num(eggCount) // nombre d'œufs
      const whiteW = n * (eggUnit || 0) * (whitePct || 0)
      const yolkW  = n * (eggUnit || 0) * (yolkPct  || 0)
      const totalW = whiteW + yolkW

      return (
        <>
          <Row left="Poids Blancs" right={fmtAllUnits(whiteW)} />
          <Row left="Poids Jaunes" right={fmtAllUnits(yolkW)} />
          <Row left="Poids Blanc+Jaune" right={fmtAllUnits(totalW)} />
        </>
      )
    })()}

      </View>
      
    )
  }

// ✅ NEW signature: on peut masquer la molette et forcer le targetId
function GenericConversions({
  d,
  showGear,            // ← désormais OPTIONNEL, et caché par défaut
  forceTargetId,
}: {
  d: Item
  showGear?: boolean
  forceTargetId?: string
}) {
  // ——— États UI
  const [genWeightEpl, setGenWeightEpl] = React.useState('');
  const [genWeightNon, setGenWeightNon] = React.useState('');
  const [countNon,     setCountNon]     = React.useState('');

  // ——— Identifiant de stockage (normalisé)
  const targetId = forceTargetId ?? normalizeId(d.id || d.label || 'unknown');

  // ——— Overrides
  const { values: ov, reload, version } = useIngredientOverrides(targetId);

  // ——— Bandeau “Données personnalisées”
  const [hasUserOverrides, setHasUserOverrides] = React.useState(false);
  React.useEffect(() => {
    let mounted = true;
    hasOverrides(targetId).then(ok => { if (mounted) setHasUserOverrides(ok); });
    return () => { mounted = false; };
  }, [targetId, version]);

  // ——— Fusion des valeurs utiles
  const dd = mergeWithOverrides(d as any, ov, ['avg_unit_g', 'peeled_yield']);
  const avgNon = toNumMaybe(dd.avg_unit_g);
  const peelY  = getPeelYield(dd); // garde la logique multi-colonnes
  const avgEpl = (avgNon !== null && peelY) ? avgNon * peelY : null;

  // ——— Molette: cachée par défaut, visible seulement si showGear === true
  const showGearResolved = (showGear === true) && ENABLE_OVERRIDES;

  // ——— Specs pour l’éditeur
  const [showEditor, setShowEditor] = React.useState(false);

  return (
    <View style={st.section}>
      {/* Titre + (éventuelle) molette */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
        <Text style={[st.sTitle, { flex: 1 }]}>
          Quantité <Text style={st.arrow}>⇆</Text> Poids
        </Text>

        {showGearResolved && (
          <TouchableOpacity
            onPress={() => setShowEditor(true)}
            activeOpacity={0.9}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              borderWidth: 2,
              borderColor: '#FFB6F9',
              backgroundColor: '#FFE4F6',
            }}
          >
            <Text style={{ fontWeight: '900', color: '#FF4FA2' }}>⚙️</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Bandeau “Données personnalisées” — reste affiché même si la molette est cachée */}
      {hasUserOverrides && (
        <View
          style={{
            backgroundColor: '#FFF0F5',
            borderColor: '#FF4FA2',
            borderWidth: 1,
            borderRadius: 10,
            padding: 8,
            marginBottom: 8,
          }}
        >
          <Text style={{ color: '#FF4FA2', fontWeight: '700' }}>
            ⚠️ Données personnalisées
          </Text>
          <Text style={{ color: '#57324B', fontSize: 13 }}>
            Ces valeurs remplacent celles de base. Appuyez sur ⚙️ pour revoir ou réinitialiser.
          </Text>
        </View>
      )}

      {/* 1) Si on a un rendement → “Poids épluché (g)” → pièces estimées */}
      {peelY ? (
        <>
          <InputWithEcho
            value={genWeightEpl}
            onChangeText={setGenWeightEpl}
            placeholder="Poids épluché (g)"
            echoLabel="Épluché (g)"
          />
          {(() => {
            const unitRef = (avgEpl ?? 0);
            const pieces = unitRef > 0 ? Math.ceil(num(genWeightEpl) / unitRef) : 0;
            return <Row left="Nombre de pièces estimées" right={`${pieces} pièces`} />;
          })()}
        </>
      ) : (
        /* 1b) Sinon → champ générique “Poids (g)” */
        <>
          <InputWithEcho
            value={genWeightEpl}
            onChangeText={setGenWeightEpl}
            placeholder="Poids (g)"
            echoLabel="Poids (g)"
          />
          {(() => {
            const unitRef = (avgNon ?? 0);
            const pieces = unitRef > 0 ? Math.ceil(num(genWeightEpl) / unitRef) : 0;
            return <Row left="Nombre de pièces estimées" right={`${pieces} pièces`} />;
          })()}
        </>
      )}

      {/* 2) Poids non épluché → Nb pièces */}
      <InputWithEcho
        value={genWeightNon}
        onChangeText={setGenWeightNon}
        placeholder="Poids non épluché (g)"
        echoLabel="Non épluché (g)"
      />
      {(() => {
        const unitNon = avgNon ?? 0;
        const pieces = unitNon > 0 ? Math.ceil(num(genWeightNon) / unitNon) : 0;
        return <Row left="Nombre de pièces estimées" right={`${pieces} pièces`} />;
      })()}

      {/* 3) Nb pièces → Poids (non épl.) + Poids épluché si rendement */}
      <InputWithEcho
        value={countNon}
        onChangeText={setCountNon}
        placeholder="Pièces non épl. (ex: 3)"
        echoLabel="Pièces non épl."
      />
      <Row left="Poids non épluché" right={fmtAllUnits(num(countNon) * (avgNon ?? 0))} />
      {peelY ? (
        <Row left="Poids épluché" right={fmtAllUnits(num(countNon) * (avgNon ?? 0) * peelY)} />
      ) : null}

      {/* ÉDITEUR ⚙️ (monté uniquement si on a demandé showGear) */}
      {showGearResolved && (
        <ParamEditor
          targetId={targetId}
          base={d as any}
          specs={SPEC_GENERIC as any}
          visible={showEditor}
          onClose={() => setShowEditor(false)}
          onSaved={async () => {
            await reload();
            const ok = await hasOverrides(targetId);
            setHasUserOverrides(ok);
            setShowEditor(false);
          }}
          onReset={async () => {
            await reload();
            const ok = await hasOverrides(targetId);
            setHasUserOverrides(ok);
            setShowEditor(false);
          }}
        />
      )}
    </View>
  );
}


 function PotatoSection({ d, openInfo }: { d: Item; openInfo: (title: string, text: string) => void }) {
  const [pdtMethod, setPdtMethod] = useState<PdtMethod | null>(null);
  const [pdtSelected, setPdtSelected] = useState<any | null>(null);
  const [qtyEpl, setQtyEpl] = useState('');
  const [qtyNon, setQtyNon] = useState('');

  // Toutes les variétés de PDT
  const pdtVarieties = useMemo(
    () => (DB as any[]).filter(v => Number(v?.is_pdt) === 1),
    []
  );

  // --------- OVERRIDES — VARIÉTÉ ---------
  const varTargetId = normalizeId(pdtSelected?.id || pdtSelected?.label || 'pdt_variety');
  const { values: ovVar, reload: reloadVar, version: verVar } = useIngredientOverrides(varTargetId);
  const [showVarEditor, setShowVarEditor] = useState(false);
  const [hasVarOverrides, setHasVarOverrides] = useState(false);
  useEffect(() => {
    let mounted = true;
    hasOverrides(varTargetId).then(ok => { if (mounted) setHasVarOverrides(ok); });
    return () => { mounted = false; };
  }, [varTargetId, verVar]);

  // Var sélectionnée + overrides (champs spécifiques variété)
  const pdtVarOV = useMemo(() => {
    if (!pdtSelected) return null;
    return mergeWithOverrides(pdtSelected as any, ovVar, [
      'pdt_spcfc_wght',
      'pdt_spcfc_peel',
    ]);
  }, [pdtSelected, ovVar]);

  // dd = base + (variété + overrides) recopiée vers avg_unit_g / peeled_yield
  const dd: Item | null = useMemo(() => {
    if (!pdtVarOV) return null;
    const avgUnit =
      toNumMaybe(pdtVarOV.pdt_spcfc_wght) ??
      toNumMaybe(d.avg_unit_g) ?? null;
    const peelYVar =
      toNumMaybe(pdtVarOV.pdt_spcfc_peel) ??
      toNumMaybe(d.peeled_yield) ?? null;
    return {
      ...d,
      ...pdtVarOV,
      avg_unit_g: avgUnit,
      peeled_yield: peelYVar,
    } as Item;
  }, [d, pdtVarOV]);

  const avgNon = dd ? toNumMaybe(dd.avg_unit_g) : null;
  const peelY  = dd ? toNumMaybe(dd.peeled_yield) : null;
  const avgEpl = (avgNon !== null && peelY) ? avgNon * peelY : null;

  return (
    <View style={st.section}>
      {/* 1) Choisir un usage */}
      <Text style={st.sTitle}>Choisir un usage</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {PDT_METHODS.map(m => {
          const on = pdtMethod?.label === m.label;
          return (
            <TouchableOpacity
              key={m.label}
              onPress={() => setPdtMethod(prev => (prev?.label === m.label ? null : m))}
              activeOpacity={0.9}
              style={[st.pill, on && st.pillActive]}
            >
              <Text style={[st.pillText, on && st.pillTextOn]} numberOfLines={1}>
                {m.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 2) Variétés recommandées pour l’usage sélectionné */}
      {pdtMethod && (() => {
        const recos = pdtVarieties
          .map(v => ({ v, s: scoreFor(v, pdtMethod) }))
          .filter(x => x.s >= 1)
          .sort(
            (a, b) =>
              b.s - a.s ||
              String(a.v.label ?? a.v.pdt_variety ?? a.v.id)
                .localeCompare(String(b.v.label ?? b.v.pdt_variety ?? b.v.id), 'fr', { sensitivity: 'base' })
          );

        return (
          <View style={{ marginBottom: 12 }}>
            {recos.length === 0 ? (
              <Text style={{ color: '#666' }}>
                Aucune variété particulièrement recommandée pour {pdtMethod.label.toLowerCase()}.
              </Text>
            ) : (
              <View style={st.pillsWrap}>
                {recos.map(({ v, s }) => {
                  const name = String(v.label ?? v.pdt_variety ?? v.id);
                  const on = pdtSelected?.id === v.id;
                  return (
                    <TouchableOpacity
                      key={v.id}
                      onPress={() => setPdtSelected(prev => (prev?.id === v.id ? null : v))}
                      activeOpacity={0.9}
                      style={[st.pill, on && st.pillActive]}
                    >
                      {imgSrc(v.id) ? (
                        <Image
                          source={imgSrc(v.id)}
                          style={{ width: 18, height: 18, marginRight: 6, borderRadius: 4 }}
                        />
                      ) : null}
                      <Text style={[st.pillText, on && st.pillTextOn]} numberOfLines={1}>
                        {name}
                      </Text>
                      <Text style={[st.pillBadge, on && { color: '#fff' }]}>{starsFor(s)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        );
      })()}

      {/* 3) Choisir une variété — liste complète */}
      <Text style={[st.sTitle, { marginTop: 4, marginBottom: 6 }]}>Choisir une variété</Text>
      <View style={st.pillsWrap}>
        {pdtVarieties
          .map(v => ({ v, name: String(v.label ?? v.pdt_variety ?? v.id) }))
          .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }))
          .map(({ v, name }) => {
            const on = pdtSelected?.id === v.id;
            return (
              <TouchableOpacity
                key={v.id}
                onPress={() => setPdtSelected(prev => (prev?.id === v.id ? null : v))}
                activeOpacity={0.9}
                style={[st.pill, on && st.pillActive]}
              >
                {imgSrc(v.id) ? (
                  <Image
                    source={imgSrc(v.id)}
                    style={{ width: 18, height: 18, marginRight: 6, borderRadius: 4 }}
                  />
                ) : null}
                <Text style={[st.pillText, on && st.pillTextOn]} numberOfLines={1}>{name}</Text>
              </TouchableOpacity>
            );
          })}
      </View>

      {/* 4) Détails quand une variété est sélectionnée */}
      {pdtSelected && (
        <View style={{ marginTop: 12 }}>
          {!!pdtSelected.pdt_texture && (
            <Row left="Chair" right={String(pdtSelected.pdt_texture)} />
          )}

          {/* Usages de la variété — chips avec étoiles */}
          {(() => {
            const varUsages = PDT_METHODS
              .map(m => ({ m, s: scoreFor(pdtSelected, m) }))
              .filter(x => x.s >= 1)
              .sort((a, b) => b.s - a.s);

            return varUsages.length > 0 ? (
              <View style={[st.pillsWrap, { marginTop: 8 }]}>
                {varUsages.map(({ m, s }) => {
                  const on = pdtMethod?.label === m.label;
                  return (
                    <TouchableOpacity
                      key={m.label}
                      onPress={() => setPdtMethod(prev => (prev?.label === m.label ? null : m))}
                      activeOpacity={0.9}
                      style={[st.pill, on && st.pillActive]}
                    >
                      <Text style={[st.pillText, on && st.pillTextOn]} numberOfLines={1}>
                        {m.label}
                      </Text>
                      <Text style={[st.pillBadge, on && { color: '#fff' }]}>{starsFor(s)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null;
          })()}

          {/* ==== Infos clés (variété) + molette (unique) ==== */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 6 }}>
            <Text style={[st.sTitle, { flex: 1 }]}>Infos clés (variété)</Text>

            {ENABLE_OVERRIDES && (
              <TouchableOpacity
                onPress={() => setShowVarEditor(true)}
                activeOpacity={0.9}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 999,
                  borderWidth: 2,
                  borderColor: '#FFB6F9',
                  backgroundColor: '#FFE4F6',
                }}
              >
                <Text style={{ fontWeight: '900', color: '#FF4FA2' }}>⚙️</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Bandeau Données personnalisées (lié à la VARIÉTÉ) */}
          {hasVarOverrides && (
            <View
              style={{
                backgroundColor: '#FFF0F5',
                borderColor: '#FF4FA2',
                borderWidth: 1,
                borderRadius: 10,
                padding: 8,
                marginBottom: 6,
              }}
            >
              <Text style={{ color: '#FF4FA2', fontWeight: '700' }}>⚠️ Données personnalisées</Text>
              <Text style={{ color: '#57324B', fontSize: 13 }}>
                Ces valeurs remplacent celles de base. Appuyez sur ⚙️ pour revoir ou réinitialiser.
              </Text>
            </View>
          )}

          {/* Lignes d’infos */}
          {avgNon !== null && <Row left="Poids moyen (1 pièce)" right={`${fmt(avgNon)} g`} />}
          {peelY  !== null && <Row left="Taux d'épluchage" right={`×${fmt(peelY)}`} />}
          {avgEpl !== null && (
            <Row left="Poids épluché" right={`${fmt(avgEpl)} g`} />
          )}

          {/* Épluché ⇆ Non épluché — VARIÉTÉ */}
          {peelY !== null && (
            <View style={{ marginTop: 8 }}>
              <Text style={st.sTitle}>
                Épluché <Text style={st.arrow}>⇆</Text> Non épluché
              </Text>

              <InputWithEcho
                value={qtyEpl}
                onChangeText={setQtyEpl}
                placeholder="Quantité épluchée (g)"
                echoLabel="Épluchée (g)"
              />
              <Row left="Équiv. non épluché" right={fmtAllUnits(num(qtyEpl) / (peelY || 1))} />

              <InputWithEcho
                value={qtyNon}
                onChangeText={setQtyNon}
                placeholder="Quantité non épluchée (g)"
                echoLabel="Non épluchée (g)"
              />
              <Row left="Équiv. épluché" right={fmtAllUnits(num(qtyNon) * (peelY || 0))} />
            </View>
          )}

          {/* Quantité ⇆ Poids — pas de molette ici */}
          {avgNon !== null && (
            <GenericConversions
              d={dd as Item}
              showGear={false}
              forceTargetId={varTargetId}
            />
          )}

          {/* ParamEditor — VARIÉTÉ (spécifiques) */}
          {ENABLE_OVERRIDES && (
            <ParamEditor
              visible={showVarEditor}
              onClose={() => setShowVarEditor(false)}
              targetId={varTargetId}
              base={(pdtVarOV || pdtSelected) as any}
              specs={[
                { key: 'pdt_spcfc_wght', label: 'Poids moyen (1 pièce)', type: 'number', hint: 'g' },
                { key: 'pdt_spcfc_peel', label: 'Taux d’épluchage',      type: 'number', hint: 'ex: 0.85' },
              ] as any}
              onSaved={async () => {
                await reloadVar();
                const ok = await hasOverrides(varTargetId);
                setHasVarOverrides(ok);
                setShowVarEditor(false);
              }}
              onReset={async () => {
                await reloadVar();
                const ok = await hasOverrides(varTargetId);
                setHasVarOverrides(ok); // le bandeau disparaît s’il n’y a plus d’overrides
                setShowVarEditor(false);
              }}
            />
          )}
        </View>
      )}
    </View>
  );
}


  function PastaSection({ d, openInfo }: { d: Item; openInfo: (title: string, text: string) => void }) {
    const [showPastaUsages, setShowPastaUsages] = useState(false)
    const [pastaUsageSelId, setPastaUsageSelId] = useState<string | null>(null)
    const [pastaSelected, setPastaSelected] = useState<any | null>(null)

    const pastaVarieties = useMemo(() => {
      const hasAnyPst = (row: any) =>
        ['pst_lg', 'pst_shrt', 'pst_sml', 'pst_flf', 'pst_ovn'].some((k) => hasVal(row?.[k]))
      return (DB as any[]).filter(v => hasAnyPst(v))
    }, [])
    const pastaUsages = useMemo(() => {
      const rows = (DB as any[]).filter(r =>
        ['pfct_lg_pst','pfct_shrt_pst','pfct_sml_pst','pfct_flf_pst','pfct_ovn_pst'].some(k => hasVal(r?.[k]))
      )
      return rows.map(r => {
        const nums = [
          'pfct_lg_pst','pfct_shrt_pst','pfct_sml_pst','pfct_flf_pst','pfct_ovn_pst'
        ].map(k => firstInt(r?.[k])).filter((n): n is number => n !== null)
        const numMain = nums[0] ?? 0
        const flags = {
          lg: hasVal(r?.pfct_lg_pst),
          shrt: hasVal(r?.pfct_shrt_pst),
          sml: hasVal(r?.pfct_sml_pst),
          flf: hasVal(r?.pfct_flf_pst),
          ovn: hasVal(r?.pfct_ovn_pst),
        }
        const isGen = hasVal(r?.gnrc_sls)
        return { row: r, num: numMain, flags, isGen }
      }).filter(x => x.num > 0)
    }, [])

    const selectedUsage = useMemo(
      () => pastaUsages.find(u => u.row?.id === pastaUsageSelId) || null,
      [pastaUsages, pastaUsageSelId]
    )

    // 1) Infos clés eau/sel
    const hasPasta = toNumMaybe(d.psta_wter) !== null || toNumMaybe(d.psta_slt) !== null

    return (
      <View style={st.section}>
        {hasPasta && (
          <>
            <Text style={st.sTitle}>Infos clés</Text>
            <Row left="Pâtes réussies 🇮🇹" right="1 L d’eau + 10 g gros sel / 100 g pâtes" />
          </>
        )}

        {/* 2) Choisir un usage */}
        <View style={{ marginTop: 8, marginBottom: 6 }}>
          <TouchableOpacity
            onPress={() => { setShowPastaUsages(x => !x); if (!showPastaUsages) { setPastaUsageSelId(null); setPastaSelected(null) } }}
            style={[st.sizeBtn, showPastaUsages && st.sizeBtnOn]}
            activeOpacity={0.9}
          >
            <Text style={[st.sizeBtnText, showPastaUsages && st.sizeBtnTextOn]}>
              {showPastaUsages ? 'Masquer les usages' : 'Choisir un usage'}
            </Text>
          </TouchableOpacity>
        </View>

        {showPastaUsages && (() => {
          const rows = pastaUsages
          if (rows.length === 0) {
            return <Text style={{ color: '#666' }}>Aucun usage configuré.</Text>
          }

          // Regroupement par numéro
          const groups: Record<number, typeof rows> = {}
          for (const u of rows) groups[u.num] = groups[u.num] ? [...groups[u.num], u] : [u]
          const nums = Object.keys(groups).map(n => Number(n)).sort((a, b) => a - b)

          // Mode "sélectionné" : 1 seul usage visible
          if (pastaUsageSelId) {
            const u = rows.find(x => x.row.id === pastaUsageSelId)!
            const n = u.num
            const color = PALETTE9[(n - 1) % PALETTE9.length]
            const text = u.row.label || `Usage ${n}`
            const infoTxt = infoTextFor(u.row, u.num).trim()
            const showInfo = !!infoTxt

            return (
              <View style={st.pillsWrap}>
                <TouchableOpacity
                  key={u.row.id}
                  activeOpacity={0.9}
                  onPress={() => setPastaUsageSelId(null)}
                  style={[st.pill, { borderColor: color, backgroundColor: color }]}
                >
                  {imgSrc(u.row.id) ? <Image source={imgSrc(u.row.id)} style={{ width: 18, height: 18, marginRight: 6, borderRadius: 4 }} /> : null}
                  <Text
                    style={[
                      st.pillText,
                      { color: '#fff', fontWeight: u.isGen ? '900' : '800', fontSize: u.isGen ? 16 : 14 }
                    ]}
                    numberOfLines={1}
                  >
                    {text}
                  </Text>
                  <InfoButton
                    tint={color}
                    variant="light"
                    disabled={!showInfo}
                    onPress={() => openInfo(text, infoTxt || 'Pas d’information supplémentaire.')}
                  />
                </TouchableOpacity>
              </View>
            )
          }

          // Mode "liste complète"
          return (
            <View style={st.pillsWrap}>
              {nums.map(n => {
                const color = PALETTE9[(n - 1) % PALETTE9.length]
                const arr = groups[n].slice().sort((a, b) => (b.isGen ? 1 : 0) - (a.isGen ? 1 : 0)) // générique d'abord
                return arr.map(u => {
                  const text = u.row.label || `Usage ${n}`
                  const infoTxt = infoTextFor(u.row, u.num).trim()
                  const showInfo = !!infoTxt
                  return (
                    <TouchableOpacity
                      key={u.row.id}
                      activeOpacity={0.9}
                      onPress={() => setPastaUsageSelId(prev => prev === u.row.id ? null : u.row.id)}
                      style={[st.pill, { borderColor: color, backgroundColor: '#FFE4F6' }]}
                    >
                      {imgSrc(u.row.id) ? <Image source={imgSrc(u.row.id)} style={{ width: 18, height: 18, marginRight: 6, borderRadius: 4 }} /> : null}
                      <Text
                        style={[
                          st.pillText,
                          { color: color, fontWeight: u.isGen ? '900' : '800', fontSize: u.isGen ? 16 : 14 }
                        ]}
                        numberOfLines={1}
                      >
                        {text}
                      </Text>
                      <InfoButton
                        tint={color}
                        variant="solid"
                        disabled={!showInfo}
                        onPress={() => openInfo(text, infoTxt || 'Pas d’information supplémentaire.')}
                      />
                    </TouchableOpacity>
                  )
                })
              })}
            </View>
          )
        })()}

        {/* VARIÉTÉS compatibles POUR L’USAGE SÉLECTIONNÉ */}
        {selectedUsage && (() => {
          const flags = selectedUsage.flags
          const typesMatching = [
            flags.lg   ? 'pst_lg'   : null,
            flags.shrt ? 'pst_shrt' : null,
            flags.sml  ? 'pst_sml'  : null,
            flags.flf  ? 'pst_flf'  : null,
            flags.ovn  ? 'pst_ovn'  : null,
          ].filter(Boolean) as string[]

          const list = pastaVarieties
            .filter(row => typesMatching.some(pst => hasVal(row?.[pst])))
            .map(v => ({ v, name: String(v.label ?? v.pasta_variety ?? v.id) }))
            .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }))

          return (
            <View style={{ marginTop: 8 }}>
              <Text style={[st.sTitle, { marginBottom: 6 }]}>Variétés compatibles (usage sélectionné)</Text>
              {list.length === 0 ? (
                <Text style={{ color: '#666' }}>Aucune variété trouvée.</Text>
              ) : (
                <View style={st.pillsWrap}>
                  {list.map(({ v, name }) => {
                    const on = pastaSelected?.id === v.id
                    return (
                      <TouchableOpacity key={v.id} activeOpacity={0.9} style={[st.pill, on && st.pillActive]} onPress={() => setPastaSelected(v)}>
                        {imgSrc(v.id) ? <Image source={imgSrc(v.id)} style={{ width: 18, height: 18, marginRight: 6, borderRadius: 4 }} /> : null}
                        <Text style={[st.pillText, on && st.pillTextOn]} numberOfLines={1}>{name}</Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              )}
            </View>
          )
        })()}

        {/* 3) Choisir une variété — TOUTES */}
        <Text style={[st.sTitle, { marginBottom: 6, marginTop: 8 }]}>Choisir une variété</Text>
        {(() => {
          const allList = pastaVarieties
            .map(v => ({ v, name: String(v.label ?? v.pasta_variety ?? v.id) }))
            .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }))

          return (
            <>
              <View style={st.pillsWrap}>
                {allList.map(({ v, name }) => {
                  const on = pastaSelected?.id === v.id
                  return (
                    <TouchableOpacity key={v.id} activeOpacity={0.9} style={[st.pill, on && st.pillActive]} onPress={() => setPastaSelected(v)}>
                      {imgSrc(v.id) ? <Image source={imgSrc(v.id)} style={{ width: 18, height: 18, marginRight: 6, borderRadius: 4 }} /> : null}
                      <Text style={[st.pillText, on && st.pillTextOn]} numberOfLines={1}>{name}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>

              {/* Détail variété → usages compatibles */}
              {pastaSelected && (() => {
                const enabledTypes = PASTA_TYPES.filter(t => hasVal(pastaSelected?.[t.pst]))
                if (enabledTypes.length === 0) return null

                const compat = pastaUsages.filter(u =>
                  (u.flags.lg   && enabledTypes.some(t => t.pst === 'pst_lg'))   ||
                  (u.flags.shrt && enabledTypes.some(t => t.pst === 'pst_shrt')) ||
                  (u.flags.sml  && enabledTypes.some(t => t.pst === 'pst_sml'))  ||
                  (u.flags.flf  && enabledTypes.some(t => t.pst === 'pst_flf'))  ||
                  (u.flags.ovn  && enabledTypes.some(t => t.pst === 'pst_ovn'))
                )

                if (compat.length === 0) return null

                const ordered = compat
                  .slice()
                  .sort((a, b) => (a.num - b.num) || ((b.isGen?1:0) - (a.isGen?1:0)))

                return (
                  <View style={{ marginTop: 10 }}>
                    <Text style={[st.sTitle, { marginBottom: 6 }]}>Usages compatibles</Text>
                    <View style={st.pillsWrap}>
                      {ordered.map(u => {
                        const color = PALETTE9[(u.num - 1) % PALETTE9.length]
                        const text = u.row.label || `Usage ${u.num}`
                        const infoTxt = infoTextFor(u.row, u.num).trim()
                        const showInfo = !!infoTxt
                        return (
                          <View key={`u-${u.row.id}`} style={[st.pill, { borderColor: color, backgroundColor: '#FFE4F6' }]}>
                            <Text style={[st.pillText, { color, fontWeight: u.isGen ? '900' : '800', fontSize: u.isGen ? 16 : 14 }]} numberOfLines={1}>
                              {text}
                            </Text>
                            <InfoButton
                              tint={color}
                              variant="solid"
                              disabled={!showInfo}
                              onPress={() => openInfo(text, infoTxt || 'Pas d’information supplémentaire.')}
                            />
                          </View>
                        )
                      })}
                    </View>
                  </View>
                )
              })()}
            </>
          )
        })()}
      </View>
    )
  }

  function TomatoSection({ d }: { d: Item }) {
    const [tomatoUsageSelKey, setTomatoUsageSelKey] =
      useState<null | typeof TOMATO_USAGES[number]['key']>(null)
    const [tomatoSelected, setTomatoSelected] = useState<any | null>(null)

    // Champs des convertisseurs
    const [tmtGenWeight, setTmtGenWeight] = useState('')
    const [tmtQtyEpl, setTmtQtyEpl] = useState('')
    const [tmtQtyNon, setTmtQtyNon] = useState('')
    const [tmtPiecesNon, setTmtPiecesNon] = useState('')

    const tomatoVarieties = useMemo(
      () => (DB as any[]).filter(v => hasVal(v?.is_tmt)),
      []
    )

    return (
      <View style={st.section}>
        {/* 1️⃣ Choisir un usage */}
        <Text style={st.sTitle}>Choisir un usage</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
          {TOMATO_USAGES.map(u => {
            const on = tomatoUsageSelKey === u.key
            return (
              <TouchableOpacity
                key={u.key}
                activeOpacity={0.9}
                onPress={() => {
                  setTomatoSelected(null)
                  setTomatoUsageSelKey(prev => (prev === u.key ? null : u.key))
                }}
                style={[st.sizeBtn, on && st.sizeBtnOn]}
              >
                <Text style={[st.sizeBtnText, on && st.sizeBtnTextOn]}>{u.label}</Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {/* Variétés correspondant à l’usage sélectionné (tri ★★★ → ★★ → ★) */}
        {tomatoUsageSelKey && (() => {
          const u = TOMATO_USAGES.find(x => x.key === tomatoUsageSelKey)!
          const list = tomatoVarieties
            .map(v => ({ v, s: firstInt(v?.[u.col]) ?? 0, name: String(v.label ?? v.id) }))
            .filter(x => x.s >= 1)
            .sort((a, b) => (b.s - a.s) || a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }))

          return (
            <View style={{ marginTop: 6 }}>
              {list.length === 0 ? (
                <Text style={{ color: '#666' }}>Aucune variété notée pour cet usage.</Text>
              ) : (
                <View style={st.pillsWrap}>
                  {list.map(({ v, s }) => {
                    const on = tomatoSelected?.id === v.id
                    return (
                      <TouchableOpacity
                        key={v.id}
                        activeOpacity={0.9}
                        style={[st.pill, on && st.pillActive]}
                        onPress={() => setTomatoSelected(prev => (prev?.id === v.id ? null : v))}
                      >
                        {imgSrc(v.id)
                          ? <Image source={imgSrc(v.id)} style={{ width: 18, height: 18, marginRight: 6, borderRadius: 4 }} />
                          : null}
                        <Text style={[st.pillText, on && st.pillTextOn]} numberOfLines={1}>
                          {String(v.label ?? v.id)}
                        </Text>
                        <Text style={[st.pillBadge, on && { color: '#fff' }]}>
                          {s >= 3 ? '★★★' : s === 2 ? '★★' : '★'}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              )}
            </View>
          )
        })()}

        {/* 2️⃣ Choisir une variété (toutes) */}
        <Text style={[st.sTitle, { marginTop: 8, marginBottom: 6 }]}>Choisir une variété</Text>
        {(() => {
          const all = tomatoVarieties
            .map(v => ({ v, name: String(v.label ?? v.id) }))
            .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }))
          return (
            <>
              <View style={st.pillsWrap}>
                {all.map(({ v, name }) => {
                  const on = tomatoSelected?.id === v.id
                  return (
                    <TouchableOpacity
                      key={v.id}
                      activeOpacity={0.9}
                      style={[st.pill, on && st.pillActive]}
                      onPress={() => setTomatoSelected(prev => (prev?.id === v.id ? null : v))}
                    >
                      {imgSrc(v.id)
                        ? <Image source={imgSrc(v.id)} style={{ width: 18, height: 18, marginRight: 6, borderRadius: 4 }} />
                        : null}
                      <Text style={[st.pillText, on && st.pillTextOn]} numberOfLines={1}>
                        {name}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>

              {/* DÉTAILS (variété sélectionnée OU générique) */}
              {(() => {
                // Si une variété est sélectionnée on fusionne ses champs
                const base: any = tomatoSelected ? { ...d, ...tomatoSelected } : d

                // Références de poids et rendement
                const avgNon = toNumMaybe(base.tmt_spcfc_wght) ?? toNumMaybe(base.avg_unit_g) ?? 0
                const peelY  = getPeelYield(base)
                const avgEpl = peelY ? avgNon * peelY : null

                // Métadonnées
                const famCol = TOMATO_FAMILIES.find(f => hasVal(base?.[f.col]))
                const family = famCol ? famCol.label : ''
                const taste  = String(base?.tmt_com ?? '').trim()

                // Usages (chips) à afficher SANS la phrase “Usages possibles”
                const usages = tomatoSelected
                  ? TOMATO_USAGES
                      .map(u => ({ u, s: firstInt(base?.[u.col]) ?? 0 }))
                      .filter(x => x.s >= 1)
                      .sort((a, b) => b.s - a.s)
                  : []

                return (
                  <View style={{ marginTop: 10 }}>
                    {/* Chips d’usages (sans titre) */}
                    {usages.length > 0 && (
                      <View style={[st.pillsWrap, { marginBottom: 12 }]}>
                        {usages.map(({ u, s }) => (
                          <View key={`tu-${u.key}`} style={st.pill}>
                            <Text style={st.pillText}>{u.label}</Text>
                            <Text style={st.pillBadge}>{s >= 3 ? '★★★' : s === 2 ? '★★' : '★'}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Infos clés — seulement après sélection d’une variété */}
                    {tomatoSelected && (
                      <>
                        <Text style={st.sTitle}>Infos clés</Text>
                        <Row left="Poids moyen (1 pièce)" right={`${fmt(avgNon)} g`} />
                        {avgEpl !== null && (
                          <Row
                            left="Poids épluché (tomate équeutée et époinçonnée, non pelée)"
                            right={`${fmt(avgEpl)} g`}
                          />
                        )}
                        {!!family && <Row left="Famille" right={family} />}
                        {!!taste && <Row left="Goût" right={taste} />}
                      </>
                    )}

                    {/* Convertisseurs (avec poids/rendement corrects) */}
                    {tomatoSelected && (() => {
                      const dd = {
                        ...base,
                        avg_unit_g: (avgNon || null),
                        peeled_yield: (peelY ?? null),
                      } as Item
                      return <GenericConversions d={dd} />
                    })()}

                    {/* Épluché ⇆ Non épluché */}
                    {tomatoSelected && peelY ? (
                      <View style={st.section}>
                        <Text style={st.sTitle}>
                          Épluché <Text style={st.arrow}>⇆</Text> Non épluché
                          <Text>{' '}(Tomate équeutée et époinçonnée, non pelée)</Text>
                        </Text>

                        <InputWithEcho
                          value={tmtQtyEpl}
                          onChangeText={setTmtQtyEpl}
                          placeholder="Quantité épluchée (g)"
                          echoLabel="Épluchée (g)"
                        />
                        <Row left="Équiv. non épluché" right={fmtAllUnits(num(tmtQtyEpl) / peelY)} />

                        <InputWithEcho
                          value={tmtQtyNon}
                          onChangeText={setTmtQtyNon}
                          placeholder="Quantité non épluchée (g)"
                          echoLabel="Non épluchée (g)"
                        />
                        <Row left="Équiv. épluché" right={fmtAllUnits(num(tmtQtyNon) * peelY)} />
                      </View>
                    ) : null}
                  </View>
                )
              })()}
            </>
          )
        })()}
      </View>
    )
  }


  function OnionSection({ d }: { d: Item }) {
    const [onionUsageSelKey, setOnionUsageSelKey] =
      useState<null | typeof ONION_USAGES[number]['key']>(null)
    const [onionSelected, setOnionSelected] = useState<any | null>(null)

    // Pour les conversions quand une variété est sélectionnée
    const [qtyEpl, setQtyEpl] = useState('')
    const [qtyNon, setQtyNon] = useState('')

    // Variétés d’oignons présentes dans la DB
    const onionVarieties = useMemo(
      () => (DB as any[]).filter(v => hasVal(v?.is_onn)),
      []
    )

    return (
      <View style={st.section}>
        {/* 1️⃣ Choisir un usage */}
        <Text style={st.sTitle}>Choisir un usage</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
          {ONION_USAGES.map(u => {
            const on = onionUsageSelKey === u.key
            return (
              <TouchableOpacity
                key={u.key}
                activeOpacity={0.9}
                onPress={() => {
                  // toggle + on réinitialise la variété sélectionnée
                  setOnionSelected(null)
                  setOnionUsageSelKey(prev => (prev === u.key ? null : u.key))
                }}
                style={[st.sizeBtn, on && st.sizeBtnOn]}
              >
                <Text style={[st.sizeBtnText, on && st.sizeBtnTextOn]}>{u.label}</Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {/* Variétés correspondant à l’usage sélectionné (chips, tri décroissant par score) */}
        {onionUsageSelKey && (() => {
          const usage = ONION_USAGES.find(u => u.key === onionUsageSelKey)!
          const list = onionVarieties
            .map(v => ({
              v,
              s: firstInt(v?.[usage.col]) ?? 0,
              name: String(v.label ?? v.id),
            }))
            .filter(x => x.s >= 1)
            .sort(
              (a, b) =>
                b.s - a.s ||
                a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' })
            )

          return list.length > 0 ? (
            <View style={st.pillsWrap}>
              {list.map(({ v, s, name }) => {
                const on = onionSelected?.id === v.id
                return (
                  <TouchableOpacity
                    key={v.id}
                    onPress={() => setOnionSelected(prev => (prev?.id === v.id ? null : v))}
                    activeOpacity={0.9}
                    style={[st.pill, on && st.pillActive]}
                  >
                    {imgSrc(v.id) && (
                      <Image
                        source={imgSrc(v.id)}
                        style={{ width: 18, height: 18, marginRight: 6, borderRadius: 4 }}
                      />
                    )}
                    <Text style={[st.pillText, on && st.pillTextOn]} numberOfLines={1}>
                      {name}
                    </Text>
                    <Text style={[st.pillBadge, on && { color: '#fff' }]}>{starsFor(s)}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          ) : (
            <Text style={{ color: '#666' }}>
              Aucune variété d’oignon référencée pour {usage.label.toLowerCase()}.
            </Text>
          )
        })()}

        {/* 2️⃣ Choisir une variété (toutes) */}
        <Text style={[st.sTitle, { marginTop: 12, marginBottom: 6 }]}>
          Choisir une variété
        </Text>
        {(() => {
          const all = onionVarieties
            .map(v => ({ v, name: String(v.label ?? v.id) }))
            .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }))

          return (
            <View style={st.pillsWrap}>
              {all.map(({ v, name }) => {
                const on = onionSelected?.id === v.id
                return (
                  <TouchableOpacity
                    key={v.id}
                    onPress={() => setOnionSelected(prev => (prev?.id === v.id ? null : v))}
                    activeOpacity={0.9}
                    style={[st.pill, on && st.pillActive]}
                  >
                    {imgSrc(v.id) && (
                      <Image
                        source={imgSrc(v.id)}
                        style={{ width: 18, height: 18, marginRight: 6, borderRadius: 4 }}
                      />
                    )}
                    <Text style={[st.pillText, on && st.pillTextOn]} numberOfLines={1}>
                      {name}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          )
        })()}

        {/* 3️⃣ Détails de la variété sélectionnée */}
        {onionSelected && (
          <View style={{ marginTop: 10 }}>
            {/* Usages sous forme de chips (plus de "Usages possibles") */}
            <View style={[st.pillsWrap, { marginTop: 4 }]}>
              {ONION_USAGES.map(u => {
                const s = firstInt(onionSelected?.[u.col]) ?? 0
                if (s < 1) return null
                const on = onionUsageSelKey === u.key
                return (
                  <TouchableOpacity
                    key={u.key}
                    onPress={() =>
                      setOnionUsageSelKey(prev => (prev === u.key ? null : u.key))
                    }
                    activeOpacity={0.9}
                    style={[st.pill, on && st.pillActive]}
                  >
                    <Text style={[st.pillText, on && st.pillTextOn]} numberOfLines={1}>
                      {u.label}
                    </Text>
                    <Text style={[st.pillBadge, on && { color: '#fff' }]}>{starsFor(s)}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            {/* === Bloc infos + conversions spécifiques (si données dispo) === */}
            {(() => {
              // Spécifiques variété -> générique item -> nul
              const avgNon =
                toNumMaybe(onionSelected.onn_spcfc_wght) ??
                toNumMaybe(d.avg_unit_g) ??
                null
              const peelY =
                toNumMaybe(onionSelected.onn_spcfc_peel) ??
                toNumMaybe(d.peeled_yield) ??
                null
              const avgEpl = (avgNon !== null && peelY)
                ? avgNon * peelY
                : null

              if (avgNon === null && peelY === null) return null

              return (
                <View style={{ marginTop: 12 }}>
                  <Text style={st.sTitle}>Infos clés (variété)</Text>
                  {avgNon !== null && (
                    <Row left="Poids moyen (1 pièce)" right={`${fmt(avgNon)} g`} />
                  )}
                  {peelY !== null && (
                    <Row left="Taux d'épluchage" right={`×${fmt(peelY)}`} />
                  )}
                  {avgEpl !== null && (
                    <Row
                      left={`Poids épluché ${peeledLabelFor(d.id || d.label || '')}`}
                      right={`${fmt(avgEpl)} g`}
                    />
                  )}

                  {/* Épluché ⇆ Non épluché */}
                  {peelY !== null && (
                    <View style={[st.section, { marginTop: 10 }]}>
                      <Text style={st.sTitle}>
                        Épluché <Text style={st.arrow}>⇆</Text> Non épluché{' '}
                        <Text>{peeledLabelFor(d.id || d.label || '')}</Text>
                      </Text>
                      <InputWithEcho
                        value={qtyEpl}
                        onChangeText={setQtyEpl}
                        placeholder="Quantité épluchée (g)"
                        echoLabel="Épluchée (g)"
                      />
                      <Row
                        left="Équiv. non épluché"
                        right={fmtAllUnits(num(qtyEpl) / (peelY || 1))}
                      />
                      <InputWithEcho
                        value={qtyNon}
                        onChangeText={setQtyNon}
                        placeholder="Quantité non épluchée (g)"
                        echoLabel="Non épluchée (g)"
                      />
                      <Row
                        left="Équiv. épluché"
                        right={fmtAllUnits(num(qtyNon) * (peelY || 0))}
                      />
                    </View>
                  )}

                  {/* Quantité ⇆ Poids avec la moyenne (variété si dispo) */}
                  {toNumMaybe(avgNon) !== null && (
                    <GenericConversions
                      d={{
                        ...d,
                        ...onionSelected,
                        avg_unit_g: avgNon,
                        peeled_yield: peelY ?? d.peeled_yield ?? null,
                      }}
                    />
                  )}
                </View>
              )
            })()}
          </View>
        )}
      </View>
    )
  }


function CelerySection({ d }: { d: Item }) {
  const [celeryBranches, setCeleryBranches] = useState('')
  const [celeryWeight, setCeleryWeight] = useState('')
  const celeryG = toNumMaybe(d.clr_lgth) ?? 0

  return (
    <View style={st.section}>
      <Text style={st.sTitle}>Infos clés</Text>
      <Row left="1 branche de céleri" right={`${fmt(celeryG)} g`} />

      <Text style={[st.sTitle, { marginTop: 8 }]}>
        Nombre de branches <Text style={st.arrow}>⇆</Text> Poids
      </Text>
      <InputWithEcho
        value={celeryBranches}
        onChangeText={setCeleryBranches}
        placeholder="Nb de branches (ex: 2)"
        echoLabel="Branches"
      />
      <Row left="Poids estimé" right={fmtAllUnits(num(celeryBranches) * celeryG)} />

      <InputWithEcho
        value={celeryWeight}
        onChangeText={setCeleryWeight}
        placeholder="Poids (ex: 200 g)"
        echoLabel="Poids (g)"
      />
      <Row
        left="Nombre de branches estimé"
        right={`${Math.ceil(num(celeryWeight) / Math.max(1, celeryG))} branches`}
      />
    </View>
  )
}

function JuiceSection({ d }: { d: Item }) {
  const [weightG, setWeightG] = useState('');
  const [pieces, setPieces]   = useState('');
  const [volOrWeight, setVolOrWeight] = useState('');

  // — Détection "orange" (pour n’impacter que cet ingrédient)
  const normId = (d.id || d.label || '')
    .toString()
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
  const isOrange = normId.includes('orange');

  const perG   = toNumPos(d.juice_ml_per_g);
  const avgG   = toNumPos(d.avg_unit_g);
  const perUnit = juicePerUnitMl(d); // = avg_unit_g * juice_ml_per_g si dispo, sinon juice_ml_per_unit

  // Calculs pour les barres 1 et 2
  const volFromWeight = perG ? juiceFromWeightMl(num(weightG), d) : null;
  const volFromPieces = perUnit != null ? (num(pieces) * perUnit) : null;

  // Barre 3 — Volume ou poids voulu (ml ou g)
  const volOrW = num(volOrWeight);
  let estWeight: number | null = null;
  let estPieces: number | null = null;

  if (volOrW && perG) {
    // Heuristique: si > 1000 on suppose que c’est un poids (g)
    if (volOrW > 1000 && avgG) {
      estWeight = volOrW;
      estPieces = avgG ? estWeight / avgG : null;
    } else {
      estWeight = volOrW / perG;
      estPieces = avgG ? estWeight / avgG : null;
    }
  } else if (volOrW && perUnit) {
    estPieces = volOrW / perUnit;
    estWeight = avgG && estPieces ? estPieces * avgG : null;
  }

  return (
    <View style={st.section}>
      <Text style={st.sTitle}>Quantité <Text style={st.arrow}>⇆</Text> Jus</Text>

      {/* Barre 1 — Poids -> Volume estimé */}
      {perG && (
        <>
          <InputWithEcho
            value={weightG}
            onChangeText={setWeightG}
            placeholder={isOrange ? 'Poids (g)' : `Poids du ${String(d.label || 'produit')} (g)`}
            echoLabel={isOrange ? 'Poids (g)' : 'Poids (g)'}
          />
          <Row left="Volume estimé" right={fmtVolAllUnits(volFromWeight ?? 0)} />
        </>
      )}

      {/* Barre 2 — N pièces -> Volume estimé */}
      {perUnit != null && (
        <>
          <InputWithEcho
            value={pieces}
            onChangeText={setPieces}
            placeholder={isOrange ? 'Nombre de pièces (ex: 3)' : 'Nombre de pièces (poids inconnu)'}
            echoLabel="Pièces"
          />
          <Row left="Volume estimé" right={fmtVolAllUnits(volFromPieces ?? 0)} />
        </>
      )}

      {/* Barre 3 — Volume ou poids voulu (ml ou g) */}
      <InputWithEcho
        value={volOrWeight}
        onChangeText={setVolOrWeight}
        placeholder="Volume ou poids voulu (ml ou g)"
        echoLabel="Entrée"
      />
      <Row left="Poids estimé" right={`${fmt(estWeight)} g`} />
      {(() => {
  const piecesCeil =
    estPieces != null && isFinite(estPieces) ? Math.ceil(estPieces) : null;
  return (
    <Row
      left="Nombre de pièces estimé"
      right={piecesCeil != null ? `${piecesCeil} pièces` : '—'}
    />
  );
})()}

    </View>
  );
}


function LengthWeightSection({ d }: { d: Item }) {
  const [lengthCm, setLengthCm] = useState('')
  const [lenWeightG, setLenWeightG] = useState('')

  return (
    <View style={st.section}>
      <Text style={st.sTitle}>Taille <Text style={st.arrow}>⇆</Text> Poids</Text>
      <InputWithEcho
        value={lengthCm}
        onChangeText={setLengthCm}
        placeholder="Longueur (cm)"
        echoLabel="Longueur (cm)"
      />
      <Row left="Poids estimé" right={`${fmt(num(lengthCm) * (d.lgth_g || 0))} g`} />

      <InputWithEcho
        value={lenWeightG}
        onChangeText={setLenWeightG}
        placeholder="Poids (g)"
        echoLabel="Poids (g)"
      />
      <Row left="Longueur estimée" right={`${fmt(num(lenWeightG) / Math.max(1, (d.lgth_g || 1)))} cm`} />
    </View>
  )
}

function SpoonsSection({ d }: { d: Item }) {
  const [tsp, setTsp] = useState('')
  const [tbsp, setTbsp] = useState('')
  const [weightToSpoons, setWeightToSpoons] = useState('')

  const tsp_g = d.tsp_g ?? (d.tbsp_g ? d.tbsp_g / 3 : null)
  const tbsp_g = d.tbsp_g ?? (tsp_g ? tsp_g * 3 : null)

  return (
    <View style={st.section}>
      <Text style={st.sTitle}>Cuillères <Text style={st.arrow}>⇆</Text> Poids</Text>
      <InputWithEcho value={tsp} onChangeText={setTsp} placeholder="Cuillères à café (ex: 2)" echoLabel="c. à café" />
      <Row left="Poids" right={fmtAllUnits(num(tsp) * (tsp_g || 0))} />
      <InputWithEcho value={tbsp} onChangeText={setTbsp} placeholder="Cuillères à soupe (ex: 2)" echoLabel="c. à soupe" />
      <Row left="Poids" right={fmtAllUnits(num(tbsp) * (tbsp_g || 0))} />
      <InputWithEcho value={weightToSpoons} onChangeText={setWeightToSpoons} placeholder="Poids (g) — ex: 15" echoLabel="Poids (g)" />
      <Row
        left="Équivalent"
        right={`${tsp_g ? `${fmt(num(weightToSpoons) / tsp_g, 2)} c. à café` : '— c. à café'}   |   ${tbsp_g ? `${fmt(num(weightToSpoons) / tbsp_g, 2)} c. à soupe` : '— c. à soupe'}`}
      />
    </View>
  )
}

function PastaWaterSaltSection({ d }: { d: Item }) {
  const [pastaG, setPastaG] = useState('')

  // Stockage normalisé attendu :
  // - d.psta_wter : L d’eau / g de pâtes   (ex : 0.01  => 1 L pour 100 g)
  // - d.psta_slt  : g de sel / L d’eau     (ex : 10    => 10 g par litre)
  const waterPerGram = toNumMaybe(d.psta_wter) ?? 0     // L/g
  const saltPerLiter = toNumMaybe(d.psta_slt)  ?? 0     // g/L

  const g = num(pastaG)
  const L = g * waterPerGram                          // litres d’eau
  const cl = L * 10
  const ml = L * 1000

  // ✅ Sel basé sur le volume d’eau (g/L), plus JAMAIS sur les g de pâtes
  const saltG = L * saltPerLiter                      // grammes de sel

  // Valeurs "infos clés" affichables si tu veux (optionnel) :
  // - eau UI = L / 100 g => waterPerGram * 100
  // - sel UI = g / L     => saltPerLiter (identité)

  return (
    <View style={st.section}>
      <Text style={[st.sTitle, { marginTop: 8 }]}>
        Pâtes <Text style={st.arrow}>⇆</Text> Eau & Sel
      </Text>

      <InputWithEcho
        value={pastaG}
        onChangeText={setPastaG}
        placeholder="Qtité de pâtes (g)"
        echoLabel="Pâtes (g)"
      />

      <Row left="Quantité d'eau" right={`${fmt(L, 3)} l  |  ${fmt(cl, 1)} cl  |  ${fmt(ml, 0)} ml`} />
      <Row left="Quantité de sel" right={fmtAllUnits(saltG)} />
    </View>
  )
}


function ChickenSection({ d }: { d: Item }) {
  const [selectedVar, setSelectedVar] = useState<any | null>(null)
  const [weight, setWeight] = useState('')

  // Liste des variétés de volaille dans le CSV
  const chickenVarieties = useMemo(() => (DB as any[]).filter(v => hasVal(v?.is_chckn)), [])

  const w = num(weight)
  const cookTime = selectedVar && w >= 400
    ? w / 100 * (toNumMaybe(selectedVar.chckn_tme) ?? 0)
    : null

  return (
    <View style={st.section}>
      {/* 1️⃣ Infos clés */}
      <Text style={st.sTitle}>Infos clés</Text>
      <Text style={{ color: '#57324B', fontWeight: '600', marginBottom: 10 }}>
        Les températures et temps de cuisson sont donnés à titre indicatif. 
        Il est impératif de surveiller la cuisson. 
        La meilleure méthode pour la cuisson des volailles reste l'utilisation d'un thermomètre de cuisson.
      </Text>

      {/* 2️⃣ Choix de la variété */}
      <Text style={[st.sTitle, { marginBottom: 6 }]}>Choisir une variété</Text>
      <View style={st.pillsWrap}>
        {chickenVarieties.map(v => {
          const on = selectedVar?.id === v.id
          const name = String(v.label ?? v.id)
          return (
            <TouchableOpacity
              key={v.id}
              onPress={() => setSelectedVar(v)}
              activeOpacity={0.9}
              style={[st.pill, on && st.pillActive]}
            >
              {imgSrc(v.id) ? (
                <Image source={imgSrc(v.id)} style={{ width: 18, height: 18, marginRight: 6, borderRadius: 4 }} />
              ) : null}
              <Text style={[st.pillText, on && st.pillTextOn]} numberOfLines={1}>{name}</Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {/* 3️⃣ Affichage infos de la variété sélectionnée */}
      {selectedVar && (
        <View style={{ marginTop: 10 }}>
          <Row left="Température du four" right={`${selectedVar.chckn_tp ?? '—'} °C`} />

          <InputWithEcho
            value={weight}
            onChangeText={setWeight}
            placeholder="Poids label (g)"
            echoLabel="Poids (g)"
          />

          {cookTime !== null && (
            <Row left="Temps de cuisson estimé" right={`${fmt(cookTime)} min`} />
          )}
        </View>
      )}
    </View>
  )
}

function SpicesSection({ d }: { d: Item }) {
  const [selectedSpice, setSelectedSpice] = useState<any | null>(null)
  const [tsp, setTsp] = useState('')
  const [tbsp, setTbsp] = useState('')
  const [weightToSpoons, setWeightToSpoons] = useState('')

  // ⚠️ NE GARDER QUE LES ÉPICES (is_spc = 1/true/x/oui/yes)
  const spices = useMemo(
    () => (DB as any[]).filter(v => isTrue(v?.is_spc)),
    []
  )

  // Poids d’1 c. à soupe pour l’épice sélectionnée (spc_tbsp_g)
  const tbsp_g = selectedSpice ? (toNumMaybe(selectedSpice.spc_tbsp_g) ?? null) : null
  const tsp_g  = tbsp_g ? (tbsp_g / 3) : null

  return (
    <View style={st.section}>
      <Text style={st.sTitle}>Choisir une épice</Text>

      {/* Liste des épices en puces */}
      <View style={st.pillsWrap}>
        {spices
          .map(v => ({ v, name: String(v.label ?? v.id) }))
          .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }))
          .map(({ v, name }) => {
            const on = selectedSpice?.id === v.id
            return (
              <TouchableOpacity
                key={v.id}
                activeOpacity={0.9}
                onPress={() => setSelectedSpice(v)}
                style={[st.pill, on && st.pillActive]}
              >
                {imgSrc(v.id) ? (
                  <Image source={imgSrc(v.id)} style={{ width: 18, height: 18, marginRight: 6, borderRadius: 4 }} />
                ) : null}
                <Text style={[st.pillText, on && st.pillTextOn]} numberOfLines={1}>{name}</Text>
              </TouchableOpacity>
            )
          })}
      </View>

      {/* Conversion Cuillères ⇆ Poids */}
      {selectedSpice && (
        <View style={{ marginTop: 10 }}>
          <Text style={st.sTitle}>Cuillères <Text style={st.arrow}>⇆</Text> Poids</Text>

          <InputWithEcho
            value={tsp}
            onChangeText={setTsp}
            placeholder="Cuillères à café (ex: 2)"
            echoLabel="c. à café"
          />
          <Row left="Poids" right={fmtAllUnits(num(tsp) * (tsp_g || 0))} />

          <InputWithEcho
            value={tbsp}
            onChangeText={setTbsp}
            placeholder="Cuillères à soupe (ex: 2)"
            echoLabel="c. à soupe"
          />
          <Row left="Poids" right={fmtAllUnits(num(tbsp) * (tbsp_g || 0))} />

          <InputWithEcho
            value={weightToSpoons}
            onChangeText={setWeightToSpoons}
            placeholder="Poids (g) — ex: 15"
            echoLabel="Poids (g)"
          />
          <Row
            left="Équivalent"
            right={`${tsp_g ? `${fmt(num(weightToSpoons) / tsp_g, 2)} c. à café` : '— c. à café'}   |   ${tbsp_g ? `${fmt(num(weightToSpoons) / tbsp_g, 2)} c. à soupe` : '— c. à soupe'}`}
          />

          <View style={st.tipBox}>
            <Text style={st.tipText}>
              Référence pour <Text style={st.tipStrong}>{String(selectedSpice.label ?? selectedSpice.id)}</Text> :
              1 c. à soupe ≈ <Text style={st.tipStrong}>{tbsp_g ? fmt(tbsp_g) : '—'} g</Text>
              {tsp_g ? ` • 1 c. à café ≈ ${fmt(tsp_g)} g` : ''}
            </Text>
          </View>
        </View>
      )}
    </View>
  )
}

function CabbageSection({ d }: { d: Item }) {
  const [selected, setSelected] = useState<any | null>(null)

  // Toutes les variétés où la colonne is_choux est remplie
  const cabbageVarieties = useMemo(
    () => (DB as any[]).filter(v => hasVal(v?.is_choux)),
    []
  )

  // On fusionne les données génériques (d) et celles de la variété (selected)
  // pour alimenter les convertisseurs avec les valeurs spécifiques si dispo
  const dd = useMemo(() => {
    if (!selected) return d
    // priorité aux valeurs de la variété si elles existent
    return { ...d, ...selected } as Item
  }, [d, selected])

  // Petites infos clés utiles
  const avgNon = toNumMaybe(dd.avg_unit_g)
  const peelY  = toNumMaybe(dd.peeled_yield)
  const avgEpl = (avgNon !== null && peelY) ? avgNon * peelY : null

  return (
    <View style={st.section}>
      {/* 1️⃣ Choisir une variété */}
      <Text style={st.sTitle}>Choisir une variété</Text>
      <View style={st.pillsWrap}>
        {cabbageVarieties
          .map(v => ({ v, name: String(v.label ?? v.id) }))
          .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }))
          .map(({ v, name }) => {
            const on = selected?.id === v.id
            return (
              <TouchableOpacity
                key={v.id}
                activeOpacity={0.9}
                onPress={() => setSelected(v)}
                style={[st.pill, on && st.pillActive]}
              >
                {imgSrc(v.id) ? (
                  <Image
                    source={imgSrc(v.id)}
                    style={{ width: 18, height: 18, marginRight: 6, borderRadius: 4 }}
                  />
                ) : null}
                <Text style={[st.pillText, on && st.pillTextOn]} numberOfLines={1}>
                  {name}
                </Text>
              </TouchableOpacity>
            )
          })}
      </View>

      {/* 2️⃣ Détails de la variété sélectionnée */}
      {selected && (
        <View style={{ marginTop: 10 }}>
          {/* Infos clés */}
          <Text style={st.sTitle}>Infos clés</Text>
          {avgNon !== null && <Row left="Poids moyen (1 pièce)" right={`${fmt(avgNon)} g`} />}
          {avgEpl !== null && (
            <Row
              left="Poids épluché (préparation standard)"
              right={`${fmt(avgEpl)} g`}
            />
          )}

          {/* 3️⃣ Convertisseurs adaptés à la variété */}
          {/* Quantité ⇆ Poids, pièces, etc. */}
          {(toNumMaybe(dd.avg_unit_g) !== null) && (
            <GenericConversions d={dd} />
          )}

          {/* Jus (si la variété en a – au cas où certaines entrées contiennent du jus) */}
          {toNumMaybe(dd.juice_ml_per_unit) !== null ? <JuiceSection d={dd} /> : null}

          {/* Taille ⇆ Poids */}
          {toNumMaybe(dd.lgth_g) !== null ? <LengthWeightSection d={dd} /> : null}

          {/* Cuillères ⇆ Poids */}
          {(toNumMaybe(dd.tbsp_g) !== null || toNumMaybe(dd.tsp_g) !== null) ? (
            <SpoonsSection d={dd} />
          ) : null}
        </View>
      )}
    </View>
  )
}

function AppleSection({ d }: { d: Item }) {
  const [qtyEpl, setQtyEpl] = useState('');
  const [qtyNon, setQtyNon] = useState('');
  const [appleSelected, setAppleSelected] = useState<any | null>(null);
  const [usageSel, setUsageSel] = useState<null | 'crck' | 'pie' | 'cpt'>(null);
  const [mode, setMode] = useState<'sgr' | 'acd' | null>(null);

  // Variétés de pommes
  const appleVarieties = useMemo(
    () => (DB as any[]).filter(v => isTrue(v?.is_appl)),
    []
  );

  // Rendement générique (si aucune variété choisie)
  const peelYGeneric = getPeelYield(d);

  // Utils
  const star5 = (n: number | null) => {
    const v = n ?? 0;
    if (v <= 0) return '—';
    const r = Math.max(0, Math.min(5, Math.round(v)));
    return '★'.repeat(r);
  };
  const scoreFrom = (row: any, col: string): number => firstInt(row?.[col]) ?? 0;

  // --------- OVERRIDES — VARIÉTÉ ---------
  // id stable pour lier le bandeau “Données personnalisées” + ParamEditor + GenericConversions
  const varTargetId = normalizeId(appleSelected?.id || appleSelected?.label || 'apple_variety');
  const { values: ovVar, reload: reloadVar, version: verVar } = useIngredientOverrides(varTargetId);

  const [showVarEditor, setShowVarEditor] = useState(false);
  const [hasVarOverrides, setHasVarOverrides] = useState(false);
  useEffect(() => {
    let mounted = true;
    hasOverrides(varTargetId).then(ok => { if (mounted) setHasVarOverrides(ok) });
    return () => { mounted = false };
  }, [varTargetId, verVar]);

  // Var sélectionnée + overrides (uniquement champs spécifiques variété)
  const appleVarOV = useMemo(() => {
    if (!appleSelected) return null;
    return mergeWithOverrides(appleSelected as any, ovVar, [
      'appl_spcfc_wght',
      'appl_spcfc_peel',
    ]);
  }, [appleSelected, ovVar]);

  // dd = base d + (variété + overrides) recopiée vers avg_unit_g / peeled_yield
  const dd: Item | null = useMemo(() => {
    if (!appleVarOV) return null;
    const avgUnit =
      toNumMaybe((appleVarOV as any).appl_spcfc_wght) ??
      toNumMaybe(d.avg_unit_g) ?? null;
    const peelYVar =
      toNumMaybe((appleVarOV as any).appl_spcfc_peel) ??
      toNumMaybe(d.peeled_yield) ?? null;

    return {
      ...d,
      ...appleVarOV,
      avg_unit_g: avgUnit,
      peeled_yield: peelYVar,
    } as Item;
  }, [d, appleVarOV]);

  // Valeurs calculées (quand une variété est sélectionnée)
  const avgNon = dd ? toNumMaybe(dd.avg_unit_g) : null;
  const peelY  = dd ? toNumMaybe(dd.peeled_yield) : null;
  const avgEpl = (avgNon !== null && peelY) ? avgNon * peelY : null;

  // robustesse: comparaison de variétés par id/label
  const sameVariety = (a: any, b: any) =>
    String(a?.id ?? a?.label ?? '') === String(b?.id ?? b?.label ?? '');

  return (
    <View style={st.section}>
      {/* ✅ PAS d’“Infos clés” générique ici → évite le doublon avec IngredientCard */}

      {/* Épluché ⇆ Non épluché (GÉNÉRIQUE) — montré seulement si AUCUNE variété n’est sélectionnée */}
      {!appleSelected && peelYGeneric !== null && Number.isFinite(peelYGeneric) && (
        <View style={st.section}>
          <Text style={st.sTitle}>
            Épluché <Text style={st.arrow}>⇆</Text> Non épluché{' '}
            <Text>{peeledLabelFor(d.id || d.label || '')}</Text>
          </Text>

          <InputWithEcho
            value={qtyEpl}
            onChangeText={setQtyEpl}
            placeholder="Quantité épluchée (g)"
            echoLabel="Épluchée (g)"
          />
          <Row left="Équiv. non épluché" right={fmtAllUnits(num(qtyEpl) / peelYGeneric)} />

          <InputWithEcho
            value={qtyNon}
            onChangeText={setQtyNon}
            placeholder="Quantité non épluchée (g)"
            echoLabel="Non épluchée (g)"
          />
          <Row left="Équiv. épluché" right={fmtAllUnits(num(qtyNon) * peelYGeneric)} />
        </View>
      )}

      {/* 1) Choisir un usage */}
      <Text style={[st.sTitle, { marginTop: 16 }]}>Choisir un usage</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        {[
          { key: 'crck' as const, label: 'Cru (croquant)', col: 'appl_crck' },
          { key: 'pie'  as const, label: 'Tarte',          col: 'appl_pie'  },
          { key: 'cpt'  as const, label: 'Compote',        col: 'appl_cpt'  },
        ].map(u => {
          const on = usageSel === u.key;
          return (
            <TouchableOpacity
              key={u.key}
              onPress={() => setUsageSel(prev => (prev === u.key ? null : u.key))}
              style={[st.pill, on && st.pillActive]}
              activeOpacity={0.9}
            >
              <Text style={[st.pillText, on && st.pillTextOn]}>{u.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 2) Variétés compatibles pour l’usage sélectionné */}
      {usageSel && (() => {
        const col = usageSel === 'crck' ? 'appl_crck' : usageSel === 'pie' ? 'appl_pie' : 'appl_cpt';
        const list = appleVarieties
          .map(v => ({ v, s: scoreFrom(v, col), name: String(v.label ?? v.id) }))
          .filter(x => x.s > 0)
          .sort((a, b) => b.s - a.s || a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));

        if (list.length === 0) {
          return <Text style={{ color: '#666', marginBottom: 8 }}>Aucune variété notée pour cet usage.</Text>;
        }

        return (
          <View style={st.pillsWrap}>
            {list.map(({ v, s, name }) => {
              const on = appleSelected && sameVariety(appleSelected, v);
              return (
                <TouchableOpacity
                  key={v.id}
                  onPress={() => setAppleSelected(prev => (prev && sameVariety(prev, v) ? null : v))}
                  activeOpacity={0.9}
                  style={[st.pill, on && st.pillActive]}
                >
                  {imgSrc(v.id) ? (
                    <Image
                      source={imgSrc(v.id)}
                      style={{ width: 18, height: 18, marginRight: 6, borderRadius: 4 }}
                    />
                  ) : null}
                  <Text style={[st.pillText, on && st.pillTextOn]} numberOfLines={1}>{name}</Text>
                  <Text style={st.pillBadge}>{star5(s)}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
        )
      })()}

      {/* 3) Choisir une variété (liste complète) */}
      <Text style={[st.sTitle, { marginTop: 16, marginBottom: 6 }]}>Choisir une variété</Text>
      <View style={st.pillsWrap}>
        {appleVarieties
          .map(v => ({ v, name: String(v.label ?? v.id) }))
          .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }))
          .map(({ v, name }) => {
            const on = appleSelected && sameVariety(appleSelected, v);
            return (
              <TouchableOpacity
                key={v.id}
                onPress={() => setAppleSelected(prev => (prev && sameVariety(prev, v) ? null : v))}
                activeOpacity={0.9}
                style={[st.pill, on && st.pillActive]}
              >
                {imgSrc(v.id) ? (
                  <Image
                    source={imgSrc(v.id)}
                    style={{ width: 18, height: 18, marginRight: 6, borderRadius: 4 }}
                  />
                ) : null}
                <Text style={[st.pillText, on && st.pillTextOn]} numberOfLines={1}>{name}</Text>
              </TouchableOpacity>
            );
          })}
      </View>

      {/* 4) Quand une variété est sélectionnée : usages + infos + convertisseurs */}
      {appleSelected && dd && (
        <View style={{ marginTop: 12 }}>
          {/* Usages de la variété — chips avec étoiles (pas de titre) */}
          {(() => {
            const varietyUsages = [
              { key: 'crck' as const,  label: 'Cru (croquant)', col: 'appl_crck' },
              { key: 'pie'  as const,  label: 'Tarte',          col: 'appl_pie'  },
              { key: 'cpt'  as const,  label: 'Compote',        col: 'appl_cpt'  },
            ]
              .map(u => ({ ...u, s: firstInt((appleVarOV as any)?.[u.col]) ?? 0 }))
              .filter(x => x.s > 0)
              .sort((a, b) => b.s - a.s);

            return varietyUsages.length > 0 ? (
              <View style={st.pillsWrap}>
                {varietyUsages.map(({ key, label, s }) => {
                  const on = usageSel === key;
                  return (
                    <TouchableOpacity
                      key={key}
                      onPress={() => setUsageSel(prev => (prev === key ? null : key))}
                      activeOpacity={0.9}
                      style={[st.pill, on && st.pillActive]}
                    >
                      <Text style={[st.pillText, on && st.pillTextOn]} numberOfLines={1}>
                        {label}
                      </Text>
                      <Text style={st.pillBadge}>{star5(s)}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            ) : null;
          })()}

          {/* ==== Infos clés (variété) + molette ==== */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 6 }}>
            <Text style={[st.sTitle, { flex: 1 }]}>Infos clés (variété)</Text>

            {ENABLE_OVERRIDES && (
              <TouchableOpacity
                onPress={() => setShowVarEditor(true)}
                activeOpacity={0.9}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 999,
                  borderWidth: 2,
                  borderColor: '#FFB6F9',
                  backgroundColor: '#FFE4F6',
                }}
              >
                <Text style={{ fontWeight: '900', color: '#FF4FA2' }}>⚙️</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Bandeau Données personnalisées (lié à la VARIÉTÉ) */}
          {hasVarOverrides && (
            <View
              style={{
                backgroundColor: '#FFF0F5',
                borderColor: '#FF4FA2',
                borderWidth: 1,
                borderRadius: 10,
                padding: 8,
                marginBottom: 6,
              }}
            >
              <Text style={{ color: '#FF4FA2', fontWeight: '700' }}>⚠️ Données personnalisées</Text>
              <Text style={{ color: '#57324B', fontSize: 13 }}>
                Ces valeurs remplacent celles de base. Appuyez sur ⚙️ pour revoir ou réinitialiser.
              </Text>
            </View>
          )}

          {/* Lignes d’infos — précision en (parenthèses) sur la GAUCHE */}
          {avgNon !== null && <Row left="Poids moyen (1 pièce)" right={`${fmt(avgNon)} g`} />}
          {peelY  !== null && (
            <Row
              left={`Taux d'épluchage ${peeledLabelFor(d.id || d.label || '')}`}
              right={`×${fmt(peelY)}`}
            />
          )}
          {avgEpl !== null && (
            <Row
              left={`Poids épluché ${peeledLabelFor(d.id || d.label || '')}`}
              right={`${fmt(avgEpl)} g`}
            />
          )}

          {/* Épluché ⇆ Non épluché — VARIÉTÉ */}
          {peelY !== null && (
            <View style={{ marginTop: 8 }}>
              <Text style={st.sTitle}>
                Épluché <Text style={st.arrow}>⇆</Text> Non épluché <Text>{peeledLabelFor(d.id || d.label || '')}</Text>
              </Text>

              <InputWithEcho
                value={qtyEpl}
                onChangeText={setQtyEpl}
                placeholder="Quantité épluchée (g)"
                echoLabel="Épluchée (g)"
              />
              <Row left="Équiv. non épluché" right={fmtAllUnits(num(qtyEpl) / (peelY || 1))} />

              <InputWithEcho
                value={qtyNon}
                onChangeText={setQtyNon}
                placeholder="Quantité non épluchée (g)"
                echoLabel="Non épluchée (g)"
              />
              <Row left="Équiv. épluché" right={fmtAllUnits(num(qtyNon) * (peelY || 0))} />
            </View>
          )}

          {/* Quantité ⇆ Poids — pas de molette, mais bandeau lié à la VARIÉTÉ */}
          {avgNon !== null && (
            <GenericConversions
              d={dd}
              showGear={false}
              forceTargetId={varTargetId}
            />
          )}

          {/* ParamEditor — VARIÉTÉ (spécifiques) */}
          {ENABLE_OVERRIDES && (
  <ParamEditor
    visible={showVarEditor}
    onClose={() => setShowVarEditor(false)}
    targetId={varTargetId}
    base={(appleVarOV || appleSelected) as any}
    specs={[
      { key: 'appl_spcfc_wght', label: 'Poids moyen (1 pièce)', type: 'number', hint: 'g' },
      { key: 'appl_spcfc_peel', label: 'Taux d’épluchage',      type: 'number', hint: 'ex: 0.85' },
    ] as any}
    onSaved={async () => {
      await reloadVar();
      const ok = await hasOverrides(varTargetId);
      setHasVarOverrides(ok);
      setShowVarEditor(false);
    }}
    onReset={async () => {
      await reloadVar();
      const ok = await hasOverrides(varTargetId);
      setHasVarOverrides(ok);
      setShowVarEditor(false);
    }}
  />
)}
f
        </View>
      )}

      {/* 5) Classements sucré/acidulé (inchangé) */}
      <Text style={[st.sTitle, { marginTop: 16 }]}>Classement</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
        {[
          { key: 'sgr' as const, label: 'Sucré' },
          { key: 'acd' as const, label: 'Acidulé' },
        ].map(b => {
          const on = mode === b.key;
          return (
            <TouchableOpacity
              key={b.key}
              onPress={() => setMode(prev => (prev === b.key ? null : b.key))}
              style={[st.pill, on && st.pillActive]}
              activeOpacity={0.9}
            >
              <Text style={[st.pillText, on && st.pillTextOn]}>{b.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {mode === 'sgr' && (
        <View style={{ marginBottom: 6 }}>
          {appleVarieties
            .map(v => ({
              v,
              sugar: scoreFrom(v, 'appl_sgr'),
              acid:  scoreFrom(v, 'appl_acd'),
              name:  String(v.label ?? v.id),
            }))
            .filter(x => x.sugar > 0 || x.acid > 0)
            .sort((a, b) => b.sugar - a.sugar || a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }))
            .map(({ v, sugar, acid, name }) => (
              <Row key={v.id} left={name} right={`Sucré ${star5(sugar)}  Acidité ${star5(acid)}`} />
            ))}
        </View>
      )}

      {mode === 'acd' && (
        <View style={{ marginBottom: 6 }}>
          {appleVarieties
            .map(v => ({
              v,
              sugar: scoreFrom(v, 'appl_sgr'),
              acid:  scoreFrom(v, 'appl_acd'),
              name:  String(v.label ?? v.id),
            }))
            .filter(x => x.sugar > 0 || x.acid > 0)
            .sort((a, b) => b.acid - a.acid || a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }))
            .map(({ v, sugar, acid, name }) => (
              <Row key={v.id} left={name} right={`Acidité ${star5(acid)}  Sucré ${star5(sugar)}`} />
            ))}
        </View>
      )}
    </View>
  );
}


function CheeseSection({ d }: { d: Item }) {
  const [cheeseSelected, setCheeseSelected] = useState<any | null>(null)

  // filtres actifs
  const [selectedFamily, setSelectedFamily] = useState<string | null>(null)
  const [selectedMilk, setSelectedMilk] = useState<string | null>(null)
  const [selectedCroute, setSelectedCroute] = useState<string | null>(null)
  const [selectedOrigin, setSelectedOrigin] = useState<string | null>(null)

  const cheeseVarieties = useMemo(() => (DB as any[]).filter(v => hasVal(v?.is_cheese)), [])

  const allFamilies = Array.from(new Set(cheeseVarieties.map(v => v.fmly_cheese).filter(Boolean)))
  const allMilks = Array.from(new Set(cheeseVarieties.map(v => v.milk_cheese).filter(Boolean)))
  const allCroutes = Array.from(new Set(cheeseVarieties.map(v => v.croute_cheese).filter(Boolean)))
  const allOrigins = Array.from(new Set(cheeseVarieties.map(v => v.origin_cheese).filter(Boolean)))

  return (
    <View style={st.section}>
      {/* 1. Choisir une variété (liste complète en haut) */}
      <Text style={st.sTitle}>Choisir une variété</Text>
      <View style={st.pillsWrap}>
        {cheeseVarieties.map(v => {
          const on = cheeseSelected?.id === v.id
          return (
            <TouchableOpacity
              key={v.id}
              onPress={() => setCheeseSelected(v)}
              activeOpacity={0.9}
              style={[st.pill, on && st.pillActive]}
            >
              <Text style={[st.pillText, on && st.pillTextOn]}>{v.label}</Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {/* 2. Détails si variété sélectionnée */}
      {cheeseSelected && (
        <View style={{ marginTop: 12 }}>
          <Text style={st.tipText}>
            Variété : <Text style={st.tipStrong}>{cheeseSelected.label ?? cheeseSelected.id}</Text>
          </Text>
          <Row left="Nature du lait" right={cheeseSelected.milk_cheese ?? '—'} />
          <Row left="Type de pâte" right={cheeseSelected.fmly_cheese ?? '—'} />
          <Row left="Type de croûte" right={cheeseSelected.croute_cheese ?? '—'} />
          <Row left="Région d'origine" right={cheeseSelected.origin_cheese ?? '—'} />
          <Row left="AOP" right={cheeseSelected.aop_cheese ?? '—'} />
        </View>
      )}

      {/* 3. Choisir un type de pâte */}
      <Text style={[st.sTitle, { marginTop: 16 }]}>Choisir un type de pâte</Text>
      <View style={st.pillsWrap}>
        {allFamilies.map(f => {
          const on = selectedFamily === f
          return (
            <TouchableOpacity
              key={f}
              onPress={() => setSelectedFamily(on ? null : f)}
              activeOpacity={0.9}
              style={[st.pill, on && st.pillActive]}
            >
              <Text style={[st.pillText, on && st.pillTextOn]}>{f}</Text>
            </TouchableOpacity>
          )
        })}
      </View>
      {selectedFamily && (
        <View style={st.pillsWrap}>
          {cheeseVarieties
            .filter(v => v.fmly_cheese === selectedFamily)
            .map(v => (
              <TouchableOpacity
                key={v.id}
                onPress={() => setCheeseSelected(v)}
                activeOpacity={0.9}
                style={[
                  st.pill,
                  st.pillFiltered,
                  cheeseSelected?.id === v.id && st.pillActive,
                ]}
              >
                <Text style={st.pillText}>{v.label}</Text>
              </TouchableOpacity>
            ))}
        </View>
      )}

      {/* 4. Choisir une nature de lait */}
      <Text style={[st.sTitle, { marginTop: 16 }]}>Choisir une nature de lait</Text>
      <View style={st.pillsWrap}>
        {allMilks.map(m => {
          const on = selectedMilk === m
          return (
            <TouchableOpacity
              key={m}
              onPress={() => setSelectedMilk(on ? null : m)}
              activeOpacity={0.9}
              style={[st.pill, on && st.pillActive]}
            >
              <Text style={[st.pillText, on && st.pillTextOn]}>{m}</Text>
            </TouchableOpacity>
          )
        })}
      </View>
      {selectedMilk && (
        <View style={st.pillsWrap}>
          {cheeseVarieties
            .filter(v => v.milk_cheese === selectedMilk)
            .map(v => (
              <TouchableOpacity
                key={v.id}
                onPress={() => setCheeseSelected(v)}
                activeOpacity={0.9}
                style={[
                  st.pill,
                  st.pillFiltered,
                  cheeseSelected?.id === v.id && st.pillActive,
                ]}
              >
                <Text style={st.pillText}>{v.label}</Text>
              </TouchableOpacity>
            ))}
        </View>
      )}

      {/* 5. Choisir un type de croûte */}
      <Text style={[st.sTitle, { marginTop: 16 }]}>Choisir un type de croûte</Text>
      <View style={st.pillsWrap}>
        {allCroutes.map(c => {
          const on = selectedCroute === c
          return (
            <TouchableOpacity
              key={c}
              onPress={() => setSelectedCroute(on ? null : c)}
              activeOpacity={0.9}
              style={[st.pill, on && st.pillActive]}
            >
              <Text style={[st.pillText, on && st.pillTextOn]}>{c}</Text>
            </TouchableOpacity>
          )
        })}
      </View>
      {selectedCroute && (
        <View style={st.pillsWrap}>
          {cheeseVarieties
            .filter(v => v.croute_cheese === selectedCroute)
            .map(v => (
              <TouchableOpacity
                key={v.id}
                onPress={() => setCheeseSelected(v)}
                activeOpacity={0.9}
                style={[
                  st.pill,
                  st.pillFiltered,
                  cheeseSelected?.id === v.id && st.pillActive,
                ]}
              >
                <Text style={st.pillText}>{v.label}</Text>
              </TouchableOpacity>
            ))}
        </View>
      )}

      {/* 6. Choisir une région */}
      <Text style={[st.sTitle, { marginTop: 16 }]}>Choisir une région</Text>
      <View style={st.pillsWrap}>
        {allOrigins.map(o => {
          const on = selectedOrigin === o
          return (
            <TouchableOpacity
              key={o}
              onPress={() => setSelectedOrigin(on ? null : o)}
              activeOpacity={0.9}
              style={[st.pill, on && st.pillActive]}
            >
              <Text style={[st.pillText, on && st.pillTextOn]}>{o}</Text>
            </TouchableOpacity>
          )
        })}
      </View>
      {selectedOrigin && (
        <View style={st.pillsWrap}>
          {cheeseVarieties
            .filter(v => v.origin_cheese === selectedOrigin)
            .map(v => (
              <TouchableOpacity
                key={v.id}
                onPress={() => setCheeseSelected(v)}
                activeOpacity={0.9}
                style={[
                  st.pill,
                  st.pillFiltered,
                  cheeseSelected?.id === v.id && st.pillActive,
                ]}
              >
                <Text style={st.pillText}>{v.label}</Text>
              </TouchableOpacity>
            ))}
        </View>
      )}
    </View>
  )
}

function GarlicSection({ d }: { d: Item }) {
  // États UI
  const [qtyEpl, setQtyEpl] = React.useState('');
  const [qtyNon, setQtyNon] = React.useState('');
  const [genWeightEpl, setGenWeightEpl] = React.useState('');
  const [genWeightNon, setGenWeightNon] = React.useState('');
  const [countNon, setCountNon] = React.useState('');

  // Données
  const peelY  = getPeelYield(d);               // rendement (si dispo)
  const avgNon = toNumMaybe(d.avg_unit_g);      // poids moyen 1 gousse non épl.
  const avgEpl = (avgNon !== null && peelY) ? avgNon * peelY : null; // poids moyen 1 gousse épl.

  // 1) Bloc Épluché ⇆ Non épluché (si on a un rendement)
  const renderPeeledBlock = () => {
    if (!peelY) return null;
    const nonFromEpl = num(qtyEpl) / peelY;
    const eplFromNon = num(qtyNon) * peelY;

    return (
      <View style={st.section}>
        <Text style={st.sTitle}>
          Épluché <Text style={st.arrow}>⇆</Text> Non épluché
          <Text>{' '}(Gousse pelée et dégermée)</Text>
        </Text>

        <InputWithEcho
          value={qtyEpl}
          onChangeText={setQtyEpl}
          placeholder="Quantité épluchée (g)"
          echoLabel="Épluchée (g)"
        />
        <Row left="Équiv. non épluché" right={fmtAllUnits(nonFromEpl)} />

        <InputWithEcho
          value={qtyNon}
          onChangeText={setQtyNon}
          placeholder="Quantité non épluchée (g)"
          echoLabel="Non épluchée (g)"
        />
        <Row left="Équiv. épluché" right={fmtAllUnits(eplFromNon)} />
      </View>
    );
  };

  // 2) Bloc Quantité ⇆ Poids (libellés adaptés au cas "gousses")
  const renderQuantityWeight = () => {
    if (avgNon === null && avgEpl === null) return null;

    return (
      <View style={st.section}>
        <Text style={st.sTitle}>Quantité <Text style={st.arrow}>⇆</Text> Poids</Text>

        {/* 2.1 — Poids épluché → Nb de gousses */}
        <InputWithEcho
          value={genWeightEpl}
          onChangeText={setGenWeightEpl}
          placeholder="Poids épluché (g)"
          echoLabel="Épluché (g)"
        />
        {(() => {
          const unitRef = (avgEpl ?? avgNon ?? 0); // si pas de peelY, on retombe sur avgNon
          const pieces = unitRef > 0 ? Math.ceil(num(genWeightEpl) / unitRef) : 0;
          return <Row left="Nombre de gousses estimé" right={`${pieces} gousses`} />;
        })()}

        {/* 2.2 — Poids non épluché → Nb de gousses */}
        <InputWithEcho
          value={genWeightNon}
          onChangeText={setGenWeightNon}
          placeholder="Poids non épluché (g)"
          echoLabel="Non épluché (g)"
        />
        {(() => {
          const unitNon = avgNon ?? 0;
          const pieces = unitNon > 0 ? Math.ceil(num(genWeightNon) / unitNon) : 0;
          return <Row left="Nombre de gousses estimé" right={`${pieces} gousses`} />;
        })()}

        {/* 2.3 — Nb de gousses → poids (non épl., + épl. si rendement) */}
        <InputWithEcho
          value={countNon}
          onChangeText={setCountNon}
          placeholder="Gousses non épl. (ex: 3)"
          echoLabel="Gousses non épl."
        />
        <Row
          left="Poids non épluché"
          right={fmtAllUnits(num(countNon) * (avgNon ?? 0))}
        />
        {peelY ? (
          <Row
            left="Poids épluché"
            right={fmtAllUnits(num(countNon) * (avgNon ?? 0) * peelY)}
          />
        ) : null}
      </View>
    );
  };

  return (
    <View style={st.section}>
      {/* 1) Épluché ⇆ Non épluché */}
      {renderPeeledBlock()}

      {/* 2) Quantité ⇆ Poids */}
      {renderQuantityWeight()}
    </View>
  );
}

function CoffeeSection({ d }: { d: Item }) {
  // ───────── UI state
  const [selectedUsage, setSelectedUsage] = useState<any | null>(null);
  const [intensity, setIntensity] = useState<'lght' | 'strng' | 'intense'>('lght');
  const [cups, setCups] = useState('');
  const [grams, setGrams] = useState('');
  const [tbsp, setTbsp] = useState('');
  const [weightToSpoons, setWeightToSpoons] = useState('');

  // ───────── Overrides (molette) — 1 seule molette pour “café”
  const coffeeTargetId = normalizeId(d.id || d.label || 'coffee');
  const { values: coffeeOV, reload: reloadCoffeeOV, version: coffeeOVVer } =
    useIngredientOverrides(coffeeTargetId);
  const [showCoffeeEditor, setShowCoffeeEditor] = useState(false);
  const [hasCoffeeOverrides, setHasCoffeeOverrides] = useState(false);
  useEffect(() => {
    let mounted = true;
    hasOverrides(coffeeTargetId).then(ok => { if (mounted) setHasCoffeeOverrides(ok); });
    return () => { mounted = false; };
  }, [coffeeTargetId, coffeeOVVer]);

  // ───────── Usages depuis le CSV (is_coffee_use “truthy”)
  const coffeeUsages = useMemo(
    () => (DB as any[]).filter(row => isTrue(row?.is_coffee_use)),
    []
  );

  // ───────── Fusion des données pour l’AFFICHAGE :
  // priorité aux overrides -> puis à la ligne d’usage sélectionnée -> puis à la ligne “café” d’origine
  const dBase = useMemo(
    () => mergeWithOverrides(d as any, coffeeOV, [
      // volumes tasse
      'coffee_cup_ml','coffee_cup_cl','cup_ml','cup_cl',
      // dosages
      'coffee_g_per_cl_lght','coffee_g_per_cl_light','coffee_g_cl_doux',
      'coffee_g_per_cl_strng','coffee_g_per_cl_strong','coffee_g_cl_corse',
      'coffee_g_per_cl_intense','coffee_g_cl_intense',
      // cuillère à soupe
      'coffee_spcfc_tbsp_g','coffee_tbsp_g','tbsp_g_coffee',
      // divers
      'coffee_mouture','coffee_tmp','coffee_tme',
    ]) as Item,
    [d, coffeeOV]
  );

  // si un usage est choisi, on lui permet d’overrider les champs d’affichage
  const dEff = useMemo(() => ({ ...dBase, ...(selectedUsage || {}) }) as Item, [dBase, selectedUsage]);

  // ───────── Helpers robustes
  const pickNum = (obj: any, keys: string[], map?: (n: number)=>number): number | null => {
    for (const k of keys) {
      const v = toNumMaybe(obj?.[k]);
      if (v != null) return map ? map(v) : v;
    }
    return null;
  };
  const pickStr = (obj: any, keys: string[]): string => {
    for (const k of keys) {
      const s = String(obj?.[k] ?? '').trim();
      if (s) return s;
    }
    return '';
  };
  const fmtOrDash = (n: number | null) => (n == null || !Number.isFinite(n) || n <= 0 ? '—' : fmt(n));

  // ───────── Lecture valeurs (avec alias)
  const cupMl = pickNum(dEff, ['coffee_cup_ml','cup_ml']) ?? pickNum(dEff, ['coffee_cup_cl','cup_cl'], cl => cl*10) ?? 0;
  const cupCl = cupMl / 10;

  const doseLght   = pickNum(dEff, ['coffee_g_per_cl_lght','coffee_g_per_cl_light','coffee_g_cl_doux']) ?? 0;
  const doseStrng  = pickNum(dEff, ['coffee_g_per_cl_strng','coffee_g_per_cl_strong','coffee_g_cl_corse']) ?? 0;
  const doseIntens = pickNum(dEff, ['coffee_g_per_cl_intense','coffee_g_cl_intense']) ?? 0;

  const tbsp_g = pickNum(dEff, ['coffee_spcfc_tbsp_g','coffee_tbsp_g','tbsp_g_coffee']);
  const moutureTxt = pickStr(dEff, ['coffee_mouture']);
  const tempC      = pickNum(dEff, ['coffee_tmp']);
  const timeMin    = pickNum(dEff, ['coffee_tme']);

  const dosePerCl =
    intensity === 'lght'  ? doseLght
    : intensity === 'strng' ? doseStrng
    : doseIntens;

  const gramsPerCup = (dosePerCl || 0) * (cupCl || 0);

  // ───────── UI
  const INTENSITIES = [
    { key: 'lght' as const,   label: 'Doux'    },
    { key: 'strng' as const,  label: 'Corsé'   },
    { key: 'intense' as const,label: 'Intense' },
  ];

  return (
    <View style={st.section}>
      {/* 1) Choisir un usage — dynamiques depuis le CSV */}
      <Text style={st.sTitle}>Choisir un usage</Text>
      <View style={st.pillsWrap}>
        {coffeeUsages
          .map(u => ({ u, name: String(u.label ?? u.id ?? 'Usage') }))
          .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }))
          .map(({ u, name }) => {
            const on = selectedUsage?.id === u.id;
            return (
              <TouchableOpacity
                key={u.id}
                onPress={() => setSelectedUsage(prev => (prev?.id === u.id ? null : u))}
                activeOpacity={0.9}
                style={[st.pill, on && st.pillActive]}
              >
                {imgSrc(u.id) ? (
                  <Image source={imgSrc(u.id)} style={{ width: 18, height: 18, marginRight: 6, borderRadius: 4 }} />
                ) : null}
                <Text style={[st.pillText, on && st.pillTextOn]} numberOfLines={1}>{name}</Text>
              </TouchableOpacity>
            );
          })}
        {coffeeUsages.length === 0 && (
          <Text style={{ color: '#666' }}>Aucun usage café trouvé (is_coffee_use).</Text>
        )}
      </View>

      {/* 2) Intensité */}
      <Text style={[st.sTitle, { marginTop: 8 }]}>Intensité</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
        {INTENSITIES.map(i => {
          const on = intensity === i.key;
          return (
            <TouchableOpacity
              key={i.key}
              activeOpacity={0.9}
              onPress={() => setIntensity(i.key)}
              style={[st.pill, on && st.pillActive]}
            >
              <Text style={[st.pillText, on && st.pillTextOn]}>{i.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 3) Molette — visible UNIQUEMENT si un usage est choisi (une seule molette) */}
      {selectedUsage && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 6 }}>
          <Text style={[st.sTitle, { flex: 1 }]}>Réglages café</Text>
          {ENABLE_OVERRIDES && (
            <TouchableOpacity
              onPress={() => setShowCoffeeEditor(true)}
              activeOpacity={0.9}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
                borderWidth: 2,
                borderColor: '#FFB6F9',
                backgroundColor: '#FFE4F6',
              }}
            >
              <Text style={{ fontWeight: '900', color: '#FF4FA2' }}>⚙️</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      {selectedUsage && hasCoffeeOverrides && (
        <View
          style={{
            backgroundColor: '#FFF0F5',
            borderColor: '#FF4FA2',
            borderWidth: 1,
            borderRadius: 10,
            padding: 8,
            marginBottom: 6,
          }}
        >
          <Text style={{ color: '#FF4FA2', fontWeight: '700' }}>⚠️ Données personnalisées</Text>
          <Text style={{ color: '#57324B', fontSize: 13 }}>
            Ces valeurs remplacent celles de base. Appuyez sur ⚙️ pour revoir ou réinitialiser.
          </Text>
        </View>
      )}

      {/* 4) Infos clés — claires et robustes */}
      <Text style={st.sTitle}>Infos clés</Text>
      <Row left="Volume tasse" right={`${fmtOrDash(cupMl)} ml (${fmtOrDash(cupCl)} cl)`} />
      <Row left="Dosage doux (g/cl)" right={fmtOrDash(doseLght)} />
      <Row left="Dosage corsé (g/cl)" right={fmtOrDash(doseStrng)} />
      <Row left="Dosage intense (g/cl)" right={fmtOrDash(doseIntens)} />
      <Row left="Grammes par tasse (intensité sélectionnée)" right={`${fmtOrDash(gramsPerCup)} g`} />
      <Row left="1 c. à soupe de café" right={tbsp_g != null ? `${fmt(tbsp_g)} g` : '—'} />
      {!!moutureTxt && <Row left="Mouture" right={moutureTxt} />}
      {tempC != null && <Row left="Température" right={`${fmt(tempC)} °C`} />}
      {timeMin != null && <Row left="Temps" right={`${fmt(timeMin)} min`} />}

      {/* 5) Convertisseurs */}
      <Text style={[st.sTitle, { marginTop: 8 }]}>Tasses ⇆ Poids</Text>
      <InputWithEcho
        value={cups}
        onChangeText={setCups}
        placeholder="Nombre de tasses (ex: 2)"
        echoLabel="Tasses"
      />
      <Row left="Poids de café (g)" right={fmtAllUnits(num(cups) * (gramsPerCup || 0))} />

      <InputWithEcho
        value={grams}
        onChangeText={setGrams}
        placeholder="Poids de café (g)"
        echoLabel="Poids (g)"
      />
      <Row left="Nombre de tasses" right={gramsPerCup > 0 ? fmt(num(grams) / gramsPerCup) : '—'} />

      {tbsp_g != null && (
        <>
          <Text style={[st.sTitle, { marginTop: 8 }]}>
            Cuillères <Text style={st.arrow}>⇆</Text> Poids
          </Text>
          <InputWithEcho
            value={tbsp}
            onChangeText={setTbsp}
            placeholder="Cuillères à soupe (ex: 2)"
            echoLabel="c. à soupe"
          />
          <Row left="Poids (g)" right={fmtAllUnits(num(tbsp) * (tbsp_g || 0))} />
          <InputWithEcho
            value={weightToSpoons}
            onChangeText={setWeightToSpoons}
            placeholder="Poids (g) — ex: 15"
            echoLabel="Poids (g)"
          />
          <Row
            left="Équivalent"
            right={tbsp_g ? `${fmt(num(weightToSpoons) / tbsp_g, 2)} c. à soupe` : '— c. à soupe'}
          />
        </>
      )}

      {/* 6) ParamEditor (UNE seule molette, liée à l’ingrédient café) */}
      {ENABLE_OVERRIDES && (
        <ParamEditor
          visible={showCoffeeEditor}
          onClose={() => setShowCoffeeEditor(false)}
          targetId={coffeeTargetId}
          base={d as any}
          specs={[
            { key: 'coffee_g_per_cl_lght',    label: 'Dosage doux (g/cl)',    type: 'number', hint: 'g/cl' },
            { key: 'coffee_g_per_cl_strng',   label: 'Dosage corsé (g/cl)',   type: 'number', hint: 'g/cl' },
            { key: 'coffee_g_per_cl_intense', label: 'Dosage intense (g/cl)', type: 'number', hint: 'g/cl' },
            { key: 'coffee_cup_ml',           label: 'Volume tasse (ml)',     type: 'number', hint: 'ml'   },
            { key: 'coffee_spcfc_tbsp_g',     label: '1 c. à soupe café (g)', type: 'number', hint: 'g'    },
          ] as any}
          onSaved={async () => {
            await reloadCoffeeOV();
            const ok = await hasOverrides(coffeeTargetId);
            setHasCoffeeOverrides(ok);
            setShowCoffeeEditor(false);
          }}
          onReset={async () => {
            await reloadCoffeeOV();
            const ok = await hasOverrides(coffeeTargetId);
            setHasCoffeeOverrides(ok);
            setShowCoffeeEditor(false);
          }}
        />
      )}
    </View>
  );
}


function PearSection({ d }: { d: Item }) {
  const [qtyEpl, setQtyEpl] = useState('');
  const [qtyNon, setQtyNon] = useState('');
  const [pearSelected, setPearSelected] = useState<any | null>(null);
  const [usageSel, setUsageSel] = useState<null | 'crok' | 'cook' | 'syrup' | 'salt'>(null);

  // Variétés de poires
  const pearVarieties = useMemo(
    () => (DB as any[]).filter(v => isTrue(v?.is_pear)),
    []
  );

  // Rendement générique de l’ingrédient (utile si AUCUNE variété n’est sélectionnée)
  const peelYGeneric = getPeelYield(d);

  // Utilitaires locaux
  const star5 = (n: number | null) => {
    const v = n ?? 0;
    if (v <= 0) return '—';
    const r = Math.max(0, Math.min(5, Math.round(v)));
    return '★'.repeat(r);
  };
  const scoreFrom = (row: any, col: string): number => firstInt(row?.[col]) ?? 0;

  // --------- OVERRIDES — VARIÉTÉ ---------
  // ⚠️ Les hooks doivent être au niveau racine du composant (jamais dans un if)
  const varTargetId = normalizeId(pearSelected?.id || pearSelected?.label || 'pear_variety');
  const { values: ovVar, reload: reloadVar, version: verVar } = useIngredientOverrides(varTargetId);

  const [showVarEditor, setShowVarEditor] = useState(false);
  const [hasVarOverrides, setHasVarOverrides] = useState(false);
  useEffect(() => {
    let mounted = true;
    hasOverrides(varTargetId).then(ok => { if (mounted) setHasVarOverrides(ok) });
    return () => { mounted = false };
  }, [varTargetId, verVar]);

  // Var sélectionnée + overrides (uniquement champs spécifiques variété)
  const pearVarOV = useMemo(() => {
    if (!pearSelected) return null;
    return mergeWithOverrides(pearSelected as any, ovVar, [
      'pear_spcfc_wght',
      'pear_spcfc_peel',
    ]);
  }, [pearSelected, ovVar]);

  // dd = base d + (variété + overrides) recopiée vers avg_unit_g / peeled_yield
  const dd: Item | null = useMemo(() => {
    if (!pearVarOV) return null;
    const avgUnit =
      toNumMaybe(pearVarOV.pear_spcfc_wght) ??
      toNumMaybe(d.avg_unit_g) ?? null;
    const peelYVar =
      toNumMaybe(pearVarOV.pear_spcfc_peel) ??
      toNumMaybe(d.peeled_yield) ?? null;
    return {
      ...d,
      ...pearVarOV,
      avg_unit_g: avgUnit,
      peeled_yield: peelYVar,
    } as Item;
  }, [d, pearVarOV]);

  // Valeurs calculées (uniquement quand une variété est sélectionnée)
  const avgNon = dd ? toNumMaybe(dd.avg_unit_g) : null;
  const peelY  = dd ? toNumMaybe(dd.peeled_yield) : null;
  const avgEpl = (avgNon !== null && peelY) ? avgNon * peelY : null;

  return (
    <View style={st.section}>
      {/* ✅ PAS d’“Infos clés” génériques ici → évite le doublon avec IngredientCard */}

      {/* Épluché ⇆ Non épluché (GÉNÉRIQUE) — montré seulement si AUCUNE variété n’est sélectionnée */}
      {!pearSelected && peelYGeneric !== null && Number.isFinite(peelYGeneric) && (
        <View style={st.section}>
          <Text style={st.sTitle}>
            Épluché <Text style={st.arrow}>⇆</Text> Non épluché{' '}
            <Text>{peeledLabelFor(d.id || d.label || '')}</Text>
          </Text>

          <InputWithEcho
            value={qtyEpl}
            onChangeText={setQtyEpl}
            placeholder="Quantité épluchée (g)"
            echoLabel="Épluchée (g)"
          />
          <Row left="Équiv. non épluché" right={fmtAllUnits(num(qtyEpl) / peelYGeneric)} />

          <InputWithEcho
            value={qtyNon}
            onChangeText={setQtyNon}
            placeholder="Quantité non épluchée (g)"
            echoLabel="Non épluchée (g)"
          />
          <Row left="Équiv. épluché" right={fmtAllUnits(num(qtyNon) * peelYGeneric)} />
        </View>
      )}

      {/* 1) Choisir un usage */}
      <Text style={[st.sTitle, { marginTop: 16 }]}>Choisir un usage</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        {[
          { key: 'crok' as const,  label: 'À croquer',                 col: 'crok_pear'  },
          { key: 'cook' as const,  label: 'À cuire (desserts chauds)', col: 'cook_pear'  },
          { key: 'syrup' as const, label: 'En conserve / sirop',       col: 'syrup_pear' },
          { key: 'salt' as const,  label: 'En salé',                   col: 'salt_pear'  },
        ].map(u => {
          const on = usageSel === u.key;
          return (
            <TouchableOpacity
              key={u.key}
              onPress={() => setUsageSel(prev => (prev === u.key ? null : u.key))}
              style={[st.pill, on && st.pillActive]}
              activeOpacity={0.9}
            >
              <Text style={[st.pillText, on && st.pillTextOn]} numberOfLines={1}>{u.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 2) Variétés compatibles pour l’usage sélectionné */}
      {usageSel && (() => {
        const col =
          usageSel === 'crok'  ? 'crok_pear'  :
          usageSel === 'cook'  ? 'cook_pear'  :
          usageSel === 'syrup' ? 'syrup_pear' : 'salt_pear';

        const list = pearVarieties
          .map(v => ({ v, s: scoreFrom(v, col), name: String(v.label ?? v.id) }))
          .filter(x => x.s > 0)
          .sort((a, b) => b.s - a.s || a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));

        if (list.length === 0) {
          return <Text style={{ color: '#666', marginBottom: 8 }}>Aucune variété notée pour cet usage.</Text>;
        }

        return (
          <View style={st.pillsWrap}>
            {list.map(({ v, s, name }) => {
              const on = pearSelected?.id === v.id;
              return (
                <TouchableOpacity
                  key={v.id}
                  onPress={() => setPearSelected(prev => (prev?.id === v.id ? null : v))}
                  activeOpacity={0.9}
                  style={[st.pill, on && st.pillActive]}
                >
                  {imgSrc(v.id) ? (
                    <Image
                      source={imgSrc(v.id)}
                      style={{ width: 18, height: 18, marginRight: 6, borderRadius: 4 }}
                    />
                  ) : null}
                  <Text style={[st.pillText, on && st.pillTextOn]} numberOfLines={1}>{name}</Text>
                  <Text style={st.pillBadge}>{star5(s)}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
        )
      })()}

      {/* 3) Choisir une variété (liste complète) */}
      <Text style={[st.sTitle, { marginTop: 16, marginBottom: 6 }]}>Choisir une variété</Text>
      <View style={st.pillsWrap}>
        {pearVarieties
          .map(v => ({ v, name: String(v.label ?? v.id) }))
          .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }))
          .map(({ v, name }) => {
            const on = pearSelected?.id === v.id;
            return (
              <TouchableOpacity
                key={v.id}
                onPress={() => setPearSelected(prev => (prev?.id === v.id ? null : v))}
                activeOpacity={0.9}
                style={[st.pill, on && st.pillActive]}
              >
                {imgSrc(v.id) ? (
                  <Image
                    source={imgSrc(v.id)}
                    style={{ width: 18, height: 18, marginRight: 6, borderRadius: 4 }}
                  />
                ) : null}
                <Text style={[st.pillText, on && st.pillTextOn]} numberOfLines={1}>{name}</Text>
              </TouchableOpacity>
            );
          })}
      </View>

      {/* 4) Quand une variété est sélectionnée : usages + infos spécifiques + convertisseurs */}
      {pearSelected && dd && (
        <View style={{ marginTop: 12 }}>
          {/* Usages de la variété — chips avec étoiles (pas de titre) */}
          {(() => {
            const varietyUsages = [
              { key: 'crok' as const,  label: 'À croquer',                 col: 'crok_pear'  },
              { key: 'cook' as const,  label: 'À cuire (desserts chauds)', col: 'cook_pear'  },
              { key: 'syrup' as const, label: 'En conserve / sirop',       col: 'syrup_pear' },
              { key: 'salt' as const,  label: 'En salé',                   col: 'salt_pear'  },
            ]
              .map(u => ({ ...u, s: firstInt((pearVarOV as any)?.[u.col]) ?? 0 }))
              .filter(x => x.s > 0)
              .sort((a, b) => b.s - a.s);

            return varietyUsages.length > 0 ? (
              <View style={st.pillsWrap}>
                {varietyUsages.map(({ key, label, s }) => {
                  const on = usageSel === key;
                  return (
                    <TouchableOpacity
                      key={key}
                      onPress={() => setUsageSel(prev => (prev === key ? null : key))}
                      activeOpacity={0.9}
                      style={[st.pill, on && st.pillActive]}
                    >
                      <Text style={[st.pillText, on && st.pillTextOn]} numberOfLines={1}>
                        {label}
                      </Text>
                      <Text style={st.pillBadge}>{star5(s)}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            ) : null;
          })()}

          {/* ==== Infos clés (variété) + molette ==== */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 6 }}>
            <Text style={[st.sTitle, { flex: 1 }]}>Infos clés (variété)</Text>

            {ENABLE_OVERRIDES && (
              <TouchableOpacity
                onPress={() => setShowVarEditor(true)}
                activeOpacity={0.9}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 999,
                  borderWidth: 2,
                  borderColor: '#FFB6F9',
                  backgroundColor: '#FFE4F6',
                }}
              >
                <Text style={{ fontWeight: '900', color: '#FF4FA2' }}>⚙️</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Bandeau Données personnalisées (lié à la VARIÉTÉ) */}
          {hasVarOverrides && (
            <View
              style={{
                backgroundColor: '#FFF0F5',
                borderColor: '#FF4FA2',
                borderWidth: 1,
                borderRadius: 10,
                padding: 8,
                marginBottom: 6,
              }}
            >
              <Text style={{ color: '#FF4FA2', fontWeight: '700' }}>⚠️ Données personnalisées</Text>
<Text style={{ color: '#57324B', fontSize: 13 }}>
  Ces valeurs remplacent celles de base. Appuyez sur ⚙️ pour revoir ou réinitialiser.
</Text>

            </View>
          )}

          {/* Lignes d’infos — précision en (parenthèses) sur la GAUCHE */}
          {avgNon !== null && <Row left="Poids moyen (1 pièce)" right={`${fmt(avgNon)} g`} />}
          {peelY  !== null && (
            <Row
              left={`Taux d'épluchage ${peeledLabelFor(d.id || d.label || '')}`}
              right={`×${fmt(peelY)}`}
            />
          )}
          {avgEpl !== null && (
            <Row
              left={`Poids épluché ${peeledLabelFor(d.id || d.label || '')}`}
              right={`${fmt(avgEpl)} g`}
            />
          )}

          {/* Épluché ⇆ Non épluché — VARIÉTÉ */}
          {peelY !== null && (
            <View style={{ marginTop: 8 }}>
              <Text style={st.sTitle}>
                Épluché <Text style={st.arrow}>⇆</Text> Non épluché <Text>{peeledLabelFor(d.id || d.label || '')}</Text>
              </Text>

              <InputWithEcho
                value={qtyEpl}
                onChangeText={setQtyEpl}
                placeholder="Quantité épluchée (g)"
                echoLabel="Épluchée (g)"
              />
              <Row left="Équiv. non épluché" right={fmtAllUnits(num(qtyEpl) / (peelY || 1))} />

              <InputWithEcho
                value={qtyNon}
                onChangeText={setQtyNon}
                placeholder="Quantité non épluchée (g)"
                echoLabel="Non épluchée (g)"
              />
              <Row left="Équiv. épluché" right={fmtAllUnits(num(qtyNon) * (peelY || 0))} />
            </View>
          )}

          {/* Quantité ⇆ Poids — pas de molette, mais bandeau lié à la VARIÉTÉ */}
         {avgNon !== null && (
  <GenericConversions
    d={dd}
    showGear={false}                 // ✅ pas de 2e molette ici
    forceTargetId={varTargetId}      // ✅ bandeau “données personnalisées” synchronisé
  />
)}  

          {/* ParamEditor — VARIÉTÉ (spécifiques) */}
          {ENABLE_OVERRIDES && (
            <ParamEditor
              visible={showVarEditor}
              onClose={() => setShowVarEditor(false)}
              targetId={varTargetId}
              base={(pearVarOV || pearSelected) as any}
              specs={[
                { key: 'pear_spcfc_wght', label: 'Poids moyen (1 pièce)', type: 'number', hint: 'g' },
                { key: 'pear_spcfc_peel', label: 'Taux d’épluchage',      type: 'number', hint: 'ex: 0.85' },
              ] as any}
              onSaved={async () => {
  await reloadVar();
  const ok = await hasOverrides(varTargetId); // ✅ met à jour le bandeau immédiatement
  setHasVarOverrides(ok);
  setShowVarEditor(false);
}}
onReset={async () => {
  await reloadVar();
  const ok = await hasOverrides(varTargetId); // ✅ masque le bandeau si tout est remis à zéro
  setHasVarOverrides(ok);
  setShowVarEditor(false);
}}

            />
          )}
        </View>
      )}
    </View>
  );
}


function FlourSection({ d }: { d: Item }) {
  // usage sélectionné (ligne de la DB portant is_flour_use)
  const [selected, setSelected] = React.useState<any | null>(null)

  // Helper truthy (même logique que ingredients.tsx)
  const truthyFlag = (v: any) => {
    const s = String(v ?? '').trim().toLowerCase()
    return s === '1' || s === 'true' || s === 'x' || s === 'oui' || s === 'yes' || s === '+' || s === 'o'
  }

  // Toutes les lignes "usages farine"
  const flourUsages = React.useMemo(
    () => (DB as any[]).filter(r => truthyFlag(r?.is_flour_use)),
    []
  )

  // Mapping fixe demandé (id → libellé visible)
  const USAGE_MAP: Array<{ id: string; label: string }> = [
    { id: 'biscuit',               label: 'Biscuits, sablés, crêpes, gâteaux moelleux' },
    { id: 'pate_brisee',           label: 'Pâte brisée, pâte sablée' },
    { id: 'pate_feuilletee',       label: 'Pâte feuilletée' },
    { id: 'baguette',              label: 'Pain blanc courant' },
    { id: 'pizza_levee_longue',    label: 'Pâte à pizza (levée longue)' },
    { id: 'pizza_levee_courte',    label: 'Pâte à pizza (levée courte)' },
    { id: 'pain_de_campagne',      label: 'Pain de campagne, pain rustique' },
    { id: 'pain_complet',          label: 'Pain complet, intégral' },
    { id: 'brioche',               label: 'Brioche, pain de mie, viennoiseries' },
    { id: 'panettone',             label: 'Panettone, pandoro, colomba' },
  ]

  // On joint le mapping statique avec les lignes trouvées dans la DB (par id)
  const usageRows = React.useMemo(() => {
    // index DB par id
    const byId = new Map<string, any>(flourUsages.map(r => [String(r.id ?? ''), r]))
    return USAGE_MAP
      .map(u => ({ ...u, row: byId.get(u.id) || null }))
      .filter(u => !!u.row) // ne garde que ceux réellement présents dans la DB
  }, [flourUsages])

 // --- Helpers robustes pour retrouver une colonne même si le CSV varie un peu ---
const normalizeKey = (k: string) =>
  String(k ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // accents
    .replace(/[\s_\-]+/g, '')        // espaces, underscores, tirets
    .trim()

const getField = (row: any, candidates: string[]) => {
  if (!row) return undefined
  const idx = new Map<string, string>()
  for (const k of Object.keys(row)) idx.set(normalizeKey(k), k)
  for (const name of candidates) {
    const nk = normalizeKey(name)
    if (idx.has(nk)) return row[idx.get(nk)!]
  }
  return undefined
}

// Nettoie les valeurs (enlève =, guillemets, espaces en trop)
const cleanText = (v: any): string =>
  String(v ?? '')
    .trim()
    .replace(/^=/, '')                    // enlève "=" (ex: ="T45-T55")
    .replace(/^['"]+|['"]+$/g, '')        // enlève guillemets d'encadrement
    .replace(/\s+/g, ' ')

// Type de farine (T45, T55, T45-T55, etc.)
const flourTText = (row: any): string => {
  // tolérant aux variantes de nommage éventuelles
  const raw = getField(row, [
    'flour_T', 'Flour_T', 'flour t', 'flourt',        // variantes usuelles
    'type_de_farine', 'type_farine', 'typefarine'     // au cas où
  ])
  const s = cleanText(raw)
  return s || '—'
}

// Force de farine (W)
const flourWText = (row: any): string => {
  const raw = getField(row, [
    'Flour_W', 'flour_W', 'flour_w', 'flour w', 'flourw',
    'force', 'force_farine', 'w'                      // variantes possibles
  ])
  const s = cleanText(raw)
  return s || '—'
}

  return (
    <View style={st.section}>
      {/* 1) Choisir un usage */}
      <Text style={st.sTitle}>Choisir un usage</Text>
      <View style={st.pillsWrap}>
        {usageRows.map(({ id, label, row }) => {
          const on = selected?.id === id
          return (
            <TouchableOpacity
              key={id}
              activeOpacity={0.9}
              onPress={() => setSelected(prev => (prev?.id === id ? null : row))}
              style={[st.pill, on && st.pillActive]}
            >
              {/* Image optionnelle si tu as prévu des thumbs par usage */}
              {imgSrc(id) ? (
                <Image
                  source={imgSrc(id)}
                  style={{ width: 18, height: 18, marginRight: 6, borderRadius: 4 }}
                />
              ) : null}
              <Text style={[st.pillText, on && st.pillTextOn]} numberOfLines={1}>
                {label}
              </Text>
            </TouchableOpacity>
          )
        })}
        {usageRows.length === 0 && (
          <Text style={{ color: '#666' }}>Aucun usage farine trouvé dans la base.</Text>
        )}
      </View>

      {/* 2) Détails de l’usage (toggle: re-cliquer pour masquer) */}
      {selected && (
        <View style={{ marginTop: 10 }}>
          <Text style={st.sTitle}>Recommandations</Text>
          <Row left="Type de farine conseillé" right={flourTText(selected)} />
          <Row left="Force de farine conseillée (W)" right={flourWText(selected)} />
        </View>
      )}
    </View>
  )
}




/* ===================== Styles ===================== */
const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFEEFC' },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  h1: { fontSize: 24, fontWeight: '900', color: '#FF4FA2' },

  headerWrap: {
    marginBottom: 12,
  },
  h1: { fontSize: 24, fontWeight: '900', color: '#FF4FA2' },

  actionsWrap: {
    marginTop: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'center',
  },
  actionLink: {
    fontWeight: '900',            // gras
    color: '#7c3aed',
    fontSize: 16,                 // un poil plus petit pour tenir
  },
  actionLinkSecondary: {
    fontWeight: '800',
    color: '#7c3aed',
    fontSize: 16,
    opacity: 0.9,
  },
  

  timerBanner: {
    backgroundColor: '#FF92E0',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
    shadowColor: '#FF4FA2',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  timerBannerText: { color: '#fff', fontWeight: '900', textAlign: 'center' },

  navLink: { color: '#7c3aed', fontWeight: '900', fontSize: 18 },

  card: { backgroundColor: '#fff', borderRadius: 18, padding: 14, marginBottom: 14, shadowColor: '#FF8FCD', shadowOpacity: 0.16, shadowRadius: 8, elevation: 5 },
  h2: { fontSize: 18, fontWeight: '900', color: '#FF4FA2', marginBottom: 8 },

  section: { marginTop: 8 },
  sTitle: { fontWeight: '800', marginBottom: 6, color: '#444' },
  arrow: { fontSize: 18, fontWeight: '900', color: '#FF4FA2' },

  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 3 },
  k: { color: '#555' },
  v: { fontWeight: '800', color: '#222' },

  inputWrap: { position: 'relative', marginTop: 6 },
  input: {
    backgroundColor: '#FFF0FA',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#FFB6F9',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#FF4FA2',
  },
  echo: {
    position: 'absolute',
    right: 10,
    bottom: 8,
    fontSize: 12,
    fontStyle: 'italic',
    color: '#9a3aa5',
    maxWidth: '55%',
  },

  // boutons / tailles
  sizeBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#FFB6F9',
    backgroundColor: '#FFE4F6',
  },
  sizeBtnOn: { borderColor: '#FF4FA2', backgroundColor: '#FF92E0' },
  sizeBtnText: { fontWeight: '800', color: '#FF4FA2' },
  sizeBtnTextOn: { color: '#fff' },

  // Tips style (réutilisé pour l’encart PDT)
  tipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFF6FB',
    borderColor: '#FFB6F9',
    borderWidth: 1,
    padding: 10,
    borderRadius: 12,
    marginTop: 6,
    marginBottom: 4,
  },
  tipText: { color: '#57324B', fontWeight: '600', flexShrink: 1 },
  tipStrong: { color: '#FF4FA2', fontWeight: '900' },

  // Puces / variétés
  pillsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#FFE4F6',
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#FFB6F9',
    gap: 6,
  },
  pillActive: { backgroundColor: '#FF92E0', borderColor: '#FF4FA2' },
  pillText: { color: '#FF4FA2', fontWeight: '800', maxWidth: 180 },
  pillTextOn: { color: '#fff' },
  pillBadge: { marginLeft: 6, fontWeight: '900', color: '#7a6680' },
    pillFiltered: {
    backgroundColor: '#E9D5FF', // violet pâle
    borderColor: '#C084FC',
  },

  // Info button (usages pâtes)
  infoBtn: {
    marginLeft: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBtnTxt: { fontWeight: '900', fontSize: 12 },

  // Info overlay
  infoOverlay: {
    position: 'absolute',
    left: 0, right: 0, top: 0, bottom: 0,
    justifyContent: 'flex-end',
  },
  infoBackdrop: {
    position: 'absolute',
    left: 0, right: 0, top: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  infoCard: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginBottom: 16,
    borderRadius: 18,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
    borderWidth: 2,
    borderColor: '#FFB6F9',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoTitle: {
    flex: 1,
    fontWeight: '900',
    fontSize: 16,
    color: '#FF4FA2',
  },
  closeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#FFE4F6',
    borderWidth: 1,
    borderColor: '#FFB6F9',
  },
  closeBtnTxt: { fontWeight: '900', fontSize: 12, color: '#7a3c84' },
  infoBody: { color: '#57324B', lineHeight: 20, fontWeight: '600' },
} );