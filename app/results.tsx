// app/results.tsx
import { Audio } from 'expo-av'
import { router, useLocalSearchParams } from 'expo-router'
import React, { useEffect, useMemo, useState } from 'react'
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

// Map d’images (facultatif)
let IMAGES: Record<string, any> = {}
try {
  IMAGES = require('../src/imageMap').IMAGES || {}
} catch {
  try { IMAGES = require('./imageMap').IMAGES || {} } catch {}
}

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
type PdtMethod = typeof PDT_METHODS[number]

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

// ---- Textes explicatifs PDT (raccourcis ici) ----
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

// -------- Types --------
type Item = {
  id: string
  label: string
  avg_unit_g: number | null
  peeled_yield: number | null
  juice_ml_per_unit: number | null
  lgth_g: number | null
  tbsp_g: number | null
  tsp_g: number | null
  density_g_ml?: number | null

  // pâtes
  psta_wter?: number | null
  psta_slt?: number | null

  // œufs
  egg_s?: number | null
  egg_m?: number | null
  egg_l?: number | null
  whte_pctge?: number | null
  ylw_pctge?: number | null

  // pommes de terre
  wght_pdt_s?: number | null
  wght_pdt_m?: number | null
  wght_pdt_l?: number | null

  // céleri
  clr_lgth?: number | null

  // genre pour accord
  genre?: string | null
  gender?: string | null

  // thé
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
const hasVal = (v: any) => v !== undefined && v !== null && String(v).trim() !== ''

/** Récupère le 1er entier présent dans une cellule (ex: "8#xx" -> 8) */
function firstInt(v: any): number | null {
  if (!hasVal(v)) return null
  const m = String(v).match(/(\d+)/)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) ? n : null
}
/** Parse "info_sls" -> map numero -> texte (formats acceptés: "8:txt;9:autre" ou "8=txt | 9=...") */
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
/** Texte d'info pour un usage donné */
function infoTextFor(row: any, num: number): string {
  const map = parseInfoMap(row?.info_sls)
  if (map[num]) return map[num]
  const txt = String(row?.info_sls ?? '').trim()
  return txt
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

export default function Results() {
  const { running, remainingMs, finishCount } = useTimer()
  const { items } = useLocalSearchParams<{ items?: string }>()
  const ids: string[] = useMemo(() => {
    try { return items ? JSON.parse(items) : [] } catch { return [] }
  }, [items])

  const data: Item[] = useMemo(() => {
    const map = Object.fromEntries((DB as Item[]).map(d => [d.id, d]))
    return ids.map(id => map[id]).filter(Boolean)
  }, [ids])

  // 🔔 Minuteur
  useEffect(() => {
    let mounted = true
    async function ding() {
      try {
        const { sound } = await Audio.Sound.createAsync(
          require('../assets/sounds/bell.mp3'),
          { shouldPlay: true, volume: 1.0 }
        )
        sound.setOnPlaybackStatusUpdate((s) => {
          // @ts-ignore
          if (!mounted) return
          // @ts-ignore
          if (s && 'didJustFinish' in s && s.didJustFinish) {
            sound.unloadAsync().catch(() => {})
          }
        })
      } catch {}
    }
    if (finishCount > 0) ding()
    return () => { mounted = false }
  }, [finishCount])

  // -------- Modal d’info global (levé ici pour couvrir tout l’écran) --------
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

        {running && (
          <TouchableOpacity onPress={() => router.push('/timer')} style={st.timerBanner} activeOpacity={0.9}>
            <Text style={st.timerBannerText}>⏱ Temps restant : {msToMMSS(remainingMs)} — toucher pour ouvrir</Text>
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

function Row({ left, right }: { left: string; right: string }) {
  return (
    <View style={st.row}>
      <Text style={st.k}>{left}</Text>
      <Text style={st.v}>{right}</Text>
    </View>
  )
}

/** Champ avec rappel compact */
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

/** Petit bouton “i” réutilisable */
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

/** Tip (utilisé dans plusieurs sections) */
function Tip({ children }: { children: React.ReactNode }) {
  return (
    <View style={st.tipBox}>
      <Text style={st.tipEmoji}>💡</Text>
      <Text style={st.tipText}>{children}</Text>
    </View>
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
  const [pastaUsageSelId, setPastaUsageSelId] = useState<string | null>(null) // sélection d’un usage
  const [pastaSelected, setPastaSelected] = useState<any | null>(null)        // sélection d’une variété

  // Ids / flags
  const normId = (d.id || d.label || '').toString().toLowerCase().replace(/\s+/g, '_')
  const isPotato = ['pomme_de_terre', 'pommes_de_terre', 'pdt'].includes(normId)
  const isCelery = normId === 'celeri'
  const isPasta = ['pates', 'pâtes', 'pasta'].includes(normId)

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
  const celeryG = toNumMaybe((d as any).clr_lgth) ?? null
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
    infoRows.push(<Row key="peeled" left={`Poids ${EPL.toLowerCase()} (×${fmt(d.peeled_yield)})`} right={`${fmt(d.avg_unit_g * d.peeled_yield)} g`} />)
  }
  if (d.juice_ml_per_unit) {
    infoRows.push(<Row key="juice" left="Jus moyen (1 pièce)" right={`${fmt(d.juice_ml_per_unit)} ml (≈ ${fmt(d.juice_ml_per_unit * density)} g)`} />)
  }
  const showTip = !!(d.peeled_yield && !d.avg_unit_g)

  /* ----- Variétés de PDT (is_pdt = 1) ----- */
  const pdtVarieties = useMemo(() => (DB as any[]).filter(v => Number(v?.is_pdt) === 1), [])

  /* ----- Variétés de pâtes (au moins un pst_* rempli) ----- */
  const pastaVarieties = useMemo(() => {
    const hasAnyPst = (row: any) =>
      ['pst_lg', 'pst_shrt', 'pst_sml', 'pst_flf', 'pst_ovn'].some((k) => hasVal(row?.[k]))
    return (DB as any[]).filter(v => hasAnyPst(v))
  }, [])

  /* ----- Usages de pâtes (au moins un pfct_* rempli) ----- */
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

  const hasInfo = (row: any, num?: number) => {
    const raw = String(row?.info_sls ?? '').trim()
    if (!raw) return false
    if (typeof num === 'number') {
      const m = parseInfoMap(raw)
      const picked = m[num]
      return Boolean((picked ?? raw).trim())
    }
    return true
  }

  /* ===== RENDER ===== */
  return (
    <View style={st.card}>
      {/* Titre + image */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={[st.h2, { flex: 1 }]}>{d.label}</Text>
        {IMAGES[d.id] && <Image source={IMAGES[d.id]} style={{ width: 44, height: 44, marginLeft: 8 }} resizeMode="contain" />}
      </View>

      {(infoRows.length > 0 || showTip) && (
        <View style={st.section}>
          <Text style={st.sTitle}>Infos clés</Text>
          {showTip && (
            <Tip>
              Avec <Text style={st.tipStrong}>100 g</Text> de {d.label} non {EPL.toLowerCase()},
              vous obtiendrez <Text style={st.tipStrong}>{fmt(100 * (d.peeled_yield || 1))} g</Text> de {d.label} {EPL.toLowerCase()}.
            </Tip>
          )}
          {infoRows}
        </View>
      )}

      {/* ========= Module Œufs ========= */}
      {(() => {
        if (!hasEggs) return null
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
              const sumPct = (whitePct ?? 0) + (yolkPct ?? 0)
              const denom = (eggUnit || 0) * sumPct
              const eggs = denom > 0 ? Math.ceil(num(eggTargetTotal) / denom) : 0
              return <Row left="Nombre d'œufs estimés" right={`${eggs} œufs`} />
            })()}

            <InputWithEcho value={eggTargetWhite} onChangeText={setEggTargetWhite} placeholder="Poids voulu Blancs (g)" echoLabel="Blancs (g)" />
            {(() => {
              const denom = (eggUnit || 0) * (whitePct ?? 0)
              const eggs = denom > 0 ? Math.ceil(num(eggTargetWhite) / denom) : 0
              return <Row left="Nombre d'œufs estimés" right={`${eggs} œufs`} />
            })()}

            <InputWithEcho value={eggTargetYolk} onChangeText={setEggTargetYolk} placeholder="Poids voulu Jaune (g)" echoLabel="Jaune (g)" />
            {(() => {
              const denom = (eggUnit || 0) * (yolkPct ?? 0)
              const eggs = denom > 0 ? Math.ceil(num(eggTargetYolk) / denom) : 0
              return <Row left="Nombre d'œufs estimés" right={`${eggs} œufs`} />
            })()}
          </View>
        )
      })()}

      {/* --------- Pommes de terre --------- */}
      {isPotato && (
        <View style={st.section}>
          <Text style={st.sTitle}>Choisir un usage</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {PDT_METHODS.map(m => {
              const on = pdtMethod?.label === m.label
              return (
                <TouchableOpacity
                  key={m.label}
                  onPress={() => { setPdtMethod(prev => (prev?.label === m.label ? null : m)); setPdtSelected(null) }}
                  activeOpacity={0.9}
                  style={[st.sizeBtn, on && st.sizeBtnOn]}
                >
                  <Text style={[st.sizeBtnText, on && st.sizeBtnTextOn]}>{m.label}</Text>
                </TouchableOpacity>
              )
            })}
          </View>

          {pdtMethod?.label && PdtAdvice[pdtMethod.label] ? (
            <View style={{ marginBottom: 10 }}>{PdtAdvice[pdtMethod.label]}</View>
          ) : null}

          <Text style={[st.sTitle, { marginBottom: 6 }]}>Choisir une variété</Text>

          {(() => {
            let list: Array<{ v: any; s: number }>
            if (!pdtMethod) {
              list = (DB as any[]).filter(v => Number(v?.is_pdt) === 1).map(v => ({ v, s: 0 }))
                .sort((a, b) => String(a.v.label ?? a.v.pdt_variety ?? a.v.id).localeCompare(String(b.v.label ?? b.v.pdt_variety ?? b.v.id), 'fr', { sensitivity: 'base' }))
            } else {
              list = (DB as any[]).filter(v => Number(v?.is_pdt) === 1).map(v => ({ v, s: scoreFor(v, pdtMethod!) }))
                .filter(x => x.s >= 1)
                .sort((a, b) => b.s - a.s || String(a.v.label ?? a.v.pdt_variety ?? a.v.id).localeCompare(String(b.v.label ?? b.v.pdt_variety ?? b.v.id), 'fr', { sensitivity: 'base' }))
            }

            return list.length > 0 ? (
              <View style={st.pillsWrap}>
                {list.map(({ v, s }) => {
                  const name = String(v.label ?? v.pdt_variety ?? v.id)
                  const on = pdtSelected?.id === v.id
                  return (
                    <TouchableOpacity key={v.id} onPress={() => setPdtSelected(v)} activeOpacity={0.9} style={[st.pill, on && st.pillOn]}>
                      {IMAGES[v.id] ? <Image source={IMAGES[v.id]} style={{ width: 18, height: 18, marginRight: 6, borderRadius: 4 }} /> : null}
                      <Text style={[st.pillText, on && st.pillTextOn]} numberOfLines={1}>{name}</Text>
                      {pdtMethod && s > 0 ? <Text style={st.pillBadge}>{starsFor(s)}</Text> : null}
                    </TouchableOpacity>
                  )
                })}
              </View>
            ) : (
              <Text style={{ color: '#666' }}>{pdtMethod ? `Aucune variété référencée pour ${pdtMethod.label.toLowerCase()}.` : 'Aucune variété trouvée.'}</Text>
            )
          })()}

          {pdtSelected && (
            <View style={{ marginTop: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                {IMAGES[pdtSelected.id] ? <Image source={IMAGES[pdtSelected.id]} style={{ width: 56, height: 56, borderRadius: 12 }} /> : null}
                <Tip>Variété : <Text style={st.tipStrong}>{String(pdtSelected.label ?? pdtSelected.pdt_variety ?? pdtSelected.id)}</Text></Tip>
              </View>
              {!!pdtSelected.pdt_texture && (<Row left="Chair" right={String(pdtSelected.pdt_texture)} />)}
              <View style={{ marginTop: 8, gap: 4 }}>
                {PDT_METHODS.map(m => {
                  const s = scoreFor(pdtSelected, m)
                  if (s < 1) return null
                  return <Row key={m.label} left={m.label} right={`${starsFor(s)} ${verdictFor(s)}`} />
                })}
              </View>
            </View>
          )}
        </View>
      )}

      {/* --------- Module PÂTES --------- */}
      {isPasta && (
        <View style={st.section}>
          {/* 1) Infos clés eau/sel */}
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
            if (pastaUsages.length === 0) {
              return <Text style={{ color: '#666' }}>Aucun usage configuré.</Text>
            }

            // Regroupement par numéro
            const groups: Record<number, typeof pastaUsages> = {}
            for (const u of pastaUsages) {
              groups[u.num] = groups[u.num] ? [...groups[u.num], u] : [u]
            }
            const nums = Object.keys(groups).map(n => Number(n)).sort((a, b) => a - b)

            // Mode "sélectionné" : masquer les autres usages
            if (pastaUsageSelId) {
              const u = pastaUsages.find(x => x.row.id === pastaUsageSelId)
              if (!u) return null
              const n = u.num
              const color = PALETTE9[(n - 1) % PALETTE9.length]
              const text = u.row.label || `Usage ${n}`
              const infoTxt = infoTextFor(u.row, u.num).trim()
              const showInfo = hasInfo(u.row, u.num)

              return (
                <View style={st.pillsWrap}>
                  <TouchableOpacity
                    key={u.row.id}
                    activeOpacity={0.9}
                    onPress={() => setPastaUsageSelId(null)}
                    style={[st.pill, { borderColor: color, backgroundColor: color }]}
                  >
                    {IMAGES[u.row.id] ? <Image source={IMAGES[u.row.id]} style={{ width: 18, height: 18, marginRight: 6, borderRadius: 4 }} /> : null}
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
                    const showInfo = hasInfo(u.row, u.num)
                    return (
                      <TouchableOpacity
                        key={u.row.id}
                        activeOpacity={0.9}
                        onPress={() => setPastaUsageSelId(prev => prev === u.row.id ? null : u.row.id)}
                        style={[st.pill, { borderColor: color, backgroundColor: '#FFE4F6' }]}
                      >
                        {IMAGES[u.row.id] ? <Image source={IMAGES[u.row.id]} style={{ width: 18, height: 18, marginRight: 6, borderRadius: 4 }} /> : null}
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

          {/* VARIÉTÉS compatibles POUR L’USAGE SÉLECTIONNÉ (indépendant de "Choisir une variété") */}
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
                    {list.map(({ v, name }) => (
                      <TouchableOpacity key={v.id} activeOpacity={0.9} style={st.pill} onPress={() => setPastaSelected(v)}>
                        {IMAGES[v.id] ? <Image source={IMAGES[v.id]} style={{ width: 18, height: 18, marginRight: 6, borderRadius: 4 }} /> : null}
                        <Text style={st.pillText} numberOfLines={1}>{name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )
          })()}

          {/* 3) Choisir une variété — TOUJOURS toutes les variétés (indépendant des usages) */}
          <Text style={[st.sTitle, { marginBottom: 6, marginTop: 8 }]}>Choisir une variété</Text>
          {(() => {
            const allList = pastaVarieties
              .map(v => ({ v, name: String(v.label ?? v.pasta_variety ?? v.id) }))
              .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }))

            return (
              <>
                <View style={st.pillsWrap}>
                  {allList.map(({ v, name }) => (
                    <TouchableOpacity key={v.id} activeOpacity={0.9} style={st.pill} onPress={() => setPastaSelected(v)}>
                      {IMAGES[v.id] ? <Image source={IMAGES[v.id]} style={{ width: 18, height: 18, marginRight: 6, borderRadius: 4 }} /> : null}
                      <Text style={st.pillText} numberOfLines={1}>{name}</Text>
                    </TouchableOpacity>
                  ))}
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
                          const showInfo = hasInfo(u.row, u.num)
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
      )}

      {/* --------- Conversions PDT --------- */}
      {isPotato && hasPdt && (
        <View style={st.section}>
          {d.peeled_yield ? (
            <View>
              <Text style={st.sTitle}>{EPL} <Text style={st.arrow}>⇆</Text> {NON_EPL}</Text>
              <InputWithEcho value={qtyEpl} onChangeText={setQtyEpl} placeholder={`Quantité ${EPL.toLowerCase()} (g)`} echoLabel={`${EPL} (g)`} />
              <Row left={`Quantité ${NON_EPL_SHORT}`} right={fmtAllUnits(num(qtyEpl) / (d.peeled_yield || 1))} />
              <InputWithEcho value={qtyNon} onChangeText={setQtyNon} placeholder={`Quantité ${NON_EPL.toLowerCase()} (g)`} echoLabel={`${NON_EPL} (g)`} />
              <Row left={`Quantité ${EPL.toLowerCase()}`} right={fmtAllUnits(num(qtyNon) * (d.peeled_yield || 1))} />
            </View>
          ) : null}

          <View style={{ marginTop: 8 }}>
            <Text style={st.sTitle}>Infos clés</Text>
            {pdtS !== null && <Row left="Petite pomme de terre (S)" right={`${fmt(pdtS)} g`} />}
            {pdtM !== null && <Row left="Pomme de terre moyenne (M)" right={`${fmt(pdtM)} g`} />}
            {pdtL !== null && <Row left="Grosse pomme de terre (L)" right={`${fmt(pdtL)} g`} />}
          </View>

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
            {(['S', 'M', 'L'] as const).map(sz => {
              const on = pdtSize === sz
              return (
                <TouchableOpacity key={sz} onPress={() => setPdtSize(sz)} activeOpacity={0.9} style={[st.sizeBtn, on && st.sizeBtnOn]}>
                  <Text style={[st.sizeBtnText, on && st.sizeBtnTextOn]}>{sz}</Text>
                </TouchableOpacity>
              )
            })}
          </View>

          {pdtUnit > 0 ? (
            <View style={{ marginTop: 12 }}>
              <Text style={st.sTitle}>Quantité <Text style={st.arrow}>⇆</Text> Poids</Text>

              <InputWithEcho value={pdtWeightEpl} onChangeText={setPdtWeightEpl} placeholder="Poids épl. (g)" echoLabel="Épl. (g)" />
              {(() => {
                const y = d.peeled_yield ?? null
                const unitEpl = y ? pdtUnit * y : pdtUnit
                const pieces = Math.max(0, Math.ceil(num(pdtWeightEpl) / Math.max(1, unitEpl)))
                return <Row left="Nombre de pièces estimées" right={`${pieces} pièces`} />
              })()}

              <InputWithEcho value={pdtWeightNon} onChangeText={setPdtWeightNon} placeholder="Poids non épl. (g)" echoLabel="Non épl. (g)" />
              <Row left="Nombre de pièces estimées" right={`${Math.max(0, Math.ceil(num(pdtWeightNon) / Math.max(1, pdtUnit)))} pièces`} />

              <InputWithEcho value={countNon} onChangeText={setCountNon} placeholder="Pièces non épl. (ex: 3)" echoLabel="Pièces non épl." />
              <Row left="Poids estimé non épluché" right={fmtAllUnits(num(countNon) * pdtUnit)} />
              {d.peeled_yield ? <Row left={`Poids estimé ${EPL.toLowerCase()}`} right={fmtAllUnits(num(countNon) * pdtUnit * (d.peeled_yield || 1))} /> : null}

              <InputWithEcho value={countEpl} onChangeText={setCountEpl} placeholder="Pièces épl. (ex: 3)" echoLabel="Pièces épl." />
              <Row left="Poids estimé non épluché" right={fmtAllUnits(num(countEpl) * pdtUnit)} />
              {d.peeled_yield ? <Row left={`Poids estimé ${EPL.toLowerCase()}`} right={fmtAllUnits(num(countEpl) * pdtUnit * (d.peeled_yield || 1))} /> : null}
            </View>
          ) : null}
        </View>
      )}

      {/* Quantité ⇆ Poids — générique (non-PDT, non-Pâtes) */}
      {!isPotato && !isPasta && d.avg_unit_g ? (
        <View style={st.section}>
          <Text style={st.sTitle}>Quantité <Text style={st.arrow}>⇆</Text> Poids</Text>
          <InputWithEcho value={genWeightEpl} onChangeText={setGenWeightEpl} placeholder="Poids épl. (g)" echoLabel="Épl. (g)" />
          {(() => {
            const unitEpl = (d.peeled_yield ? d.avg_unit_g! * d.peeled_yield : d.avg_unit_g!) || 0
            const pieces = unitEpl > 0 ? Math.ceil(num(genWeightEpl) / unitEpl) : 0
            return <Row left="Nombre de pièces estimées" right={`${pieces} pièces`} />
          })()}
          <InputWithEcho value={genWeightNon} onChangeText={setGenWeightNon} placeholder="Poids non épl. (g)" echoLabel="Non épl. (g)" />
          {(() => {
            const unitNon = d.avg_unit_g || 0
            const pieces = unitNon > 0 ? Math.ceil(num(genWeightNon) / unitNon) : 0
            return <Row left="Nombre de pièces estimées" right={`${pieces} pièces`} />
          })()}
          <InputWithEcho value={countNon} onChangeText={setCountNon} placeholder="Pièces non épl. (ex: 3)" echoLabel="Pièces non épl." />
          <Row left="Poids non épluché" right={fmtAllUnits(num(countNon) * (d.avg_unit_g || 0))} />
          {d.peeled_yield ? <Row left={`Poids ${EPL.toLowerCase()}`} right={fmtAllUnits(num(countNon) * (d.avg_unit_g || 0) * (d.peeled_yield || 1))} /> : null}
        </View>
      ) : null}

      {/* Céleri */}
      {isCelery && (
        <View style={st.section}>
          <Text style={st.sTitle}>Infos clés</Text>
          <Row left="1 branche de céleri" right={`${fmt(celeryG!)} g`} />
          <Text style={[st.sTitle, { marginTop: 8 }]}>Nombre de branches <Text style={st.arrow}>⇆</Text> Poids</Text>
          <InputWithEcho value={celeryBranches} onChangeText={setCeleryBranches} placeholder="Nb de branches (ex: 2)" echoLabel="Branches" />
          <Row left="Poids estimé" right={fmtAllUnits(num(celeryBranches) * (celeryG || 0))} />
          <InputWithEcho value={celeryWeight} onChangeText={setCeleryWeight} placeholder="Poids (ex: 200 g)" echoLabel="Poids (g)" />
          <Row left="Nombre de branches estimé" right={`${Math.ceil(num(celeryWeight) / Math.max(1, (celeryG || 0)))} branches`} />
        </View>
      )}

      {/* Jus */}
      {d.juice_ml_per_unit ? (
        <View style={st.section}>
          <Text style={st.sTitle}>Quantité <Text style={st.arrow}>⇆</Text> Jus</Text>
          <InputWithEcho value={countJuice} onChangeText={setCountJuice} placeholder="Nombre de pièces (ex: 2 citrons)" echoLabel="Pièces" />
          <Row left="Volume" right={`${fmt(num(countJuice) * (d.juice_ml_per_unit || 0))} ml  |  ${fmt(num(countJuice) * (d.juice_ml_per_unit || 0) / 10)} cl  |  ${fmt(num(countJuice) * (d.juice_ml_per_unit || 0) / 1000)} l`} />
          <InputWithEcho value={volMl} onChangeText={setVolMl} placeholder="Volume ou poids voulu (ml ou g)" echoLabel="Voulu" />
          <Row left="Nombre de pièces estimé" right={`${fmt(Math.ceil(num(volMl) / (d.juice_ml_per_unit || 1)))} `} />
        </View>
      ) : null}

      {/* Taille ⇆ Poids */}
      {d.lgth_g ? (
        <View style={st.section}>
          <Text style={st.sTitle}>Taille <Text style={st.arrow}>⇆</Text> Poids</Text>
          <InputWithEcho value={lengthCm} onChangeText={setLengthCm} placeholder="Longueur (cm)" echoLabel="Longueur (cm)" />
          <Row left="Poids estimé" right={`${fmt(num(lengthCm) * (d.lgth_g || 0))} g`} />
          <InputWithEcho value={lenWeightG} onChangeText={setLenWeightG} placeholder="Poids (g)" echoLabel="Poids (g)" />
          <Row left="Longueur estimée" right={`${fmt(num(lenWeightG) / (d.lgth_g || 1))} cm`} />
        </View>
      ) : null}

      {/* Cuillères ⇆ Poids */}
      {(tbsp_g || tsp_g) ? (
        <View style={st.section}>
          <Text style={st.sTitle}>Cuillères <Text style={st.arrow}>⇆</Text> Poids</Text>
          <InputWithEcho value={tsp} onChangeText={setTsp} placeholder="Cuillères à café (ex: 2)" echoLabel="c. à café" />
          <Row left="Poids" right={fmtAllUnits(num(tsp) * (tsp_g || 0))} />
          <InputWithEcho value={tbsp} onChangeText={setTbsp} placeholder="Cuillères à soupe (ex: 2)" echoLabel="c. à soupe" />
          <Row left="Poids" right={fmtAllUnits(num(tbsp) * (tbsp_g || 0))} />
          <InputWithEcho value={weightToSpoons} onChangeText={setWeightToSpoons} placeholder="Poids (g) — ex: 15" echoLabel="Poids (g)" />
          <Row left="Équivalent" right={`${tsp_g ? `${fmt(num(weightToSpoons) / tsp_g, 2)} c. à café` : '— c. à café'}   |   ${tbsp_g ? `${fmt(num(weightToSpoons) / tbsp_g, 2)} c. à soupe` : '— c. à soupe'}`} />
        </View>
      ) : null}

      {/* Pâtes — eau & sel */}
      {hasPasta && (
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
      )}
    </View>
  )
}

// -------- Styles --------
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

  // Tip
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
  tipEmoji: { fontSize: 16, marginTop: 1 },
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
  pillOn: { backgroundColor: '#FF92E0', borderColor: '#FF4FA2' },
  pillText: { color: '#FF4FA2', fontWeight: '800', maxWidth: 180 },
  pillTextOn: { color: '#fff' },
  pillBadge: { marginLeft: 6, fontWeight: '900', color: '#7a6680' },

  // Info button
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
