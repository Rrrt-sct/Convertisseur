// app/results.tsx
import { router, useLocalSearchParams } from 'expo-router'
import React, { useMemo, useState } from 'react'
import { Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { msToMMSS, useTimer } from '../src/timerContext'

// DB statique
// @ts-ignore
const DB = require('../data/ingredients.json') as any[]

// Map d’images (facultatif)
let IMAGES: Record<string, any> = {}
try {
  // génération dans app/imageMap.ts (cas courant)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  IMAGES = require('../src/imageMap').IMAGES || {}
} catch {
  try {
    // génération alternative dans src/imageMap.ts
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    IMAGES = require('../src/imageMap').IMAGES || {}
  } catch {}
}

// -------- Types (commentaires sans caractères spéciaux pour eviter warnings) --------
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

  // Champs pates
  psta_wter?: number | null   // litres d'eau par gramme de pates
  psta_slt?: number | null    // grammes de sel par 100 g d'eau
}

// -------- Helpers --------
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
// Convertit potentiellement string -> number, accepte virgule
function toNumMaybe(v: any): number | null {
  if (v === undefined || v === null || v === '') return null
  const n = Number(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/** Champ avec rappel compact (apparait a droite quand une valeur est presente) */
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

  return (
    <ScrollView
      style={st.container}
      contentContainerStyle={{ padding: 16, paddingTop: 28 }}
    >
      <View style={st.headerRow}>
        <Text style={st.h1}>Convertisseurs</Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity onPress={() => router.push('/timer')}>
            <Text style={st.link}>⏱️ Minuteur</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={st.link}>↩︎ Modifier</Text>
          </TouchableOpacity>
        </View>
      </View>
      {running && (
        <TouchableOpacity
          onPress={() => router.push('/timer')}
          style={st.timerBanner}
          activeOpacity={0.9}
        >
          <Text style={st.timerBannerText}>⏱ Temps restant : {msToMMSS(remainingMs)} — toucher pour ouvrir</Text>
        </TouchableOpacity>
      )}
      {data.length === 0 && <Text>Aucun ingrédient sélectionné.</Text>}

      {data.map(d => (
        <IngredientCard key={d.id} d={d} />
      ))}
    </ScrollView>
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

function IngredientCard({ d }: { d: Item }) {
  // Etats saisies
  // Epluchage (g)
  const [qtyEpl, setQtyEpl] = useState('')
  const [qtyNon, setQtyNon] = useState('')
  // Quantite <-> Poids
  const [countNon, setCountNon] = useState('')
  const [countEpl, setCountEpl] = useState('')
  // Jus
  const [countJuice, setCountJuice] = useState('')
  const [volMl, setVolMl] = useState('')
  // Taille
  const [lengthCm, setLengthCm] = useState('')
  const [lenWeightG, setLenWeightG] = useState('')
  // Cuilleres
  const [tsp, setTsp] = useState('')
  const [tbsp, setTbsp] = useState('')
  const [weightToSpoons, setWeightToSpoons] = useState('')
  // Pates
  const [pastaG, setPastaG] = useState('')
  const [waterL, setWaterL] = useState('')

  // Constantes
  const density = d.density_g_ml ?? 1
  const tsp_g = d.tsp_g ?? (d.tbsp_g ? d.tbsp_g / 3 : null)
  const tbsp_g = d.tbsp_g ?? (tsp_g ? tsp_g * 3 : null)
  // on considère que le module est visible si AU MOINS une des deux valeurs est renseignée
  const pastaW = toNumMaybe(d.psta_wter)
  const pastaS = toNumMaybe(d.psta_slt)
  const hasPasta = (pastaW !== null) || (pastaS !== null)


  return (
    <View style={st.card}>
      {/* Titre + image */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={[st.h2, { flex: 1 }]}>{d.label}</Text>
        {IMAGES[d.id] && (
          <Image source={IMAGES[d.id]} style={{ width: 44, height: 44, marginLeft: 8 }} resizeMode="contain" />
        )}
      </View>

      {/* Infos cles */}
      {(d.avg_unit_g || d.peeled_yield || d.juice_ml_per_unit) && (
        <View style={st.section}>
          <Text style={st.sTitle}>Infos clés</Text>
          {d.avg_unit_g ? <Row left="Poids moyen (1 pièce)" right={`${fmt(d.avg_unit_g)} g`} /> : null}
          {d.peeled_yield && d.avg_unit_g
            ? <Row left={`Poids épluché (×${fmt(d.peeled_yield)})`} right={`${fmt(d.avg_unit_g * d.peeled_yield)} g`} />
            : null}
          {d.juice_ml_per_unit
            ? <Row left="Jus moyen (1 pièce)" right={`${fmt(d.juice_ml_per_unit)} ml (≈ ${fmt(d.juice_ml_per_unit * density)} g)`} />
            : null}
        </View>
      )}

      {/* Epluché ⇆ Non épluché (grammes) */}
      {d.peeled_yield ? (
        <View style={st.section}>
          <Text style={st.sTitle}>Épluché <Text style={st.arrow}>⇆</Text> Non épluché</Text>

          <InputWithEcho
            value={qtyEpl}
            onChangeText={setQtyEpl}
            placeholder="Quantité épluchée (g)"
            echoLabel="Épluché (g)"
          />
          <Row left="Quantité non épluchée" right={fmtAllUnits(num(qtyEpl) / (d.peeled_yield || 1))} />

          <InputWithEcho
            value={qtyNon}
            onChangeText={setQtyNon}
            placeholder="Quantité non épluchée (g)"
            echoLabel="Non épl. (g)"
          />
          <Row left="Quantité épluchée" right={fmtAllUnits(num(qtyNon) * (d.peeled_yield || 1))} />
        </View>
      ) : null}

      {/* Quantité ⇆ Poids */}
      {d.avg_unit_g ? (
        <View style={st.section}>
          <Text style={st.sTitle}>Quantité <Text style={st.arrow}>⇆</Text> Poids</Text>

          <InputWithEcho
            value={countNon}
            onChangeText={setCountNon}
            placeholder="Pièces non épl. (ex: 3)"
            echoLabel="Pièces non épl."
          />
          <Row left="Poids non épluché" right={fmtAllUnits(num(countNon) * (d.avg_unit_g || 0))} />
          {d.peeled_yield
            ? <Row left="Poids épluché" right={fmtAllUnits(num(countNon) * (d.avg_unit_g || 0) * (d.peeled_yield || 1))} />
            : null}

          <InputWithEcho
            value={countEpl}
            onChangeText={setCountEpl}
            placeholder="Pièces épl. (ex: 3)"
            echoLabel="Pièces épl."
          />
          <Row left="Poids non épluché" right={fmtAllUnits(num(countEpl) * (d.avg_unit_g || 0))} />
          {d.peeled_yield
            ? <Row left="Poids épluché" right={fmtAllUnits(num(countEpl) * (d.avg_unit_g || 0) * (d.peeled_yield || 1))} />
            : null}
        </View>
      ) : null}

      {/* Jus */}
      {d.juice_ml_per_unit ? (
        <View style={st.section}>
          <Text style={st.sTitle}>Quantité <Text style={st.arrow}>⇆</Text> Jus</Text>

          <InputWithEcho
            value={countJuice}
            onChangeText={setCountJuice}
            placeholder="Nombre de pièces (ex: 2 citrons)"
            echoLabel="Pièces"
          />
          <Row
            left="Volume"
            right={`${fmt(num(countJuice) * (d.juice_ml_per_unit || 0))} ml  |  ${fmt(num(countJuice) * (d.juice_ml_per_unit || 0) / 10)} cl  |  ${fmt(num(countJuice) * (d.juice_ml_per_unit || 0) / 1000)} l`}
          />

          <InputWithEcho
            value={volMl}
            onChangeText={setVolMl}
            placeholder="Volume ou poids voulu (ml ou g)"
            echoLabel="Voulu"
          />
          <Row left="Nombre de pièces estimé" right={`${fmt(Math.ceil(num(volMl) / (d.juice_ml_per_unit || 1)))} `} />
        </View>
      ) : null}

      {/* Taille ⇆ Poids */}
      {d.lgth_g ? (
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
          <Row left="Longueur estimée" right={`${fmt(num(lenWeightG) / (d.lgth_g || 1))} cm`} />
        </View>
      ) : null}

      {/* Cuillères ⇆ Poids */}
      {(tbsp_g || tsp_g) ? (
        <View style={st.section}>
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

          <Text style={[st.sTitle, { marginTop: 10 }]}>Poids <Text style={st.arrow}>⇆</Text> Cuillères</Text>
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
        </View>
      ) : null}

      {/* Pates */}
      {/* Pâtes → section si au moins une valeur est définie */}
{hasPasta && (
  <View style={st.section}>
    <Text style={st.sTitle}>Pâtes <Text style={st.arrow}>⇆</Text> Eau & Sel</Text>

    {/* Quantité de pâtes → eau + sel */}
    <InputWithEcho
      value={pastaG}
      onChangeText={setPastaG}
      placeholder="Qtité de pâtes (g)"
      echoLabel="Pâtes (g)"
    />
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

    {/* Quantité d'eau → sel */}
    <InputWithEcho
      value={waterL}
      onChangeText={setWaterL}
      placeholder="Quantité d'eau (l)"
      echoLabel="Eau (l)"
    />
    {(() => {
      const L2 = num(waterL)
      const saltG2 = L2 * (pastaS ?? 0) * 100
      return <Row left="Quantité de sel" right={fmtAllUnits(saltG2)} />
    })()}

    {/* 👉 Message si une des 2 valeurs manque */}
    {(pastaW === null || pastaS === null) && (
      <Text style={st.tip}>
        Conseil : renseigne à la fois <Text style={{fontWeight: 'bold'}}>psta_wter</Text> (L/g)
        et <Text style={{fontWeight: 'bold'}}>psta_slt</Text> (g pour 100 g d'eau) dans le CSV pour tout activer.
      </Text>
    )}
  </View>
)}

{/* 👉 Si aucune valeur n'est renseignée, afficher une note (hors section) */}
{!hasPasta && (
  <Text style={[st.tip, { marginTop: 6 }]}>
    Ajoute <Text style={{fontWeight: 'bold'}}>psta_wter</Text> et/ou <Text style={{fontWeight: 'bold'}}>psta_slt</Text> dans ton CSV pour activer le module “Pâtes”.
  </Text>
)}

    </View>
  )
}

// -------- Styles --------
// -------- Styles --------
const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFEEFC' },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  h1: { fontSize: 24, fontWeight: '900', color: '#FF4FA2' },
  link: { color: '#7c3aed', fontWeight: '700' },

  card: { backgroundColor: '#fff', borderRadius: 18, padding: 14, marginBottom: 14, shadowColor: '#FF8FCD', shadowOpacity: 0.16, shadowRadius: 8, elevation: 5 },
  h2: { fontSize: 18, fontWeight: '900', color: '#FF4FA2', marginBottom: 8 },

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
  timerBannerText: {
    color: '#fff',
    fontWeight: '900',
    textAlign: 'center',
  },

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

  tip: { marginTop: 6, color: '#6b7280', fontStyle: 'italic' },
});
