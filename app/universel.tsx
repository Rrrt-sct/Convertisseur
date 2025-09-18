import { router } from 'expo-router'
import React, { useState } from 'react'
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
  const n = Number((s ?? '').toString().replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}
const fmt = (n: number, d = 3): string => {
  if (!Number.isFinite(n)) return '—'
  const x = Number(n.toFixed(d))
  const s = String(x)
  return s.replace(/\.?0+$/, '')
}

/** ====== Masses/Poids (mg, g, kg, oz, lb) ====== */
// base: g
type MassUnit = 'mg' | 'g' | 'kg' | 'oz' | 'lb'
const massToG = (u: MassUnit, v: number): number => {
  switch (u) {
    case 'mg': return v / 1000
    case 'g':  return v
    case 'kg': return v * 1000
    case 'oz': return v * 28.349523125
    case 'lb': return v * 453.59237
  }
}
const gToMass = (u: MassUnit, g: number): number => {
  switch (u) {
    case 'mg': return g * 1000
    case 'g':  return g
    case 'kg': return g / 1000
    case 'oz': return g / 28.349523125
    case 'lb': return g / 453.59237
  }
}

/** ====== Volumes (métrique + US/UK) ====== */
// base: mL
const ML_PER_CL = 10
const L_TO_ML = 1000
// US
const US_TSP_TO_ML  = 4.92892159375
const US_TBSP_TO_ML = US_TSP_TO_ML * 3
const US_CUP_TO_ML  = 240 // valeur culinaire usuelle
const US_FL_OZ_TO_ML = 29.5735295625
const US_PINT_TO_ML  = 473.176473
const US_QUART_TO_ML = 946.352946
const US_GAL_TO_ML   = 3785.411784
// UK (Impérial)
const UK_FL_OZ_TO_ML = 28.4130625
const UK_PINT_TO_ML  = 568.26125
const UK_QUART_TO_ML = 1136.5225
const UK_GAL_TO_ML   = 4546.09

const VOL_UNITS = ['ml','cl','l','tsp','tbsp','fl oz','cup','pt','qt','gal'] as const
type VolUnit = typeof VOL_UNITS[number]
type VolSystem = 'metric' | 'us' | 'uk'

const volToMl = (sys: VolSystem, u: VolUnit, v: number): number => {
  if (u === 'ml') return v
  if (u === 'cl') return v * ML_PER_CL
  if (u === 'l')  return v * L_TO_ML
  if (sys === 'us') {
    switch (u) {
      case 'tsp':   return v * US_TSP_TO_ML
      case 'tbsp':  return v * US_TBSP_TO_ML
      case 'fl oz': return v * US_FL_OZ_TO_ML
      case 'cup':   return v * US_CUP_TO_ML
      case 'pt':    return v * US_PINT_TO_ML
      case 'qt':    return v * US_QUART_TO_ML
      case 'gal':   return v * US_GAL_TO_ML
      default: return NaN
    }
  } else if (sys === 'uk') {
    switch (u) {
      case 'tsp':   return v * 5 // usage pratique
      case 'tbsp':  return v * 15
      case 'fl oz': return v * UK_FL_OZ_TO_ML
      case 'cup':   return v * 250 // repère général
      case 'pt':    return v * UK_PINT_TO_ML
      case 'qt':    return v * UK_QUART_TO_ML
      case 'gal':   return v * UK_GAL_TO_ML
      default: return NaN
    }
  }
  return NaN
}
const mlToVol = (sys: VolSystem, u: VolUnit, ml: number): number => {
  if (u === 'ml') return ml
  if (u === 'cl') return ml / ML_PER_CL
  if (u === 'l')  return ml / L_TO_ML
  if (sys === 'us') {
    switch (u) {
      case 'tsp':   return ml / US_TSP_TO_ML
      case 'tbsp':  return ml / US_TBSP_TO_ML
      case 'fl oz': return ml / US_FL_OZ_TO_ML
      case 'cup':   return ml / US_CUP_TO_ML
      case 'pt':    return ml / US_PINT_TO_ML
      case 'qt':    return ml / US_QUART_TO_ML
      case 'gal':   return ml / US_GAL_TO_ML
      default: return NaN
    }
  } else if (sys === 'uk') {
    switch (u) {
      case 'tsp':   return ml / 5
      case 'tbsp':  return ml / 15
      case 'fl oz': return ml / UK_FL_OZ_TO_ML
      case 'cup':   return ml / 250
      case 'pt':    return ml / UK_PINT_TO_ML
      case 'qt':    return ml / UK_QUART_TO_ML
      case 'gal':   return ml / UK_GAL_TO_ML
      default: return NaN
    }
  }
  return NaN
}

/** ====== Températures (°C ⇆ °F ⇆ K) + Thermostat ====== */
const CtoK = (c: number) => c + 273.15
const FtoK = (f: number) => (f - 32) * 5/9 + 273.15
const KtoC = (k: number) => k - 273.15
const KtoF = (k: number) => (k - 273.15) * 9/5 + 32
// Thermostat four (approx française courante) : °C ≈ th × 30
const thToC = (th: number) => th * 30
const cToTh = (c: number) => c / 30

/** ====== Longueurs (mm, cm, m, in, ft) ====== */
// base: m
type LenUnit = 'mm' | 'cm' | 'm' | 'in' | 'ft'
const lenToM = (unit: LenUnit, v: number): number => {
  switch (unit) {
    case 'mm': return v / 1000
    case 'cm': return v / 100
    case 'm':  return v
    case 'in': return v * 0.0254
    case 'ft': return v * 0.3048
  }
}
const mToLen = (unit: LenUnit, m: number): number => {
  switch (unit) {
    case 'mm': return m * 1000
    case 'cm': return m * 100
    case 'm':  return m
    case 'in': return m / 0.0254
    case 'ft': return m / 0.3048
  }
}

/** ====== UI ====== */
export default function UniversalConverter(): JSX.Element {
  /** Masses */
  const MassUnits: readonly MassUnit[] = ['mg','g','kg','oz','lb']
  const [mUnitA, setMUnitA] = useState<MassUnit>('g')
  const [mUnitB, setMUnitB] = useState<MassUnit>('oz')
  const [mA, setMA] = useState<string>('')
  const [mB, setMB] = useState<string>('')
  const syncMassFromA = (v: string) => {
    setMA(v)
    const n = toNum(v)
    if (!Number.isFinite(n)) { setMB(''); return }
    const g = massToG(mUnitA, n)
    setMB(fmt(gToMass(mUnitB, g)))
  }
  const syncMassFromB = (v: string) => {
    setMB(v)
    const n = toNum(v)
    if (!Number.isFinite(n)) { setMA(''); return }
    const g = massToG(mUnitB, n)
    setMA(fmt(gToMass(mUnitA, g)))
  }

  /** Volumes */
  const VolUnits: readonly VolUnit[] = VOL_UNITS
  const [volSys, setVolSys] = useState<VolSystem>('us') // 'metric' | 'us' | 'uk'
  const [vUnitA, setVUnitA] = useState<VolUnit>('ml')
  const [vUnitB, setVUnitB] = useState<VolUnit>('cup')
  const [vA, setVA] = useState<string>('')
  const [vB, setVB] = useState<string>('')
  const syncVolFromA = (val: string, unit?: VolUnit) => {
    const u = unit ?? vUnitA
    setVA(val)
    const n = toNum(val)
    if (!Number.isFinite(n)) { setVB(''); return }
    const ml = volToMl(volSys, u, n)
    setVB(fmt(mlToVol(volSys, vUnitB, ml)))
  }
  const syncVolFromB = (val: string, unit?: VolUnit) => {
    const u = unit ?? vUnitB
    setVB(val)
    const n = toNum(val)
    if (!Number.isFinite(n)) { setVA(''); return }
    const ml = volToMl(volSys, u, n)
    setVA(fmt(mlToVol(volSys, vUnitA, ml)))
  }
  const onChangeVolSystem = (sys: VolSystem) => {
    setVolSys(sys)
    if (vA) syncVolFromA(vA)
    else if (vB) syncVolFromB(vB)
  }

  /** Températures + Thermostat */
  const [c, setC] = useState<string>('')   // °C
  const [f, setF] = useState<string>('')   // °F
  const [k, setK] = useState<string>('')   // Kelvin
  const [th, setTh] = useState<string>('') // thermostat
  const setFromC = (v: string) => {
    setC(v)
    const n = toNum(v)
    if (!Number.isFinite(n)) { setF(''); setK(''); setTh(''); return }
    const K = CtoK(n)
    setF(fmt(KtoF(K)))
    setK(fmt(K))
    setTh(fmt(cToTh(n), 2))
  }
  const setFromF = (v: string) => {
    setF(v)
    const n = toNum(v)
    if (!Number.isFinite(n)) { setC(''); setK(''); setTh(''); return }
    const K = FtoK(n)
    const cVal = KtoC(K)
    setC(fmt(cVal))
    setK(fmt(K))
    setTh(fmt(cToTh(cVal), 2))
  }
  const setFromK = (v: string) => {
    setK(v)
    const n = toNum(v)
    if (!Number.isFinite(n)) { setC(''); setF(''); setTh(''); return }
    const cVal = KtoC(n)
    setC(fmt(cVal))
    setF(fmt(KtoF(n)))
    setTh(fmt(cToTh(cVal), 2))
  }
  const setFromTh = (v: string) => {
    setTh(v)
    const n = toNum(v)
    if (!Number.isFinite(n)) { setC(''); setF(''); setK(''); return }
    const cVal = thToC(n)
    const K = CtoK(cVal)
    setC(fmt(cVal))
    setF(fmt(KtoF(K)))
    setK(fmt(K))
  }

  /** Longueurs */
  const LenUnits: readonly LenUnit[] = ['mm','cm','m','in','ft']
  const [lenUnitA, setLenUnitA] = useState<LenUnit>('cm')
  const [lenUnitB, setLenUnitB] = useState<LenUnit>('in')
  const [lenA, setLenA] = useState<string>('')
  const [lenB, setLenB] = useState<string>('')
  const syncLenFromA = (v: string) => {
    setLenA(v)
    const n = toNum(v)
    if (!Number.isFinite(n)) { setLenB(''); return }
    const m = lenToM(lenUnitA, n)
    setLenB(fmt(mToLen(lenUnitB, m)))
  }
  const syncLenFromB = (v: string) => {
    setLenB(v)
    const n = toNum(v)
    if (!Number.isFinite(n)) { setLenA(''); return }
    const m = lenToM(lenUnitB, n)
    setLenA(fmt(mToLen(lenUnitA, m)))
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={st.container} contentContainerStyle={{ padding: 16, paddingTop: 28 }}>
        {/* Header compact avec actions wrap */}
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
            {/* Entrée = clair */}
            <UnitChips
              units={MassUnits}
              sel={mUnitA}
              onSel={(u) => { setMUnitA(u); if (mA) syncMassFromA(mA) }}
              variant="input"
            />
            {/* Sortie = foncé */}
            <UnitChips
              units={MassUnits}
              sel={mUnitB}
              onSel={(u) => { setMUnitB(u); if (mB) syncMassFromB(mB) }}
              variant="output"
            />
          </View>
          <View style={st.row}>
            <Text style={st.k}>{mUnitA}</Text>
            <TextInput
              style={st.input}
              value={mA}
              onChangeText={syncMassFromA}
              placeholder="ex: 250"
              keyboardType="numeric"
            />
          </View>
          <View style={st.row}>
            <Text style={st.k}>{mUnitB}</Text>
            <TextInput
              style={st.input}
              value={mB}
              onChangeText={syncMassFromB}
              placeholder="ex: 8.82"
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* 2) Volumes */}
        <View style={st.card}>
          <Text style={st.sTitle}>Volumes</Text>

          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
            {(['metric','us','uk'] as const).map((s) => {
              const on = volSys === s
              return (
                <TouchableOpacity key={s} onPress={() => onChangeVolSystem(s)} activeOpacity={0.9} style={[st.sizeBtn, on && st.sizeBtnOn]}>
                  <Text style={[st.sizeBtnText, on && st.sizeBtnTextOn]}>
                    {s === 'metric' ? 'Métrique' : s.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>

          <View style={st.dualCol}>
            {/* Entrée = clair */}
            <UnitChips
              units={VolUnits}
              sel={vUnitA}
              onSel={(u) => { setVUnitA(u); if (vA) syncVolFromA(vA, u) }}
              variant="input"
            />
            {/* Sortie = foncé */}
            <UnitChips
              units={VolUnits}
              sel={vUnitB}
              onSel={(u) => { setVUnitB(u); if (vB) syncVolFromB(vB, u) }}
              variant="output"
            />
          </View>

          <View style={st.row}>
            <Text style={st.k}>{vUnitA}</Text>
            <TextInput
              style={st.input}
              value={vA}
              onChangeText={(t) => syncVolFromA(t)}
              placeholder="ex: 500"
              keyboardType="numeric"
            />
          </View>
          <View style={st.row}>
            <Text style={st.k}>{vUnitB}</Text>
            <TextInput
              style={st.input}
              value={vB}
              onChangeText={(t) => syncVolFromB(t)}
              placeholder="ex: 2.08"
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* 3) Températures + Thermostat */}
        <View style={st.card}>
          <Text style={st.sTitle}>Températures</Text>
          <View style={st.row}>
            <Text style={st.k}>°C</Text>
            <TextInput style={st.input} value={c} onChangeText={setFromC} placeholder="ex: 180" keyboardType="numeric" />
          </View>
          <View style={st.row}>
            <Text style={st.k}>°F</Text>
            <TextInput style={st.input} value={f} onChangeText={setFromF} placeholder="ex: 356" keyboardType="numeric" />
          </View>
          <View style={st.row}>
            <Text style={st.k}>K</Text>
            <TextInput style={st.input} value={k} onChangeText={setFromK} placeholder="ex: 453.15" keyboardType="numeric" />
          </View>

          <View style={{ height: 8 }} />
          <Text style={[st.sTitle, { marginBottom: 6 }]}>Thermostat four (≈ ×30 °C)</Text>
          <View style={st.row}>
            <Text style={st.k}>Th.</Text>
            <TextInput style={st.input} value={th} onChangeText={setFromTh} placeholder="ex: 6" keyboardType="numeric" />
          </View>
        </View>

        {/* 4) Longueurs */}
        <View style={st.card}>
          <Text style={st.sTitle}>Longueurs</Text>
          <View style={st.dualCol}>
            {/* Entrée = clair */}
            <UnitChips
              units={LenUnits}
              sel={lenUnitA}
              onSel={(u) => { setLenUnitA(u); if (lenA) syncLenFromA(lenA) }}
              variant="input"
            />
            {/* Sortie = foncé */}
            <UnitChips
              units={LenUnits}
              sel={lenUnitB}
              onSel={(u) => { setLenUnitB(u); if (lenB) syncLenFromB(lenB) }}
              variant="output"
            />
          </View>
          <View style={st.row}>
            <Text style={st.k}>{lenUnitA}</Text>
            <TextInput style={st.input} value={lenA} onChangeText={syncLenFromA} placeholder="ex: 10" keyboardType="numeric" />
          </View>
          <View style={st.row}>
            <Text style={st.k}>{lenUnitB}</Text>
            <TextInput style={st.input} value={lenB} onChangeText={syncLenFromB} placeholder="ex: 3.94" keyboardType="numeric" />
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

type UnitChipsProps<T extends string> = {
  units: readonly T[]
  sel: T
  onSel: (u: T) => void
  /** 'input' => clair par défaut, 'output' => foncé par défaut */
  variant?: 'input' | 'output'
}

function UnitChips<T extends string>({
  units,
  sel,
  onSel,
  variant = 'input',
}: UnitChipsProps<T>): JSX.Element {
  const isInput = variant === 'input'
  return (
    <View style={st.chipsRow}>
      {units.map((u) => {
        const selected = sel === u

        // style par défaut (selon input/output)
        const baseChip = isInput ? st.chipLight : st.chipDark
        const baseTxt  = isInput ? st.chipLightTxt : st.chipDarkTxt

        // si sélectionné → override gris
        const chipStyle = selected ? st.chipSelected : baseChip
        const txtStyle  = selected ? st.chipSelectedTxt : baseTxt

        return (
          <TouchableOpacity
            key={u}
            onPress={() => onSel(u)}
            activeOpacity={0.9}
            style={[st.chip, chipStyle]}
          >
            <Text style={[st.chipTxt, txtStyle]}>{u}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}


const st = StyleSheet.create({
  
  // gris clair pour l’état sélectionné
chipSelected:   { backgroundColor: '#E5E7EB', borderColor: '#D1D5DB' }, // gray-200 / gray-300
chipSelectedTxt:{ color: '#374151' }, // gray-700
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

  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 },
  k: { color: '#57324B', fontWeight: '800', minWidth: 56 },
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

  // empile les 2 colonnes de chips sur mobile
  dualCol: { gap: 6, marginBottom: 8 },

  // ===== Chips (unités) : clair / foncé + inversion à la sélection =====
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },

  chip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 2,
  },
  chipTxt: { fontWeight: '800', fontSize: 14 },

  // clair (entrée)
  chipLight: { backgroundColor: '#FFE4F6', borderColor: '#FFB6F9' },
  chipLightTxt: { color: '#FF4FA2' },

  // foncé (sortie)
  chipDark: { backgroundColor: '#FF92E0', borderColor: '#FF4FA2' },
  chipDarkTxt: { color: '#fff' },

  // Boutons pill "système" (on garde l'ancien style)
  sizeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#FFB6F9',
    backgroundColor: '#FFE4F6',
  },
  sizeBtnOn: { borderColor: '#FF4FA2', backgroundColor: '#FF92E0' },
  sizeBtnText: { fontWeight: '800', color: '#FF4FA2', fontSize: 14 },
  sizeBtnTextOn: { color: '#fff' },
  // gris clair pour chips sélectionnées
chipSelected: {
  backgroundColor: '#E5E7EB', // gray-200
  borderColor: '#D1D5DB',     // gray-300
},
chipSelectedTxt: {
  color: '#374151',           // gray-700
},
})
