// app/results.tsx
import { router, useLocalSearchParams } from 'expo-router'
import React, { useMemo, useState } from 'react'
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native'

import { msToMMSS, useTimer } from '../src/timerContext'




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
            <TouchableOpacity onPress={() => router.push('/calculatrice')}>
              <Text style={st.actionLink}>🧮 Calculatrice</Text>
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

function IngredientCard({ d, openInfo }: { d: Item; openInfo: (title: string, text: string) => void }) {
  // Etats saisies
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

  // Usages/Variétés PDT
  const [pdtMethod, setPdtMethod] = useState<PdtMethod | null>(null)
  const [pdtSelected, setPdtSelected] = useState<any | null>(null)

  // PÂTES — états UI
  const [showPastaUsages, setShowPastaUsages] = useState(false)
  const [pastaUsageSelId, setPastaUsageSelId] = useState<string | null>(null)
  const [pastaSelected, setPastaSelected] = useState<any | null>(null)

  // TOMATES — états UI
  const [tomatoUsageSelKey, setTomatoUsageSelKey] = useState<null | typeof TOMATO_USAGES[number]['key']>(null)
  const [tomatoSelected, setTomatoSelected] = useState<any | null>(null)

  
  // OIGNONS — états UI
  const [onionUsageSelKey, setOnionUsageSelKey] = useState<null | typeof ONION_USAGES[number]['key']>(null)
  const [onionSelected, setOnionSelected] = useState<any | null>(null)

  // Flags par id
  const normId = (d.id || d.label || '').toString().toLowerCase().replace(/\s+/g, '_')
  const isPotato = ['pomme_de_terre', 'pommes_de_terre', 'pdt'].includes(normId)
  const isCelery = normId === 'celeri'
  const isPasta = ['pates', 'pâtes', 'pasta'].includes(normId)
  const isTomato = ['tomate', 'tomates'].includes(normId)
  const isOnion = ['oignon', 'oignons'].includes(normId)
  const isAvocado = ['avocat', 'avocats'].includes(normId)
  const isPepper  = ['poivron', 'poivrons'].includes(normId)
  const isApple  = ['pomme', 'pommes'].includes(normId)
  const isPear   = ['poire', 'poires'].includes(normId)
  const isGarlic  = ['ail', 'gousse_d_ail', 'gousses_d_ail', 'tete_d_ail', 'tête_d_ail'].includes(normId)
  const isCoffee = ['cafe', 'café', 'coffee'].includes(normId)
  const isFlour = ['farine', 'farines', 'flour'].includes(normId)



  const peelY = getPeelYield(d)
  const showPeeled =
  !isPotato && 
  peelY !== null && Number.isFinite(peelY) && peelY > 0

  

  // Accord "épluché / épluchée"
  const g = (d.genre ?? d.gender ?? '').toString().trim().toLowerCase()
  const isF = g === 'f' || g.startsWith('fem')
  const EPL = `Épluch${isF ? 'ée' : 'é'}`
  const NON_EPL = `Non épluch${isF ? 'ée' : 'é'}`
  const NON_EPL_SHORT = 'non épl.'

  // Poids unitaire PDT selon taille
  const pdtS = toNumMaybe(d.wght_pdt_s) ?? null
  const pdtM = toNumMaybe(d.wght_pdt_m) ?? null
  const pdtL = toNumMaybe(d.wght_pdt_l) ?? null
  const hasPdt = pdtS !== null || pdtM !== null || pdtL !== null
  const pdtUnit = (pdtSize === 'S' ? (pdtS ?? 0) : pdtSize === 'M' ? (pdtM ?? 0) : (pdtL ?? 0))

  // Constantes générales
  const density = d.density_g_ml ?? 1
  const tsp_g = d.tsp_g ?? (d.tbsp_g ? d.tbsp_g / 3 : null)
  const tbsp_g = d.tbsp_g ?? (tsp_g ? tsp_g * 3 : null)

  // Pâtes (eau/sel)
  const pastaW = toNumMaybe(d.psta_wter)
  const pastaS = toNumMaybe(d.psta_slt)
  const hasPasta = pastaW !== null || pastaS !== null

  // Œufs
  const eggS = toNumMaybe(d.egg_s) ?? null
  const eggM = toNumMaybe(d.egg_m) ?? null
  const eggL = toNumMaybe(d.egg_l) ?? null
  const whitePct = toNumMaybe(d.whte_pctge) ?? null
  const yolkPct  = toNumMaybe(d.ylw_pctge)  ?? null
  const hasEggs = (eggS || eggM || eggL) !== null && (whitePct !== null || yolkPct !== null)
  const eggUnit = eggSize === 'S' ? (eggS ?? 0) : eggSize === 'M' ? (eggM ?? 0) : (eggL ?? 0)

  // Céleri
  const celeryG = toNumMaybe(d.clr_lgth) ?? null
  const hasCelery = isCelery && celeryG !== null

  // THÉ
  const hasTea = d.tea !== undefined && d.tea !== null && String(d.tea).trim() !== ''
  const t_grn_tp = (d as any).grn_tp
  const t_grn_tm = (d as any).grn_tm
  const t_bck_tp = (d as any).bck_tp
  const t_bck_tm = (d as any).bck_tm
  const t_olg_tp = (d as any).olg_tp
  const t_olg_tm = (d as any).olg_tm
  const t_rbs_tp = (d as any).rbs_tp
  const t_rbs_tm = (d as any).rbs_tm

  // -------- Bloc “Infos clés” (unique) --------
  const infoRows: React.ReactNode[] = []
  if (hasTea) {
    if (t_grn_tp !== null || t_grn_tm !== null)
      infoRows.push(<Row key="tea-grn" left="Thé vert" right={`${teaTemp(t_grn_tp)} • ${teaTime(t_grn_tm)}`} />)
    if (t_bck_tp !== null || t_bck_tm !== null)
      infoRows.push(<Row key="tea-bck" left="Thé noir" right={`${teaTemp(t_bck_tp)} • ${teaTime(t_bck_tm)}`} />)
    if (t_olg_tp !== null || t_olg_tm !== null)
      infoRows.push(<Row key="tea-olg" left="Oolong" right={`${teaTemp(t_olg_tp)} • ${teaTime(t_olg_tm)}`} />)
    if (t_rbs_tp !== null || t_rbs_tm !== null)
      infoRows.push(<Row key="tea-rbs" left="Rooibos" right={`${teaTemp(t_rbs_tp)} • ${teaTime(t_rbs_tm)}`} />)
  }
  if (!isPotato && d.avg_unit_g) {
    infoRows.push(<Row key="avg" left="Poids moyen (1 pièce)" right={`${fmt(d.avg_unit_g)} g`} />)
  }

 
  // --- PDT : remplacer "Poids épluché (×...)" par "Taux moyen d'épluchage"
if (isPotato) {
  const peel = getPeelYield(d)
  if (peel !== null && Number.isFinite(peel)) {
    infoRows.push(<Row key="pdt-peel-rate" left="Taux moyen d'épluchage" right={`×${fmt(peel)}`} />)
  }
}

 if (showPeeled && d.avg_unit_g) {
const special =
  isTomato  ? ' (Tomate équeutée et époinçonnée, non pelée)' :
  isAvocado ? ' (Avocat pelé et dénoyauté)' :
  isPepper  ? ' (Poivron équeuté, épépiné, non pelé)' :
  isGarlic  ? ' (Gousse pelée et dégermée)' :
  isApple   ? ' (Pomme pelée et évidée)' :
              ` (×${fmt(peelY!)})`


  infoRows.push(
    <Row
      key="peeled"
      left={`Poids ${EPL.toLowerCase()}${special}`}
      right={`${fmt((d.avg_unit_g || 0) * (peelY || 0))} g`}
    />
  )
}

// --- AIL : "Tête d'ail" juste après Poids épluché (ou après Poids moyen s'il n'y a pas de peelY)
if (isGarlic) {
  const cloves =
    toNumMaybe((d as any).ail_nmbr) ??
    toNumMaybe((d as any).ail_nmber) ?? null
  if (cloves && Number.isFinite(cloves) && cloves > 0) {
    const n = Math.round(cloves)
    const unit = n > 1 ? 'gousses' : 'gousse'
    infoRows.push(<Row key="garlic-head" left="Tête d'ail" right={`≈ ${n} ${unit}`} />)
  }
}



  {(() => {
    const jPerUnit = juicePerUnitMl(d)
    if (jPerUnit == null) return null
    infoRows.push(
      <Row key="juice" left="Jus moyen (1 pièce)" right={fmtVolAllUnits(jPerUnit)} />
    )
    return null
  })()}


  /* ----- Variétés / Usages ----- */
  const pdtVarieties = useMemo(() => (DB as any[]).filter(v => Number(v?.is_pdt) === 1), [])
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
  const tomatoVarieties = useMemo(() => (DB as any[]).filter(v => hasVal(v?.is_tmt)), [])
  const onionVarieties  = useMemo(() => (DB as any[]).filter(v => hasVal(v?.is_onn)), [])

  const selectedUsage = useMemo(
    () => pastaUsages.find(u => u.row?.id === pastaUsageSelId) || null,
    [pastaUsages, pastaUsageSelId]
  )

  /* ===== RENDER ===== */
  return (
    <View style={st.card}>
      {/* Titre + image */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={[st.h2, { flex: 1 }]}>{d.label}</Text>
        {imgSrc(d.id) && <Image source={imgSrc(d.id)} style={{ width: 44, height: 44, marginLeft: 8 }} resizeMode="contain" />}
      </View>

      {(infoRows.length > 0) && (
        <View style={st.section}>
          <Text style={st.sTitle}>Infos clés</Text>
          {infoRows}
        </View>
      )}

      {/* ========= Épluché ⇆ Non épluché (si peeled_yield) ========= */}
      {(() => {
         if (isApple || isPear) return null
         if (isGarlic) return null
  const peelY = getPeelYield(d)
  if (!peelY) return null   // 🚫 masque si aucune valeur dans le CSV

  const nonFromEpl = num(qtyEpl) / peelY
  const eplFromNon = num(qtyNon) * peelY

  return (
    <View style={st.section}>
      <Text style={st.sTitle}>
        Épluché <Text style={st.arrow}>⇆</Text> Non épluché
        <Text>
          {isTomato  ? ' (Tomate équeutée et époinçonnée, non pelée)'
            : isAvocado ? ' (Avocat pelé et dénoyauté)'
            : isPepper  ? ' (Poivron équeuté, épépiné, non pelé)'
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
        const eggS = toNumMaybe(d.egg_s) ?? null
        const eggM = toNumMaybe(d.egg_m) ?? null
        const eggL = toNumMaybe(d.egg_l) ?? null
        const whitePct = toNumMaybe(d.whte_pctge) ?? null
        const yolkPct  = toNumMaybe(d.ylw_pctge)  ?? null
        const hasEggs = (eggS || eggM || eggL) !== null && (whitePct !== null || yolkPct !== null)

        if (!hasEggs) return null

        return <EggsSection d={d} />
      })()}

{/* --------- Module VOLAILLE --------- */}
{(() => {
  const normId = (d.id || d.label || '').toString().toLowerCase().replace(/\s+/g, '_')
  const isChicken = normId === 'volaille'
  if (!isChicken) return null
  return <ChickenSection d={d} />
})()}

{/* --------- Module ÉPICES --------- */}
{(() => {
  const normId = (d.id || d.label || '').toString().toLowerCase().replace(/\s+/g, '_')
  const isSpices = normId === 'epices' || normId === 'epice'
  if (!isSpices) return null
  return <SpicesSection d={d} />
})()}


      {/* --------- Pommes de terre --------- */}
      {(() => {
        const normId = (d.id || d.label || '').toString().toLowerCase().replace(/\s+/g, '_')
        const isPotato = ['pomme_de_terre', 'pommes_de_terre', 'pdt'].includes(normId)
        if (!isPotato) return null
        return <PotatoSection d={d} openInfo={openInfo} />
      })()}

      {/* --------- Module PÂTES --------- */}
      {(() => {
        const normId = (d.id || d.label || '').toString().toLowerCase().replace(/\s+/g, '_')
        const isPasta = ['pates', 'pâtes', 'pasta'].includes(normId)
        if (!isPasta) return null
        return <PastaSection d={d} openInfo={openInfo} />
      })()}

      {/* --------- Module TOMATES --------- */}
      {(() => {
        const normId = (d.id || d.label || '').toString().toLowerCase().replace(/\s+/g, '_')
        const isTomato = ['tomate', 'tomates'].includes(normId)
        if (!isTomato) return null
        return <TomatoSection d={d} />
      })()}

      {/* --------- Module FROMAGES --------- */}
{(() => {
  const normId = (d.id || d.label || '').toString().toLowerCase().replace(/\s+/g, '_')
  const isCheese = normId === 'fromages' || normId === 'fromage' || normId === 'cheese'
  if (!isCheese) return null
  return <CheeseSection d={d} />
})()}


      {/* --------- Module OIGNONS --------- */}
      {(() => {
        const normId = (d.id || d.label || '').toString().toLowerCase().replace(/\s+/g, '_')
        const isOnion = ['oignon', 'oignons'].includes(normId)
        if (!isOnion) return null
        return <OnionSection d={d} />
      })()}

      {/* --------- Module CHOUX --------- */}
{(() => {
  const normId = (d.id || d.label || '').toString().toLowerCase().replace(/\s+/g, '_')
  const isCabbage = normId === 'choux' || normId === 'chou'
  if (!isCabbage) return null
  return <CabbageSection d={d} />
})()}

{/* --------- Module AIL --------- */}
{(() => {
  const normId = (d.id || d.label || '').toString().toLowerCase().replace(/\s+/g, '_')
  const isGarlic = normId === 'ail' || normId === 'gousse_d_ail' || normId === 'gousses_d_ail'
  if (!isGarlic) return null
  return <GarlicSection d={d} />
})()}


 {/* --------- Module POMMES --------- */}
 {(() => {
   const normId = (d.id || d.label || '').toString().toLowerCase().replace(/\s+/g, '_')
   const isApple = ['pomme', 'pommes'].includes(normId)
   if (!isApple) return null
   return <AppleSection d={d} />
 })()}

 {/* --------- Module POIRES --------- */}
{(() => {
  const normId = (d.id || d.label || '').toString().toLowerCase().replace(/\s+/g, '_')
  const isPear = ['poire', 'poires'].includes(normId)
  if (!isPear) return null
  return <PearSection d={d} />
})()}

{/* --------- Module FARINE --------- */}
{(() => {
  const normId = (d.id || d.label || '').toString().toLowerCase().replace(/\s+/g, '_')
  const isFlour = ['farine', 'farines', 'flour'].includes(normId)
  if (!isFlour) return null
  return <FlourSection d={d} />
})()}



{/* --------- Jus (PRIORITÉ AVANT Quantité/Poids) --------- */}
{(() => {
  if (!hasJuice(d)) return null
  return <JuiceSection d={d} />
})()}

{/* --------- Module CAFÉ --------- */}
{(() => {
  const ref = (d.id || d.label || '').toString().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // retire accents
    .replace(/\s+/g, '_')
  const isCoffee = ['cafe','coffee'].includes(ref)
  if (!isCoffee) return null
  return <CoffeeSection d={d} />
})()}



      {/* --------- Conversions génériques (non-PDT, non-Pâtes) --------- */}
     {(() => {
  const normId = (d.id || d.label || '').toString().toLowerCase().replace(/\s+/g, '_')
  const isPotato = ['pomme_de_terre', 'pommes_de_terre', 'pdt'].includes(normId)
  const isPasta  = ['pates', 'pâtes', 'pasta'].includes(normId)
  const isApple  = ['pomme', 'pommes'].includes(normId)
  if (isPotato || isPasta || isApple || isPear || isGarlic || !d.avg_unit_g) return null
  return <GenericConversions d={d} />
})()}

      {/* --------- Céleri --------- */}
      {(() => {
        const normId = (d.id || d.label || '').toString().toLowerCase().replace(/\s+/g, '_')
        const isCelery = normId === 'celeri'
        const celeryG = toNumMaybe(d.clr_lgth) ?? null
        if (!isCelery || celeryG === null) return null
        return <CelerySection d={d} />
      })()}

      
      {/* --------- Taille ⇆ Poids --------- */}
      {d.lgth_g ? <LengthWeightSection d={d} /> : null}

      {/* --------- Cuillères ⇆ Poids --------- */}
      {(d.tbsp_g || d.tsp_g) ? <SpoonsSection d={d} /> : null}

      {/* --------- Pâtes — eau & sel --------- */}
      {(() => {
        const pastaW = toNumMaybe(d.psta_wter)
        const pastaS = toNumMaybe(d.psta_slt)
        const hasPasta = pastaW !== null || pastaS !== null
        if (!hasPasta) return null
        return <PastaWaterSaltSection d={d} />
      })()}
    </View>
  )
}

/* ========= Sections réutilisables (découpées pour lisibilité) ========= */

// ↓↓↓ ajoute ceci quelque part dans results.tsx (par ex. juste avant EggsSection) ↓↓↓
function GenericConversions({ d }: { d: Item }) {
  const [genWeightEpl, setGenWeightEpl] = React.useState('');
  const [genWeightNon, setGenWeightNon] = React.useState('');
  const [countNon,     setCountNon]     = React.useState('');

  const avgNon = toNumMaybe(d.avg_unit_g);
  const peelY  = getPeelYield(d);                   // ← unifiée
  const avgEpl = (avgNon !== null && peelY) ? avgNon * peelY : null;

  return (
    <View style={st.section}>
      <Text style={st.sTitle}>
        Quantité <Text style={st.arrow}>⇆</Text> Poids
      </Text>

      {/* 1) SI on a un rendement → champ "Poids épluché" */}
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
        /* SINON → champ générique "Poids (g)" */
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

      {/* 3) Nb pièces → poids (et poids épluché seulement si rendement) */}
      <InputWithEcho
        value={countNon}
        onChangeText={setCountNon}
        placeholder="Pièces non épl. (ex: 3)"
        echoLabel="Pièces non épl."
      />
      <Row left="Poids non épluché" right={fmtAllUnits(num(countNon) * (avgNon ?? 0))} />
      {peelY ? <Row left="Poids épluché" right={fmtAllUnits(num(countNon) * (avgNon ?? 0) * peelY)} /> : null}
    </View>
  );
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

function PotatoSection({ d, openInfo }: { d: Item; openInfo: (title: string, text: string) => void }) {
  const [pdtMethod, setPdtMethod] = useState<PdtMethod | null>(null)
  const [pdtSelected, setPdtSelected] = useState<any | null>(null)
  const [qtyEpl, setQtyEpl] = useState('')
  const [qtyNon, setQtyNon] = useState('')

  // Toutes les variétés de pommes de terre
  const pdtVarieties = useMemo(
    () => (DB as any[]).filter(v => Number(v?.is_pdt) === 1),
    []
  )

  return (
    <View style={st.section}>
      {/* 1) Choisir un usage */}
      <Text style={st.sTitle}>Choisir un usage</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {PDT_METHODS.map(m => {
          const on = pdtMethod?.label === m.label
          return (
            <TouchableOpacity
              key={m.label}
              onPress={() => {
                // Toggle usage, mais on NE TOUCHE PAS à la liste “Choisir une variété”
                setPdtMethod(prev => (prev?.label === m.label ? null : m))
                // on ne reset pas la variété si on reclique un usage différent ? à toi de voir :
                // je garde la variété si elle existe, c’est plus pratique.
              }}
              activeOpacity={0.9}
              style={[st.pill, on && st.pillActive]}
            >
              <Text style={[st.pillText, on && st.pillTextOn]} numberOfLines={1}>
                {m.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {/* 2) Variétés recommandées pour l’usage sélectionné (chips triées par étoiles, décroissant) */}
      {pdtMethod && (() => {
        const recos = pdtVarieties
          .map(v => ({ v, s: scoreFor(v, pdtMethod) }))
          .filter(x => x.s >= 1)
          .sort(
            (a, b) =>
              b.s - a.s ||
              String(a.v.label ?? a.v.pdt_variety ?? a.v.id)
                .localeCompare(String(b.v.label ?? b.v.pdt_variety ?? b.v.id), 'fr', { sensitivity: 'base' })
          )

        return (
          <View style={{ marginBottom: 12 }}>
            {/* (on ne met PAS de titre verbeux, juste les chips pour rester clean) */}
            {recos.length === 0 ? (
              <Text style={{ color: '#666' }}>
                Aucune variété particulièrement recommandée pour {pdtMethod.label.toLowerCase()}.
              </Text>
            ) : (
              <View style={st.pillsWrap}>
                {recos.map(({ v, s }) => {
                  const name = String(v.label ?? v.pdt_variety ?? v.id)
                  const on = pdtSelected?.id === v.id
                  return (
                    <TouchableOpacity
                      key={v.id}
                      onPress={() => setPdtSelected(prev => (prev?.id === v.id ? null : v))} // toggle
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
                  )
                })}
              </View>
            )}
          </View>
        )
      })()}

      {/* 3) Choisir une variété — liste COMPLÈTE, alphabétique, SANS étoiles (ne change pas quand on clique un usage) */}
      <Text style={[st.sTitle, { marginTop: 4, marginBottom: 6 }]}>Choisir une variété</Text>
      <View style={st.pillsWrap}>
        {pdtVarieties
          .map(v => ({ v, name: String(v.label ?? v.pdt_variety ?? v.id) }))
          .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }))
          .map(({ v, name }) => {
            const on = pdtSelected?.id === v.id
            return (
              <TouchableOpacity
                key={v.id}
                onPress={() => setPdtSelected(prev => (prev?.id === v.id ? null : v))} // toggle
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
            )
          })}
      </View>

      {/* 4) Détails quand une variété est sélectionnée */}
      {pdtSelected && (
  <View style={{ marginTop: 12 }}>
    {/* (en-tête supprimé) */}

    {!!pdtSelected.pdt_texture && (
      <Row left="Chair" right={String(pdtSelected.pdt_texture)} />
    )}

    {/* Usages de la variété — chips avec étoiles */}
    {(() => {
      const varUsages = PDT_METHODS
        .map(m => ({ m, s: scoreFor(pdtSelected, m) }))
        .filter(x => x.s >= 1)
        .sort((a, b) => b.s - a.s)

      return varUsages.length > 0 ? (
        <View style={[st.pillsWrap, { marginTop: 8 }]}>
          {varUsages.map(({ m, s }) => {
            const on = pdtMethod?.label === m.label
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
            )
          })}
        </View>
      ) : null
    })()}

    {/* Infos + conversions spécifiques variété */}
    {(() => {
      const avgNon = toNumMaybe(pdtSelected.pdt_spcfc_wght) ?? null
      const peelY  = toNumMaybe(pdtSelected.pdt_spcfc_peel) ?? null
      if (avgNon === null && peelY === null) return null

      return (
        <View style={{ marginTop: 14 }}>
          <Text style={st.sTitle}>Infos clés (variété)</Text>
          {avgNon !== null && <Row left="Poids moyen (1 pièce)" right={`${fmt(avgNon)} g`} />}
          {peelY  !== null && <Row left="Taux moyen d'épluchage" right={`×${fmt(peelY)}`} />}

          {peelY !== null && (
            <View style={[st.section, { marginTop: 10 }]}>
              <Text style={st.sTitle}>
                Épluché <Text style={st.arrow}>⇆</Text> Non épluché
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

          {/* Quantité ⇆ Poids */}
          <GenericConversions d={{ ...d, ...pdtSelected }} />
        </View>
           )
          })()}
        </View>
      )}
    </View>
  )
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
  const [tmtPiecesNon, setTmtPiecesNon] = useState('');


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
                      onPress={() => setTomatoSelected(v)}
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
                    onPress={() => setTomatoSelected(v)}
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
              // fusion : si une variété est sélectionnée on écrase d par ses champs
              const base: any = tomatoSelected ? { ...d, ...tomatoSelected } : d

              // références de poids
              const avgNon = toNumMaybe(base.tmt_spcfc_wght) ?? toNumMaybe(base.avg_unit_g) ?? 0
              const peelY  = getPeelYield(base) // utilise appl_/tmt_/avoc_/pepr_/peeled_yield
              const avgEpl = peelY ? avgNon * peelY : null

              // métadonnées
              const famCol = TOMATO_FAMILIES.find(f => hasVal(base?.[f.col]))
              const family = famCol ? famCol.label : ''
              const taste  = String(base?.tmt_com ?? '').trim()

              // usages possibles (si une variété est sélectionnée)
              const usages = tomatoSelected
                ? TOMATO_USAGES
                    .map(u => ({ u, s: firstInt(base?.[u.col]) ?? 0 }))
                    .filter(x => x.s >= 1)
                    .sort((a, b) => b.s - a.s)
                : []
            

              return (
                <View style={{ marginTop: 10 }}>
                  {/* Usages possibles (uniquement quand une variété est sélectionnée) */}
                  {usages.length > 0 && (
                    <View style={{ marginTop: 4, marginBottom: 12 }}>
                      <Text style={st.sTitle}>Usages possibles</Text>
                      <View style={st.pillsWrap}>
                        {usages.map(({ u, s }) => (
                          <View key={`tu-${u.key}`} style={st.pill}>
                            <Text style={st.pillText}>{u.label}</Text>
                            <Text style={st.pillBadge}>{s >= 3 ? '★★★' : s === 2 ? '★★' : '★'}</Text>
                          </View>
                        ))}
                      </View>
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

    {!!family && (
      <View style={{ marginTop: 8 }}>
        <Text style={st.sTitle}>Famille</Text>
        <Text style={{ color: '#57324B', fontWeight: '600' }}>{family}</Text>
      </View>
    )}

    {!!taste && (
      <View style={{ marginTop: 8 }}>
        <Text style={st.sTitle}>Goût</Text>
        <Text style={{ color: '#57324B', fontWeight: '600' }}>{taste}</Text>
      </View>
    )}
  </>
)}




{tomatoSelected && (() => {
  // on force avg_unit_g / peeled_yield pour que GenericConversions utilise bien
  // le poids spécifique tomate + le rendement correct
  const dd = {
    ...base,
    avg_unit_g: (avgNon || null),
    peeled_yield: (peelY ?? null),
  } as Item

  // 3 barres: Poids épl. → pièces / Poids non épl. → pièces / Nb pièces → poids
  return <GenericConversions d={dd} />
})()}

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
} // ← fin de TomatoSection


function OnionSection({ d }: { d: Item }) {
  const [onionUsageSelKey, setOnionUsageSelKey] = useState<null | typeof ONION_USAGES[number]['key']>(null)
  const [onionSelected, setOnionSelected] = useState<any | null>(null)

  const onionVarieties  = useMemo(() => (DB as any[]).filter(v => hasVal(v?.is_onn)), [])

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
                setOnionSelected(null)
                setOnionUsageSelKey(prev => prev === u.key ? null : u.key)
              }}
              style={[st.sizeBtn, on && st.sizeBtnOn]}
            >
              <Text style={[st.sizeBtnText, on && st.sizeBtnTextOn]}>{u.label}</Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {/* Variétés correspondant à l’usage sélectionné */}
      {onionUsageSelKey && (() => {
        const usage = ONION_USAGES.find(u => u.key === onionUsageSelKey)!
        const list = onionVarieties
          .map(v => ({ v, s: firstInt(v?.[usage.col]) ?? 0, name: String(v.label ?? v.id) }))
          .filter(x => x.s >= 1)
          .sort((a, b) => (b.s - a.s) || a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }))

        return list.length > 0 ? (
          <View style={st.pillsWrap}>
            {list.map(({ v, s, name }) => {
              const on = onionSelected?.id === v.id
              return (
                <TouchableOpacity
                  key={v.id}
                  onPress={() => setOnionSelected(v)}
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
                  onPress={() => setOnionSelected(v)}
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

      {/* Détails de la variété sélectionnée */}
      {/* Détails de la variété sélectionnée */}
{onionSelected && (
  <View style={{ marginTop: 10 }}>
    {/* On ne rend PLUS Famille ni Goût ici */}

    <Text style={st.sTitle}>Usages possibles</Text>
    <View style={{ marginTop: 4, gap: 4 }}>
      {ONION_USAGES.map(u => {
        const s = firstInt(onionSelected?.[u.col]) ?? 0
        if (s < 1) return null
        return (
          <Row
            key={u.key}
            left={u.label}
            right={`${starsFor(s)} ${verdictFor(s)}`}
          />
        )
      })}
    </View>
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
  const [weightG, setWeightG] = useState('')
  const [pieces, setPieces]   = useState('')
  const [volOrWeight, setVolOrWeight] = useState('')

  const perG = toNumPos(d.juice_ml_per_g)
  const avgG = toNumPos(d.avg_unit_g)
  const perUnit = juicePerUnitMl(d) // = avg_unit_g * juice_ml_per_g si dispo, sinon juice_ml_per_unit

  // Calculs pour les barres 1 et 2
  const volFromWeight = perG ? juiceFromWeightMl(num(weightG), d) : null
  const volFromPieces = perUnit != null ? (num(pieces) * perUnit) : null

  // Calculs pour la 3e barre (Volume ou poids voulu)
  const volOrW = num(volOrWeight)
  let estWeight: number | null = null
  let estPieces: number | null = null

  if (volOrW && perG) {
    // Interprétation : si >1000, on suppose que c’est en g (fruit)
    if (volOrW > 1000 && avgG) {
      estWeight = volOrW
      estPieces = avgG ? estWeight / avgG : null
    } else {
      estWeight = volOrW / perG
      estPieces = avgG ? estWeight / avgG : null
    }
  } else if (volOrW && perUnit) {
    estPieces = volOrW / perUnit
    estWeight = avgG && estPieces ? estPieces * avgG : null
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
            placeholder={`Poids du ${String(d.label || 'produit')} (g)`}
            echoLabel="Volume estimé"
          />
          <Row left="Volume estimé" right={fmtVolAllUnits(volFromWeight ?? 0)} />
        </>
      )}

      {/* Barre 2 — N pièces (poids inconnu) -> Volume estimé */}
      {perUnit != null && (
        <>
          <InputWithEcho
            value={pieces}
            onChangeText={setPieces}
            placeholder="Nombre de pièces (poids inconnu)"
            echoLabel="Volume estimé"
          />
          <Row left="Volume estimé" right={fmtVolAllUnits(volFromPieces ?? 0)} />
        </>
      )}

      {/* Barre 3 — Volume ou poids voulu (ml ou g) */}
      <InputWithEcho
        value={volOrWeight}
        onChangeText={setVolOrWeight}
        placeholder="Volume ou poids voulu (ml ou g)"
        echoLabel="Estimation"
      />
      <Row left="Poids estimé" right={`${fmt(estWeight)} g`} />
      <Row left="Nombre de pièces estimé" right={fmt(estPieces)} />
    </View>
  )
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
  const [waterL, setWaterL] = useState('')
  const pastaW = toNumMaybe(d.psta_wter)
  const pastaS = toNumMaybe(d.psta_slt)

  return (
    <View style={st.section}>
      <Text style={[st.sTitle, { marginTop: 8 }]}>
        Pâtes <Text style={st.arrow}>⇆</Text> Eau & Sel
      </Text>
      <InputWithEcho value={pastaG} onChangeText={setPastaG} placeholder="Qtité de pâtes (g)" echoLabel="Pâtes (g)" />
      {(() => {
        const g = num(pastaG)
        const L = g * (pastaW ?? 0)
        const cl = L * 10
        const ml = L * 1000
        const saltG = (pastaS ?? 0) * g
        return (
          <>
            <Row left="Quantité d'eau" right={`${fmt(L, 3)} l  |  ${fmt(cl, 1)} cl  |  ${fmt(ml, 0)} ml`} />
            <Row left="Quantité de sel" right={fmtAllUnits(saltG)} />
          </>
        )
      })()}
      <InputWithEcho value={waterL} onChangeText={setWaterL} placeholder="Quantité d'eau (l)" echoLabel="Eau (l)" />
      {(() => {
        const L2 = num(waterL)
        const saltG2 = L2 * (pastaS ?? 0) * 100
        return <Row left="Quantité de sel" right={fmtAllUnits(saltG2)} />
      })()}
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

  const appleVarieties = useMemo(
    () => (DB as any[]).filter(v => isTrue(v?.is_appl)),
    []
  );

  const peelYGeneric = getPeelYield(d);

  const star5 = (n: number | null) => {
    const v = n ?? 0;
    if (v <= 0) return '—';
    const r = Math.max(0, Math.min(5, Math.round(v)));
    return '★'.repeat(r);
  };

  const scoreFrom = (row: any, col: string): number =>
    firstInt(row?.[col]) ?? 0;

  // robustesse: comparaison de variétés par id/label
  const sameVariety = (a: any, b: any) =>
    String(a?.id ?? a?.label ?? '') === String(b?.id ?? b?.label ?? '');

  return (
    <View style={st.section}>
      {/* 1. Infos clés (générique) */}
      {peelYGeneric !== null && Number.isFinite(peelYGeneric) && (
        <View style={{ marginBottom: 12 }}>
          <Text style={st.sTitle}>Infos clés</Text>
          <Row
            left={`Taux moyen d'épluchage ${peeledLabelFor(d.id || d.label || '')}`}
            right={`×${fmt(peelYGeneric)}`}
          />
        </View>
      )}

      {/* 2. Bloc Épluché ⇆ Non épluché */}
      {peelYGeneric !== null && Number.isFinite(peelYGeneric) && (
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

      {/* 3. Choisir un usage (filtrage → variétés en CHIPS violet pâle) */}
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

      {/* Résultats pour l’usage sélectionné → CHIPS (violet pâle) */}
      {usageSel && (() => {
        const col = usageSel === 'crck' ? 'appl_crck' : usageSel === 'pie' ? 'appl_pie' : 'appl_cpt';
        const list = appleVarieties
          .map(v => ({ v, s: scoreFrom(v, col), name: String(v.label ?? v.id) }))
          .filter(x => x.s > 0)
          .sort((a, b) => b.s - a.s || a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }))

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

      {/* 4. Choisir une variété (toute la liste) */}
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

      {/* 5. Usages POSSIBLES pour la variété sélectionnée → CHIPS (violet pâle)
          (⚠️ on SUPPRIME le titre “Usages pour cette variété”) */}
      {appleSelected && (
        <View style={{ marginTop: 8 }}>
          <View style={st.pillsWrap}>
            {[
              { key: 'crck' as const, label: 'Cru (croquant)', col: 'appl_crck' },
              { key: 'pie'  as const, label: 'Tarte',          col: 'appl_pie'  },
              { key: 'cpt'  as const, label: 'Compote',        col: 'appl_cpt'  },
            ]
              .map(u => ({ ...u, s: scoreFrom(appleSelected, u.col) }))
              .filter(x => x.s > 0)
              .sort((a, b) => b.s - a.s)
              .map(({ key, label, s }) => {
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
        </View>
      )}

      {/* 6. (Optionnel) Classements sucré/acidulé, inchangés */}
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
  // Sélection usage & intensité
  const [coffeeSelected, setCoffeeSelected] = React.useState<any | null>(null)
  const [intensity, setIntensity] = React.useState<'lght' | 'strng' | 'intense'>('lght')

  // Entrées utilisateur
  const [cups, setCups] = React.useState('')   // Nb tasses
  const [volCl, setVolCl] = React.useState('') // Volume souhaité (cl)

  // ===== Helpers robustes =====
  const clean = (v: any): string =>
    String(v ?? '').trim().replace(/^['"]+|['"]+$/g, '').replace(',', '.')

  const n = (v: any): number | null => {
    const s0 = clean(v)
    if (!s0) return null
    const s = s0.replace(/[^0-9.+-]/g, '')
    if (!s || s === '.' || s === '+' || s === '-') return null
    const x = Number(s)
    return Number.isFinite(x) ? x : null
  }

  const parseRange = (v: any): { min: number; max: number; avg: number } | null => {
    const s = clean(v)
    if (!s) return null
    const m = s.match(/^\s*([0-9]+(?:\.[0-9]+)?)\s*[-–]\s*([0-9]+(?:\.[0-9]+)?)\s*$/)
    if (!m) return null
    const a = Number(m[1])
    const b = Number(m[2])
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null
    const min = Math.min(a, b)
    const max = Math.max(a, b)
    return { min, max, avg: (min + max) / 2 }
  }

  const showNumOrRange = (v: any, unit: string): string => {
    const r = parseRange(v)
    if (r) return `${fmt(r.min)}–${fmt(r.max)} ${unit}`
    const x = n(v)
    return x == null ? '—' : `${fmt(x)} ${unit}`
  }

  const truthy = (v: any) => {
    const s = String(v ?? '').trim().toLowerCase()
    return s === '1' || s === 'true' || s === 'x' || s === 'oui' || s === 'yes'
  }

  // Usages: lignes où is_coffee_use est réellement vrai
  const coffeeUsages = React.useMemo(
    () => (DB as any[]).filter(v => truthy(v?.is_coffee_use)),
    []
  )

  // Facteur g/cl selon intensité
  const gPerCl = (row: any): number => {
    const l = n(row?.coffee_g_per_cl_lght)
    const s = n(row?.coffee_g_per_cl_strng)
    const i = n(row?.coffee_g_per_cl_intense)
    return intensity === 'lght' ? (l ?? 0) : intensity === 'strng' ? (s ?? 0) : (i ?? 0)
  }

  // Poids d'1 c. à café (g)
  const tbspG = (row: any) => n(row?.coffee_spcfc_tbsp_g) ?? 0

  // --- Calculs “Nombre de tasses” ---
  const cupsN = num(cups)

  // Volume d’une tasse (ml) : priorité à coffee_cup_ml ; sinon *10 depuis cl
  const cupMl =
    coffeeSelected
      ? (n(coffeeSelected.coffee_cup_ml) ??
         (n(coffeeSelected.coffee_cup_cl) != null ? (n(coffeeSelected.coffee_cup_cl)! * 10) : 0))
      : 0

  const totalMlFromCups = cupsN * cupMl
  const totalClFromCups = totalMlFromCups / 10

  // Eau et café
  const waterMlFromCups = totalMlFromCups
  const coffeeGFromCups = totalClFromCups * (coffeeSelected ? gPerCl(coffeeSelected) : 0)
  const spoonsFromCups = (tbspG(coffeeSelected) > 0) ? (coffeeGFromCups / tbspG(coffeeSelected)) : 0

  // --- Calculs “Volume souhaité (cl)” ---
  const volClN = num(volCl)
  const coffeeGFromVol = volClN * (coffeeSelected ? gPerCl(coffeeSelected) : 0)
  const spoonsFromVol = (tbspG(coffeeSelected) > 0) ? (coffeeGFromVol / tbspG(coffeeSelected)) : 0

  return (
    <View style={st.section}>
      {/* 1) Choisir un usage */}
      <Text style={st.sTitle}>Choisir un usage</Text>
      <View style={st.pillsWrap}>
        {coffeeUsages
          .map(v => ({ v, name: String(v.label ?? v.id) }))
          .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }))
          .map(({ v, name }) => {
            const on = coffeeSelected?.id === v.id
            return (
              <TouchableOpacity
                key={v.id}
                onPress={() => setCoffeeSelected(v)}
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

      {/* 2) Choisir une intensité */}
      <Text style={[st.sTitle, { marginTop: 8 }]}>Intensité</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {[
          { k: 'lght' as const, label: 'Faible' },
          { k: 'strng' as const, label: 'Fort' },
          { k: 'intense' as const, label: 'Intense' },
        ].map(opt => {
          const on = intensity === opt.k
          return (
            <TouchableOpacity
              key={opt.k}
              onPress={() => setIntensity(opt.k)}
              activeOpacity={0.9}
              style={[st.sizeBtn, on && st.sizeBtnOn]}
            >
              <Text style={[st.sizeBtnText, on && st.sizeBtnTextOn]}>{opt.label}</Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {/* 3) Infos clés */}
     {/* 3) Infos clés */}
{coffeeSelected && (
  <View style={{ marginTop: 8 }}>
    <Text style={st.sTitle}>Infos clés</Text>
    <Row left="Mouture" right={String(coffeeSelected.coffee_mouture ?? '—')} />
    <Row left="1 c. à café" right={`${fmt(tbspG(coffeeSelected))} g`} />
    <Row left="Température de l’eau" right={showNumOrRange(coffeeSelected.coffee_tmp, '°C')} />
    <Row left="Temps d’infusion" right={showNumOrRange(coffeeSelected.coffee_tme, 'min')} />
    <Row
      left="Volume d’une tasse"
      right={
        cupMl
          ? `${fmt(cupMl)} ml  |  ${fmt(cupMl / 10)} cl`
          : '—'
      }
    />
    {/* 👉 Nouvelle ligne : quantité de café par cl */}
    <Row
      left="Café par cl"
      right={
        (() => {
          const val = gPerCl(coffeeSelected)
          const label =
            intensity === 'lght'
              ? 'faible'
              : intensity === 'strng'
              ? 'fort'
              : 'intense'
          return val > 0 ? `${fmt(val)} g/cl (${label})` : '—'
        })()
      }
    />
  </View>
)}

      {/* 4) Barres de conversion */}
      {coffeeSelected && (
        <>
          {/* 4.1 — Nombre de tasses → Eau & Café */}
          <Text style={[st.sTitle, { marginTop: 10 }]}>
            Nombre de tasses souhaitées <Text style={st.arrow}>→</Text> Eau & Café
          </Text>
          <InputWithEcho
            value={cups}
            onChangeText={setCups}
            placeholder="Nombre de tasses (ex: 3)"
            echoLabel="Tasses"
          />
          <Row left="Eau" right={`${fmt(waterMlFromCups)} ml  |  ${fmt(totalClFromCups)} cl`} />
          <Row left="Café" right={`${fmt(coffeeGFromCups)} g`} />
          <Row left="≈ Cuillères à café" right={fmt(spoonsFromCups)} />

          {/* 4.2 — Volume souhaité (cl) → Café */}
          <Text style={[st.sTitle, { marginTop: 10 }]}>
            Volume souhaité (cl) <Text style={st.arrow}>→</Text> Café
          </Text>
          <InputWithEcho
            value={volCl}
            onChangeText={setVolCl}
            placeholder="Volume (cl) — ex: 45"
            echoLabel="Volume (cl)"
          />
          <Row left="Café" right={`${fmt(coffeeGFromVol)} g`} />
          <Row left="≈ Cuillères à café" right={fmt(spoonsFromVol)} />
        </>
      )}
    </View>
  )
}

function PearSection({ d }: { d: Item }) {
  const [qtyEpl, setQtyEpl] = useState('');
  const [qtyNon, setQtyNon] = useState('');
  const [pearSelected, setPearSelected] = useState<any | null>(null);
  const [usageSel, setUsageSel] = useState<null | 'crok' | 'cook' | 'syrup' | 'salt'>(null);

  // Variétés de poires (lignes marquées is_pear)
  const pearVarieties = useMemo(
    () => (DB as any[]).filter(v => isTrue(v?.is_pear)),
    []
  );

  // Rendement générique (issu de l’ingrédient de base)
  const peelYGeneric = getPeelYield(d);

  const star5 = (n: number | null) => {
    const v = n ?? 0;
    if (v <= 0) return '—';
    const r = Math.max(0, Math.min(5, Math.round(v)));
    return '★'.repeat(r);
  };

  const scoreFrom = (row: any, col: string): number =>
    firstInt(row?.[col]) ?? 0;

  return (
    <View style={st.section}>
      {/* 1) Infos clés (génériques) */}
      {peelYGeneric !== null && Number.isFinite(peelYGeneric) && (
        <View style={{ marginBottom: 12 }}>
          <Text style={st.sTitle}>Infos clés</Text>
          <Row
            left={`Taux moyen d'épluchage ${peeledLabelFor(d.id || d.label || '')}`}
            right={`×${fmt(peelYGeneric)}`}
          />
        </View>
      )}

      {/* 2) Épluché ⇆ Non épluché (générique) */}
      {peelYGeneric !== null && Number.isFinite(peelYGeneric) && (
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
          <Row left="Équiv. non épluché" right={fmtAllUnits(num(qtyEpl) / (peelYGeneric || 1))} />

          <InputWithEcho
            value={qtyNon}
            onChangeText={setQtyNon}
            placeholder="Quantité non épluchée (g)"
            echoLabel="Non épluchée (g)"
          />
          <Row left="Équiv. épluché" right={fmtAllUnits(num(qtyNon) * (peelYGeneric || 0))} />
        </View>
      )}

      {/* 3) Choisir un usage */}
      <Text style={[st.sTitle, { marginTop: 16 }]}>Choisir un usage</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        {[
          { key: 'crok' as const,  label: 'À croquer',                 col: 'crok_pear'  },
          { key: 'cook' as const,  label: 'À cuire (desserts chauds)', col: 'cook_pear'  },
          { key: 'syrup' as const, label: 'En conserve / sirop',       col: 'syrup_pear' },
          { key: 'salt' as const,  label: 'En salé',                    col: 'salt_pear'  },
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

      {/* 3b) Variétés compatibles (en CHIPS, avec étoiles) */}
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
                  onPress={() => setPearSelected(prev => (prev?.id === v.id ? null : v))} // toggle
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

      {/* 4) Choisir une variété (liste complète en chips) */}
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
                onPress={() => setPearSelected(prev => (prev?.id === v.id ? null : v))} // toggle
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

      {/* 4b) Quand une variété est sélectionnée : afficher SES usages (en chips, sans titre) + infos spécifiques */}
      {pearSelected && (() => {
        // Spécifiques variété sinon génériques
        const avgUnit =
          toNumMaybe(pearSelected.pear_spcfc_wght) ??
          toNumMaybe(d.avg_unit_g) ?? null;

        const peelYVar =
          toNumMaybe(pearSelected.pear_spcfc_peel) ??
          toNumMaybe(d.peeled_yield) ?? null;

        const dd: Item = {
          ...d,
          ...pearSelected,
          avg_unit_g: avgUnit,
          peeled_yield: peelYVar,
        };

        const avgNon = toNumMaybe(dd.avg_unit_g);
        const peelY  = toNumMaybe(dd.peeled_yield);
        const avgEpl = (avgNon !== null && peelY) ? avgNon * peelY : null;

        // Usages de cette variété (chips avec étoiles) — SANS le titre
        const varietyUsages = [
          { key: 'crok' as const,  label: 'À croquer',                 col: 'crok_pear'  },
          { key: 'cook' as const,  label: 'À cuire (desserts chauds)', col: 'cook_pear'  },
          { key: 'syrup' as const, label: 'En conserve / sirop',       col: 'syrup_pear' },
          { key: 'salt' as const,  label: 'En salé',                    col: 'salt_pear'  },
        ]
          .map(u => ({ ...u, s: scoreFrom(pearSelected, u.col) }))
          .filter(x => x.s > 0)
          .sort((a, b) => b.s - a.s);

        return (
          <View style={{ marginTop: 12 }}>
            {/* Usages de la variété — chips */}
            {varietyUsages.length > 0 && (
              <View style={st.pillsWrap}>
                {varietyUsages.map(({ key, label, s }) => {
                  const on = usageSel === key
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
            )}

            {/* Infos clés spécifiques variété */}
            <Text style={[st.sTitle, { marginTop: 10 }]}>Infos clés</Text>
            {avgNon !== null && <Row left="Poids moyen (1 pièce)" right={`${fmt(avgNon)} g`} />}
            {peelY  !== null && <Row left="Taux d'épluchage" right={`×${fmt(peelY)}`} />}
            {avgEpl !== null && (
              <Row
                left={`Poids épluché ${peeledLabelFor(d.id || d.label || '')}`}
                right={`${fmt(avgEpl)} g`}
              />
            )}

            {/* Épluché ⇆ Non épluché spécifiques si on a un rendement */}
            {peelY !== null && (
              <View style={{ marginTop: 8 }}>
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

            {/* Convertisseurs (Quantité ⇆ Poids) si on a un poids pièce */}
            {toNumMaybe(dd.avg_unit_g) !== null && (
              <GenericConversions d={dd} />
            )}
          </View>
        );
      })()}
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