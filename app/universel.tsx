// app/universel.tsx
// Convertisseur universel : masses, volumes (US/UK), longueurs, températures, métrique ↔ impérial,
// et poids ↔ volume via densité
import { router } from 'expo-router'
import React, { useMemo, useState } from 'react'
import {
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native'

// ---------- Helpers ----------
const onlyDigitsDot = (s: string) => s.replace(/[^0-9.,-]/g, '').replace(',', '.')
const num = (s: string) => {
  const n = Number(onlyDigitsDot(s))
  return Number.isFinite(n) ? n : 0
}
const fmt = (n: number, d = 3) => {
  if (!Number.isFinite(n)) return '0'
  const s = n.toFixed(d)
  return s.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1')
}

// ---------- Units & factors ----------
// Base: g for mass
const MASS_FACTORS: Record<string, number> = {
  mg: 0.001,
  g: 1,
  kg: 1000,
  oz: 28.349523125, // avoirdupois ounce
  lb: 453.59237,
}
const MASS_LABELS: Record<string, string> = { mg: 'mg', g: 'g', kg: 'kg', oz: 'oz', lb: 'lb' }
const MASS_ORDER = ['mg', 'g', 'kg', 'oz', 'lb'] as const

// Volumes base mL; factors depend on US vs UK (Imperial)
const VOL_FACTORS_US = {
  ml: 1,
  l: 1000,
  tsp: 4.92892159375,   // teaspoon (US)
  tbsp: 14.78676478125, // tablespoon (US)
  floz: 29.5735295625,  // fluid ounce (US)
  cup: 236.5882365,     // US legal cup
  pt: 473.176473,       // pint (US)
  qt: 946.352946,       // quart (US)
  gal: 3785.411784,     // gallon (US)
} as const
const VOL_FACTORS_UK = {
  ml: 1,
  l: 1000,
  tsp: 5,                // teaspoon (metric in UK kitchens)
  tbsp: 15,              // tablespoon (metric in UK kitchens)
  floz: 28.4130625,      // imperial fluid ounce
  cup: 250,              // metric cup (commune au UK/AU; l'impérial strict n'a pas de "cup")
  pt: 568.26125,         // pint (imperial)
  qt: 1136.5225,         // quart (imperial)
  gal: 4546.09,          // gallon (imperial)
} as const
const VOL_LABELS: Record<string, string> = {
  ml: 'ml', l: 'l', tsp: 'c. à café (tsp)', tbsp: 'c. à soupe (tbsp)', floz: 'fl oz', cup: 'cup', pt: 'pint', qt: 'quart', gal: 'gallon',
}
const VOL_ORDER = ['ml', 'l', 'tsp', 'tbsp', 'floz', 'cup', 'pt', 'qt', 'gal'] as const

// Lengths base metre
const LEN_FACTORS: Record<string, number> = {
  mm: 0.001,
  cm: 0.01,
  m: 1,
  in: 0.0254,
  ft: 0.3048,
  yd: 0.9144,
}
const LEN_LABELS: Record<string, string> = { mm: 'mm', cm: 'cm', m: 'm', in: 'in', ft: 'ft', yd: 'yd' }
const LEN_ORDER = ['mm', 'cm', 'm', 'in', 'ft', 'yd'] as const

// ---------- Converters ----------
function convertMass(value: number, from: string): Record<string, number> {
  const base = value * (MASS_FACTORS[from] ?? 1)
  const out: Record<string, number> = {}
  MASS_ORDER.forEach(u => { out[u] = base / MASS_FACTORS[u] })
  return out
}
function convertVol(value: number, from: string, system: 'US' | 'UK'): Record<string, number> {
  const FACT = system === 'US' ? VOL_FACTORS_US : VOL_FACTORS_UK
  const base = value * (FACT[from as keyof typeof FACT] ?? 1)
  const out: Record<string, number> = {}
  VOL_ORDER.forEach(u => { out[u] = base / FACT[u as keyof typeof FACT] })
  return out
}
function convertLen(value: number, from: string): Record<string, number> {
  const base = value * (LEN_FACTORS[from] ?? 1)
  const out: Record<string, number> = {}
  LEN_ORDER.forEach(u => { out[u] = base / LEN_FACTORS[u] })
  return out
}

// Temperature conversions
function cFromAny(v: number, unit: 'C'|'F'|'K') {
  if (unit === 'C') return v
  if (unit === 'F') return (v - 32) * 5/9
  return v - 273.15 // K
}
function tAll(value: number, from: 'C'|'F'|'K') {
  const C = cFromAny(value, from)
  const F = C * 9/5 + 32
  const K = C + 273.15
  return { C, F, K }
}

// ----- UI small atoms -----
function Input({ value, onChangeText, placeholder }: { value: string; onChangeText: (t: string) => void; placeholder: string }) {
  return (
    <TextInput
      style={st.input}
      keyboardType="numeric"
      value={value}
      onChangeText={(t) => onChangeText(onlyDigitsDot(t))}
      placeholder={placeholder}
      placeholderTextColor="#ff8fcd"
    />
  )
}

function Segmented<T extends string>({ options, value, onChange }: { options: { label: string; value: T }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={st.segmentWrap}>
      {options.map(opt => {
        const on = value === opt.value
        return (
          <TouchableOpacity key={opt.value} onPress={() => onChange(opt.value)} activeOpacity={0.9} style={[st.segmentBtn, on && st.segmentBtnOn]}>
            <Text style={[st.segmentTxt, on && st.segmentTxtOn]} numberOfLines={1}>{opt.label}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

// ---------- Screen ----------
export default function UniversalConverter() {
  // Volume system
  const [volSystem, setVolSystem] = useState<'US'|'UK'>('US')

  // Mass
  const [massVal, setMassVal] = useState('')
  const [massUnit, setMassUnit] = useState<(typeof MASS_ORDER)[number]>('g')
  const massRes = useMemo(() => convertMass(num(massVal), massUnit), [massVal, massUnit])

  // Volume
  const [volVal, setVolVal] = useState('')
  const [volUnit, setVolUnit] = useState<(typeof VOL_ORDER)[number]>('ml')
  const volRes = useMemo(() => convertVol(num(volVal), volUnit, volSystem), [volVal, volUnit, volSystem])

  // Length
  const [lenVal, setLenVal] = useState('')
  const [lenUnit, setLenUnit] = useState<(typeof LEN_ORDER)[number]>('cm')
  const lenRes = useMemo(() => convertLen(num(lenVal), lenUnit), [lenVal, lenUnit])

  // Temperature
  const [tVal, setTVal] = useState('')
  const [tUnit, setTUnit] = useState<'C'|'F'|'K'>('C')
  const tRes = useMemo(() => tAll(num(tVal), tUnit), [tVal, tUnit])

  // Weight ↔ Volume with density (g/mL)
  const [density, setDensity] = useState('1') // default eau ~1 g/mL
  const [w2vVal, setW2vVal] = useState('') // grams
  const [v2wVal, setV2wVal] = useState('') // mL

  const dens = Math.max(0, num(density) || 0)
  const w2v_mL = dens > 0 ? num(w2vVal) / dens : 0
  const v2w_g = dens > 0 ? num(v2wVal) * dens : 0

  const volNote = volSystem === 'UK'
    ? 'Système UK : cuillère = 5/15 mL, fl oz imp = 28,41 mL, pint imp = 568 mL (cup = 250 mL par convention).'
    : 'Système US : tsp = 4,93 mL, tbsp = 14,79 mL, fl oz = 29,57 mL, cup = 236,59 mL.'

  return (
    <ScrollView style={st.container} contentContainerStyle={{ padding: 16, paddingTop: 28 }}>
      <View style={st.headerRow}>
        <Text style={st.h1}>Convertisseur universel</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={st.navLink}>↩︎ Retour</Text>
        </TouchableOpacity>
      </View>

      {/* ===== Volumes ===== */}
      <View style={st.card}>
        <Text style={st.h2}>Volumes</Text>
        <Segmented options={[{label:'US', value:'US'},{label:'UK', value:'UK'}]} value={volSystem} onChange={setVolSystem} />
        <View style={st.rowGap}>
          <Input value={volVal} onChangeText={setVolVal} placeholder="Entrez une quantité" />
          <Segmented
            options={VOL_ORDER.map(u => ({ label: VOL_LABELS[u], value: u }))}
            value={volUnit}
            onChange={setVolUnit}
          />
        </View>
        <View style={st.resWrap}>
          {VOL_ORDER.map((u) => (
            <View key={u} style={st.resRow}>
              <Text style={st.k}>{VOL_LABELS[u]}</Text>
              <Text style={st.v}>{fmt(volRes[u] ?? 0)}</Text>
            </View>
          ))}
        </View>
        <Text style={st.helpTxt}>{volNote}</Text>
      </View>

      {/* ===== Masses ===== */}
      <View style={st.card}>
        <Text style={st.h2}>Masses</Text>
        <View style={st.rowGap}>
          <Input value={massVal} onChangeText={setMassVal} placeholder="Entrez une quantité" />
          <Segmented
            options={MASS_ORDER.map(u => ({ label: MASS_LABELS[u], value: u }))}
            value={massUnit}
            onChange={setMassUnit}
          />
        </View>
        <View style={st.resWrap}>
          {MASS_ORDER.map((u) => (
            <View key={u} style={st.resRow}>
              <Text style={st.k}>{MASS_LABELS[u]}</Text>
              <Text style={st.v}>{fmt(massRes[u] ?? 0)}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ===== Longueurs ===== */}
      <View style={st.card}>
        <Text style={st.h2}>Longueurs</Text>
        <View style={st.rowGap}>
          <Input value={lenVal} onChangeText={setLenVal} placeholder="Entrez une longueur" />
          <Segmented
            options={LEN_ORDER.map(u => ({ label: LEN_LABELS[u], value: u }))}
            value={lenUnit}
            onChange={setLenUnit}
          />
        </View>
        <View style={st.resWrap}>
          {LEN_ORDER.map((u) => (
            <View key={u} style={st.resRow}>
              <Text style={st.k}>{LEN_LABELS[u]}</Text>
              <Text style={st.v}>{fmt(lenRes[u] ?? 0)}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ===== Températures ===== */}
      <View style={st.card}>
        <Text style={st.h2}>Températures</Text>
        <View style={st.rowGap}>
          <Input value={tVal} onChangeText={setTVal} placeholder="Entrez une température" />
          <Segmented options={[{label:'°C', value:'C'},{label:'°F', value:'F'},{label:'K', value:'K'}]} value={tUnit} onChange={setTUnit} />
        </View>
        <View style={st.resWrap}>
          <View style={st.resRow}><Text style={st.k}>°C</Text><Text style={st.v}>{fmt(tRes.C, 2)}</Text></View>
          <View style={st.resRow}><Text style={st.k}>°F</Text><Text style={st.v}>{fmt(tRes.F, 2)}</Text></View>
          <View style={st.resRow}><Text style={st.k}>K</Text><Text style={st.v}>{fmt(tRes.K, 2)}</Text></View>
        </View>
      </View>

      {/* ===== Poids ↔ Volume (avec densité) ===== */}
      <View style={st.card}>
        <Text style={st.h2}>Poids ⇆ Volume (avec densité)</Text>
        <Text style={st.sub}>Densité (g/mL) — ex : eau = 1, huile ≈ 0,92, miel ≈ 1,42</Text>
        <Input value={density} onChangeText={setDensity} placeholder="1" />

        <View style={st.dualRow}>
          <View style={{ flex: 1 }}>
            <Text style={st.sTitle}>Poids → Volume</Text>
            <Input value={w2vVal} onChangeText={setW2vVal} placeholder="Poids (g)" />
            <KV k="Volume estimé" v={`${fmt(w2v_mL)} mL | ${fmt(w2v_mL / 1000)} L`} />
          </View>
          <View style={{ width: 14 }} />
          <View style={{ flex: 1 }}>
            <Text style={st.sTitle}>Volume → Poids</Text>
            <Input value={v2wVal} onChangeText={setV2wVal} placeholder="Volume (mL)" />
            <KV k="Poids estimé" v={`${fmt(v2w_g)} g | ${fmt(v2w_g / 1000)} kg`} />
          </View>
        </View>
      </View>

      {/* ===== Raccourcis métrique ↔ impérial ===== */}
      <View style={st.card}>
        <Text style={st.h2}>Métrique ↔ Impérial (raccourcis)</Text>
        <View style={st.quickGrid}>
          <QuickRow labelLeft="Gramme → Once" leftUnit="g" rightUnit="oz" factorLeftToRight={1 / (MASS_FACTORS.oz)} />
          <QuickRow labelLeft="Kilogramme → Livre" leftUnit="kg" rightUnit="lb" factorLeftToRight={MASS_FACTORS.kg / MASS_FACTORS.lb} />
          <QuickRow labelLeft="Millilitre → fl oz (US)" leftUnit="ml" rightUnit="fl oz" factorLeftToRight={1 / VOL_FACTORS_US.floz} />
          <QuickRow labelLeft="Millilitre → fl oz (UK)" leftUnit="ml" rightUnit="fl oz imp" factorLeftToRight={1 / VOL_FACTORS_UK.floz} />
          <QuickRow labelLeft="Litre → pint (US)" leftUnit="l" rightUnit="pt" factorLeftToRight={1000 / VOL_FACTORS_US.pt} />
          <QuickRow labelLeft="Litre → pint (UK)" leftUnit="l" rightUnit="pt imp" factorLeftToRight={1000 / VOL_FACTORS_UK.pt} />
        </View>
        <Text style={st.helpTxt}>Astuce : chaque rangée est bidirectionnelle (saisissez à gauche ou à droite).</Text>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <View style={st.resRow}>
      <Text style={st.k}>{k}</Text>
      <Text style={st.v}>{v}</Text>
    </View>
  )
}

function QuickRow({ labelLeft, leftUnit, rightUnit, factorLeftToRight }: { labelLeft: string; leftUnit: string; rightUnit: string; factorLeftToRight: number }) {
  const [left, setLeft] = useState('')
  const [right, setRight] = useState('')

  const onLeft = (t: string) => {
    const v = num(t)
    setLeft(onlyDigitsDot(t))
    setRight(v || v === 0 ? (t.trim() === '' ? '' : fmt(v * factorLeftToRight)) : '')
  }
  const onRight = (t: string) => {
    const v = num(t)
    setRight(onlyDigitsDot(t))
    setLeft(v || v === 0 ? (t.trim() === '' ? '' : fmt(v / factorLeftToRight)) : '')
  }

  return (
    <View style={st.quickRow}>
      <Text style={st.k}>{labelLeft}</Text>
      <View style={st.bidirWrap}>
        <TextInput value={left} onChangeText={onLeft} keyboardType="numeric" placeholder={`en ${leftUnit}`} placeholderTextColor="#ff8fcd" style={[st.input, { flex: 1 }]} />
        <Text style={st.arrow}>⇆</Text>
        <TextInput value={right} onChangeText={onRight} keyboardType="numeric" placeholder={`en ${rightUnit}`} placeholderTextColor="#ff8fcd" style={[st.input, { flex: 1 }]} />
      </View>
    </View>
  )
}

// ---------- Styles ----------
const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFEEFC' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingHorizontal: 16 },
  h1: { fontSize: 24, fontWeight: '900', color: '#FF4FA2' },
  navLink: { color: '#7c3aed', fontWeight: '900', fontSize: 18 },

  card: { backgroundColor: '#fff', borderRadius: 18, padding: 14, marginHorizontal: 16, marginBottom: 14, shadowColor: '#FF8FCD', shadowOpacity: 0.16, shadowRadius: 8, elevation: 5 },
  h2: { fontSize: 18, fontWeight: '900', color: '#FF4FA2', marginBottom: 8 },
  sub: { color: '#57324B', fontWeight: '600', marginBottom: 6 },
  helpTxt: { color: '#8a587c', fontStyle: 'italic', marginTop: 6 },

  rowGap: { gap: 10 },

  resWrap: { marginTop: 8, gap: 6 },
  resRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 },
  k: { color: '#555', fontWeight: '700' },
  v: { color: '#222', fontWeight: '900' },

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

  segmentWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  segmentBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 2, borderColor: '#FFB6F9', backgroundColor: '#FFE4F6' },
  segmentBtnOn: { borderColor: '#FF4FA2', backgroundColor: '#FF92E0' },
  segmentTxt: { color: '#FF4FA2', fontWeight: '800' },
  segmentTxtOn: { color: '#fff' },

  quickGrid: { gap: 10 },
  quickRow: { marginTop: 6 },
  bidirWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  arrow: { fontSize: 18, fontWeight: '900', color: '#FF4FA2' },

  dualRow: { flexDirection: 'row', marginTop: 8 },
})
