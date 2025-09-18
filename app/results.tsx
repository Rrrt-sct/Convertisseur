// app/results.tsx — refactor: suppression des triggers audio locaux
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
// @ts-ignore
type PdtMethod = typeof PDT_METHODS[number]

function hasVal(v: any) { return v !== undefined && v !== null && String(v).trim() !== '' }

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
function fmt(n: number, digits = 2) {
  if (!isFinite(n)) return '0'
  const r = Number(n.toFixed(digits))
  const s = String(r)
  return /\.\d+$/.test(s) ? s.replace(/\.?0+$/, '') : s
}
function fmtAllUnits(grams: number) {
  const g = Math.max(0, grams || 0)
  const mg = Math.round(g * 1000)
  const kg = g / 1000
  return `${fmt(g)} g  |  ${fmt(mg, 0)} mg  |  ${fmt(kg, 3)} kg`
}
function toNumMaybe(v: any): number | null {
  if (v === undefined || v === null || v === '') return null
  const n = Number(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
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
  const { running, hasRung, remainingMs } = useTimer()
  const { items } = useLocalSearchParams<{ items?: string }>()
  const ids: string[] = useMemo(() => {
    try { return items ? JSON.parse(items) : [] } catch { return [] }
  }, [items])

  const data: Item[] = useMemo(() => {
    const map = Object.fromEntries((DB as Item[]).map(d => [d.id, d]))
    return ids.map(id => map[id]).filter(Boolean)
  }, [ids])

  // ⚠️ IMPORTANT : AUCUN déclenchement de son ici.
  // Le contexte (timerContext) s'en charge. On affiche seulement l'état.
  const showBanner = running || remainingMs > 0 || hasRung

  // Modal d’info global (pour usages pâtes)
  const [infoModal, setInfoModal] = useState<{ title: string; text: string } | null>(null)

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={st.container} contentContainerStyle={{ padding: 16, paddingTop: 28 }}>
        <View style={st.headerRow}>
          <Text style={st.h1}>Convertisseurs</Text>
          <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
            <TouchableOpacity onPress={() => router.push('/timer')}>
              <Text style={st.navLink}>⏱️ Minuteur</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={st.navLink}>↩︎ Modifier</Text>
            </TouchableOpacity>
          </View>
        </View>

        {showBanner && (
          <TouchableOpacity onPress={() => router.push('/timer')} style={[st.timerBanner, !running && hasRung && st.timerBannerDone]} activeOpacity={0.9}>
            <Text style={st.timerBannerText}>
              {running ? `⏱ Temps restant : ${msToMMSS(remainingMs)} — toucher pour ouvrir` : '✅ Minuteur terminé — toucher pour ouvrir'}
            </Text>
          </TouchableOpacity>
        )}

        {data.length === 0 && <Text>Aucun ingrédient sélectionné.</Text>}

        {data.map(d => (
          <IngredientCard key={d.id} d={d} openInfo={(title, text) => setInfoModal({ title, text })} />
        ))}
      </ScrollView>

      {/* Overlay d’info */}
      {infoModal && (
        <View style={st.infoOverlay} pointerEvents="box-none">
          <Pressable style={st.infoBackdrop} onPress={() => setInfoModal(null)} />
          <View style={st.infoCard}>
            <View style={st.infoHeader}>
              <Text style={st.infoTitle}>{infoModal.title}</Text>
              <TouchableOpacity onPress={() => setInfoModal(null)} style={st.closeBtn} activeOpacity={0.9}>
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
  if (d.peeled_yield && d.avg_unit_g) {
    infoRows.push(<Row key="peeled" left={`Poids ${EPL.toLowerCase()} (×${fmt(d.peeled_yield)})`} right={`${fmt((d.avg_unit_g || 0) * (d.peeled_yield || 1))} g`} />)
  }
  if (d.juice_ml_per_unit) {
    infoRows.push(<Row key="juice" left="Jus moyen (1 pièce)" right={`${fmt(d.juice_ml_per_unit)} ml (≈ ${fmt((d.juice_ml_per_unit || 0) * density)} g)`} />)
  }


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
  const y = toNumMaybe(d.peeled_yield)
  if (!y || y <= 0) return null

  // à partir d’un poids ÉPLUCHÉ, on remonte le NON ÉPLUCHÉ : non = epl / y
  const nonFromEpl = num(qtyEpl) / y
  // à partir d’un poids NON ÉPLUCHÉ, on calcule l’ÉPLUCHÉ : epl = non * y
  const eplFromNon = num(qtyNon) * y

  return (
    <View style={st.section}>
      <Text style={st.sTitle}>
        Épluché <Text style={st.arrow}>⇆</Text> Non épluché
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
      {/* ... (reste inchangé) ... */}
    </View>
  )
}

/* ===================== Styles ===================== */
const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFEEFC' },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  h1: { fontSize: 24, fontWeight: '900', color: '#FF4FA2' },

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
  timerBannerDone: { backgroundColor: '#88e29c' },
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
})
