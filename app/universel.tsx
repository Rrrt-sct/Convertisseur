// app/universel.tsx
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

/** ===== Helpers ===== */
const toNum = (s: string): number => {
  const cleaned = (s ?? '')
    .toString()
    .replace(/\u00A0/g, '')  // NBSP
    .replace(/\s+/g, '')     // espaces
    .replace(',', '.')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : NaN
}

// Affichage propre: pas d’espaces de regroupement, décimales utiles, pas de trim “00”
const nf = new Intl.NumberFormat('fr-FR', {
  useGrouping: false,
  maximumFractionDigits: 6,
})
const fmt = (n: number): string => (Number.isFinite(n) ? nf.format(n) : '')
const safeFmt = (n: number) => (Number.isFinite(n) ? fmt(n) : '')

/** ===== Masses (base = gramme) via ratios ===== */
type MassUnit = 'mg' | 'g' | 'kg' | 'oz' | 'lb'
const MASS_LABEL: Record<MassUnit, string> = {
  mg: 'Milligrammes (mg)',
  g: 'Grammes (g)',
  kg: 'Kilogrammes (kg)',
  oz: 'Onces (oz)',
  lb: 'Livres (lb)',
}
// grammes par unité (1 <u> = G_PER[u] grammes)
const G_PER: Record<MassUnit, number> = {
  mg: 0.001,
  g: 1,
  kg: 1000,
  oz: 28.349523125,
  lb: 453.59237,
}
const convertByFactor = <U extends string>(
  value: number,
  from: U,
  to: U,
  factors: Record<U, number>,
) => value * (factors[from] / factors[to])

/** ===== Volumes (base = millilitre) via ratios par système ===== */
const VOL_UNITS = ['ml','cl','l','tsp','tbsp','fl oz','cup','pt','qt','gal'] as const
type VolUnit = typeof VOL_UNITS[number]
type VolSystem = 'metric' | 'us' | 'uk'
const VOL_LABEL: Record<VolUnit, string> = {
  ml: 'Millilitres (ml)',
  cl: 'Centilitres (cl)',
  l:  'Litres (l)',
  tsp: 'Cuillères à café (tsp)',
  tbsp: 'Cuillères à soupe (tbsp)',
  'fl oz': 'Onces fluides (fl oz)',
  cup: 'Tasses (cup)',
  pt: 'Pintes (pt)',
  qt: 'Quarts (qt)',
  gal: 'Gallons (gal)',
}
// mL par unité selon système
const getMlPer = (sys: VolSystem): Record<VolUnit, number> => {
  const common: Record<VolUnit, number> = {
    ml: 1,
    cl: 10,
    l: 1000,
    tsp: NaN,
    tbsp: NaN,
    'fl oz': NaN,
    cup: NaN,
    pt: NaN,
    qt: NaN,
    gal: NaN,
  }
  if (sys === 'us') {
    return {
      ...common,
      tsp: 4.92892159375,
      tbsp: 14.78676478125,
      'fl oz': 29.5735295625,
      cup: 240,
      pt: 473.176473,
      qt: 946.352946,
      gal: 3785.411784,
    }
  }
  if (sys === 'uk') {
    return {
      ...common,
      tsp: 5,
      tbsp: 15,
      'fl oz': 28.4130625,
      cup: 250,
      pt: 568.26125,
      qt: 1136.5225,
      gal: 4546.09,
    }
  }
  return common // metric
}

/** ===== Températures + Thermostat ===== */
const CtoK = (c: number) => c + 273.15
const FtoK = (f: number) => (f - 32) * 5/9 + 273.15
const KtoC = (k: number) => k - 273.15
const KtoF = (k: number) => (k - 273.15) * 9/5 + 32
// Thermostat four (fr) : °C = th × 30
const thToC = (th: number) => th * 30
const cToTh = (c: number) => c / 30

/** ===== Longueurs (base = m) via ratios ===== */
type LenUnit = 'mm' | 'cm' | 'm' | 'km' | 'in' | 'ft' | 'yd' | 'mi'
const LEN_LABEL: Record<LenUnit, string> = {
  mm: 'Millimètres (mm)',
  cm: 'Centimètres (cm)',
  m:  'Mètres (m)',
  km: 'Kilomètres (km)',
  in: 'Pouces (in)',
  ft: 'Pieds (ft)',
  yd: 'Yards (yd)',
  mi: 'Miles (mi)',
}
// mètres par unité
const M_PER: Record<LenUnit, number> = {
  mm: 0.001,
  cm: 0.01,
  m: 1,
  km: 1000,
  in: 0.0254,
  ft: 0.3048,
  yd: 0.9144,
  mi: 1609.344,
}

/** ===== UI ===== */
export default function UniversalConverter(): JSX.Element {
  /** Masses */
  const MassUnits: readonly MassUnit[] = ['mg','g','kg','oz','lb']
  const [mUnitA, setMUnitA] = useState<MassUnit>('g')
  const [mUnitB, setMUnitB] = useState<MassUnit>('oz')
  const [mA, setMA] = useState<string>('')

  /** Volumes */
  const VolUnits: readonly VolUnit[] = VOL_UNITS
  const [volSys, setVolSys] = useState<VolSystem>('us')
  const [vUnitA, setVUnitA] = useState<VolUnit>('ml')
  const [vUnitB, setVUnitB] = useState<VolUnit>('cup')
  const [vA, setVA] = useState<string>('')

  /** Températures + Thermostat */
  const [c, setC] = useState<string>('')   // °C
  const [f, setF] = useState<string>('')   // °F
  const [k, setK] = useState<string>('')   // K
  const [th, setTh] = useState<string>('') // thermostat

  const setFromC = (v: string) => {
    setC(v)
    const n = toNum(v)
    if (!Number.isFinite(n)) { setF(''); setK(''); setTh(''); return }
    const K = CtoK(n)
    setF(fmt(KtoF(K)))
    setK(fmt(K))
    setTh(fmt(cToTh(n)))
  }
  const setFromF = (v: string) => {
    setF(v)
    const n = toNum(v)
    if (!Number.isFinite(n)) { setC(''); setK(''); setTh(''); return }
    const K = FtoK(n)
    const cVal = KtoC(K)
    setC(fmt(cVal))
    setK(fmt(K))
    setTh(fmt(cToTh(cVal)))
  }
  const setFromK = (v: string) => {
    setK(v)
    const n = toNum(v)
    if (!Number.isFinite(n)) { setC(''); setF(''); setTh(''); return }
    const cVal = KtoC(n)
    setC(fmt(cVal))
    setF(fmt(KtoF(n)))
    setTh(fmt(cToTh(cVal)))
  }
  const setFromTh = (v: string) => {
    setTh(v)
    const n = toNum(v)
    if (!Number.isFinite(n)) { setC(''); setF(''); setK(''); return }
    const cVal = thToC(n) // 8 -> 240°C
    const K = CtoK(cVal)
    setC(fmt(cVal))
    setF(fmt(KtoF(K)))
    setK(fmt(K))
  }

  /** Sorties dérivées (calculées à l’affichage) */
  const mOut = (() => {
    const n = toNum(mA)
    if (!Number.isFinite(n)) return ''
    const out = convertByFactor(n, mUnitA, mUnitB, G_PER)
    return safeFmt(out)
  })()

  const vOut = (() => {
    const n = toNum(vA)
    if (!Number.isFinite(n)) return ''
    const ML_PER = getMlPer(volSys)
    if (!Number.isFinite(ML_PER[vUnitA]) || !Number.isFinite(ML_PER[vUnitB])) return ''
    const out = convertByFactor(n, vUnitA, vUnitB, ML_PER)
    return safeFmt(out)
  })()

  const [lenUnitA, setLenUnitA] = useState<LenUnit>('cm')
  const [lenUnitB, setLenUnitB] = useState<LenUnit>('in')
  const [lenA, setLenA] = useState<string>('')
  const lenOut = (() => {
    const n = toNum(lenA)
    if (!Number.isFinite(n)) return ''
    const out = convertByFactor(n, lenUnitA, lenUnitB, M_PER)
    return safeFmt(out)
  })()

  /** Labels */
  const massUnitsLabeled = useMemo(() => MassUnits.map(u => ({ key: u, label: MASS_LABEL[u] })), [])
  const volUnitsLabeled  = useMemo(() => VolUnits.map(u => ({ key: u, label: VOL_LABEL[u] })), [])
  const lenUnitsLabeled  = useMemo(() => (['mm','cm','m','km','in','ft','yd','mi'] as LenUnit[])
    .map(u => ({ key: u, label: LEN_LABEL[u] })), [])

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={st.container} contentContainerStyle={{ padding: 16, paddingTop: 28 }}>
        {/* Header */}
        <View style={st.headerWrap}>
          <Text style={st.h1}>Convertisseur universel</Text>
          <View style={st.actionsWrap}>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={st.actionLink}>↩︎ Retour</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 1) Masses / Poids */}
        <View style={st.card}>
          <Text style={st.sTitle}>Masses / Poids</Text>

          <View style={st.dualCol}>
            <UnitChips role="A" items={massUnitsLabeled} selected={mUnitA} onSelect={setMUnitA} />
            <UnitChips role="B" items={massUnitsLabeled} selected={mUnitB} onSelect={setMUnitB} />
          </View>

          {/* Entrée */}
          <View style={st.row}>
            <Text style={st.k}>{MASS_LABEL[mUnitA]}</Text>
            <TextInput
              style={st.input}
              value={mA}
              onChangeText={setMA}
              placeholder="ex: 850"
              keyboardType="numeric"
              placeholderTextColor="#FF92E0"
            />
          </View>

          {/* Résultat : View + Text (pas de curseur, pas de sélection) */}
          <View style={st.row}>
            <Text style={st.k}>{MASS_LABEL[mUnitB]}</Text>
            <View style={[st.input, st.inputReadonly]}>
              <Text style={st.resultText}>{mOut || '—'}</Text>
            </View>
          </View>
        </View>

        {/* 2) Volumes */}
        <View style={st.card}>
          <Text style={st.sTitle}>Volumes</Text>

          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
            {(['metric','us','uk'] as const).map((s) => {
              const on = volSys === s
              return (
                <TouchableOpacity
                  key={s}
                  onPress={() => setVolSys(s)}
                  activeOpacity={0.9}
                  style={[st.chipSys, on && st.chipSysOn]}
                >
                  <Text style={[st.chipSysTxt, on && st.chipSysTxtOn]}>
                    {s === 'metric' ? 'Métrique' : s.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>

          <View style={st.dualCol}>
            <UnitChips role="A" items={volUnitsLabeled} selected={vUnitA} onSelect={setVUnitA} />
            <UnitChips role="B" items={volUnitsLabeled} selected={vUnitB} onSelect={setVUnitB} />
          </View>

          <View style={st.row}>
            <Text style={st.k}>{VOL_LABEL[vUnitA]}</Text>
            <TextInput
              style={st.input}
              value={vA}
              onChangeText={setVA}
              placeholder="ex: 500"
              keyboardType="numeric"
              placeholderTextColor="#FF92E0"
            />
          </View>
          <View style={st.row}>
            <Text style={st.k}>{VOL_LABEL[vUnitB]}</Text>
            <View style={[st.input, st.inputReadonly]}>
              <Text style={st.resultText}>{vOut || '—'}</Text>
            </View>
          </View>
        </View>

        {/* 3) Températures + Thermostat */}
        <View style={st.card}>
          <Text style={st.sTitle}>Températures</Text>
          <View style={st.row}>
            <Text style={st.k}>Degrés Celsius (°C)</Text>
            <TextInput
              style={st.input}
              value={c}
              onChangeText={setFromC}
              placeholder="ex: 180"
              keyboardType="numeric"
              placeholderTextColor="#FF92E0"
            />
          </View>
          <View style={st.row}>
            <Text style={st.k}>Degrés Fahrenheit (°F)</Text>
            <TextInput
              style={st.input}
              value={f}
              onChangeText={setFromF}
              placeholder="ex: 356"
              keyboardType="numeric"
              placeholderTextColor="#FF92E0"
            />
          </View>
          <View style={st.row}>
            <Text style={st.k}>Kelvin (K)</Text>
            <TextInput
              style={st.input}
              value={k}
              onChangeText={setFromK}
              placeholder="ex: 453.15"
              keyboardType="numeric"
              placeholderTextColor="#FF92E0"
            />
          </View>

          <View style={{ height: 8 }} />
          <Text style={[st.sTitle, { marginBottom: 6 }]}>Thermostat four (≈ ×30 °C)</Text>
          <View style={st.row}>
            <Text style={st.k}>Thermostat</Text>
            <TextInput
              style={st.input}
              value={th}
              onChangeText={setFromTh}
              placeholder="ex: 8"
              keyboardType="numeric"
              placeholderTextColor="#FF92E0"
            />
          </View>
        </View>

        {/* 4) Longueurs */}
        <View style={st.card}>
          <Text style={st.sTitle}>Longueurs</Text>
          <View style={st.dualCol}>
            <UnitChips role="A" items={lenUnitsLabeled} selected={lenUnitA} onSelect={setLenUnitA} />
            <UnitChips role="B" items={lenUnitsLabeled} selected={lenUnitB} onSelect={setLenUnitB} />
          </View>
          <View style={st.row}>
            <Text style={st.k}>{LEN_LABEL[lenUnitA]}</Text>
            <TextInput
              style={st.input}
              value={lenA}
              onChangeText={setLenA}
              placeholder="ex: 10"
              keyboardType="numeric"
              placeholderTextColor="#FF92E0"
            />
          </View>
          <View style={st.row}>
            <Text style={st.k}>{LEN_LABEL[lenUnitB]}</Text>
            <View style={[st.input, st.inputReadonly]}>
              <Text style={st.resultText}>{lenOut || '—'}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

/** ==== Chips d’unité ==== */
type ChipItem<T extends string> = { key: T; label: string }
function UnitChips<T extends string>(props: {
  role: 'A' | 'B'
  items: readonly ChipItem<T>[]
  selected: T
  onSelect: (u: T) => void
}) {
  const { role, items, selected, onSelect } = props
  const isA = role === 'A'
  return (
    <View style={st.chipsRow}>
      {items.map(({ key, label }) => {
        const on = selected === key
        const baseStyle = isA ? st.sizeBtnA : st.sizeBtnB
        const textStyle = isA ? st.sizeBtnTextA : st.sizeBtnTextB
        return (
          <TouchableOpacity
            key={String(key)}
            onPress={() => onSelect(key)}
            activeOpacity={0.9}
            style={[baseStyle, on && st.sizeBtnOnSel]}
          >
            <Text style={[textStyle, on && st.sizeBtnTextOnSel]} numberOfLines={1}>
              {label}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFEEFC' },

  headerWrap: { marginBottom: 12 },
  h1: { fontSize: 24, fontWeight: '900', color: '#FF4FA2' },
  actionsWrap: {
    marginTop: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'center',
  },
  actionLink: { fontWeight: '900', color: '#7c3aed' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    shadowColor: '#FF8FCD',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 2,
    borderColor: '#FFB6F9',
  },

  sTitle: { fontWeight: '900', color: '#444', marginBottom: 8 },

  // rangées alignées quelles que soient les longueurs de libellés
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  k: {
    color: '#57324B',
    fontWeight: '800',
    minWidth: 160,    // un peu plus large pour éviter les retours à la ligne
    maxWidth: 200,    // borne haute pour garder l’alignement
    flexShrink: 1,
  },
  input: {
    flex: 1,
    backgroundColor: '#FFF0FA',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#FFB6F9',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#FF4FA2',
  },
  // "Résultat" : même look que l’input mais non interactif
  inputReadonly: {
    justifyContent: 'center',
    opacity: 0.97,
  },
  resultText: {
    color: '#FF4FA2',
    fontSize: 16,
    fontWeight: '700',
  },

  // Système (volumes)
  chipSys: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#FFB6F9',
    backgroundColor: '#FFE4F6',
  },
  chipSysOn: { borderColor: '#FF4FA2', backgroundColor: '#FF92E0' },
  chipSysTxt: { fontWeight: '800', color: '#FF4FA2' },
  chipSysTxtOn: { color: '#fff' },

  dualCol: { gap: 6, marginBottom: 8 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },

  // Ligne A claire
  sizeBtnA: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#FFB6F9',
    backgroundColor: '#FFE4F6',
  },
  sizeBtnTextA: { fontWeight: '800', color: '#FF4FA2', fontSize: 14 },

  // Ligne B foncée
  sizeBtnB: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#FF4FA2',
    backgroundColor: '#FF92E0',
  },
  sizeBtnTextB: { fontWeight: '800', color: '#fff', fontSize: 14 },

  // Sélection (gris clair)
  sizeBtnOnSel: { backgroundColor: '#EAEAEA', borderColor: '#CFCFCF' },
  sizeBtnTextOnSel: { color: '#333' },
})
