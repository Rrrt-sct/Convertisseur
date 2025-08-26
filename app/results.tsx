// app/results.tsx
import { Audio } from 'expo-av'
import { router, useLocalSearchParams } from 'expo-router'
import React, { useEffect, useMemo, useState } from 'react'
import { Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, Vibration, View } from 'react-native'
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

  // céleri (poids d'une branche)
  clr_lgth?: number | null
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
function toNumMaybe(v: any): number | null {
  if (v === undefined || v === null || v === '') return null
  const n = Number(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/** Champ avec rappel compact (apparait à droite quand une valeur est présente) */
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
  const { running, remainingMs, finishCount } = useTimer()
  const { items } = useLocalSearchParams<{ items?: string }>()
  const ids: string[] = useMemo(() => {
    try { return items ? JSON.parse(items) : [] } catch { return [] }
  }, [items])

  const data: Item[] = useMemo(() => {
    const map = Object.fromEntries((DB as Item[]).map(d => [d.id, d]))
    return ids.map(id => map[id]).filter(Boolean)
  }, [ids])

  // 🔔 Sonner quand le minuteur finit (même si on n’est pas sur la page Timer)
  useEffect(() => {
    let mounted = true
    async function ding() {
      try {
        const { sound } = await Audio.Sound.createAsync(
          require('../assets/sounds/bell.mp3'),
          { shouldPlay: true, volume: 1.0 }
        )
        Vibration.vibrate(800)
        sound.setOnPlaybackStatusUpdate((s) => {
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

  return (
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
  // Épluchage (g)
  const [qtyEpl, setQtyEpl] = useState('')
  const [qtyNon, setQtyNon] = useState('')
  // Quantité ↔ Poids
  const [countNon, setCountNon] = useState('')
  const [countEpl, setCountEpl] = useState('')
  // Jus
  const [countJuice, setCountJuice] = useState('')
  const [volMl, setVolMl] = useState('')
  // Taille
  const [lengthCm, setLengthCm] = useState('')
  const [lenWeightG, setLenWeightG] = useState('')
  // Cuillères
  const [tsp, setTsp] = useState('')
  const [tbsp, setTbsp] = useState('')
  const [weightToSpoons, setWeightToSpoons] = useState('')
  // Pâtes
  const [pastaG, setPastaG] = useState('')
  const [waterL, setWaterL] = useState('')
  // Œufs
  const [eggSize, setEggSize] = useState<'S' | 'M' | 'L'>('S')
  const [eggTargetTotal, setEggTargetTotal] = useState('')
  const [eggTargetWhite, setEggTargetWhite] = useState('')
  const [eggTargetYolk, setEggTargetYolk] = useState('')
  const [eggCount, setEggCount] = useState('')

  // Pommes de terre
  const [pdtSize, setPdtSize] = useState<'S' | 'M' | 'L'>('M')
  const pdtS = toNumMaybe(d.wght_pdt_s) ?? null
  const pdtM = toNumMaybe(d.wght_pdt_m) ?? null
  const pdtL = toNumMaybe(d.wght_pdt_l) ?? null
  const hasPdt = pdtS !== null || pdtM !== null || pdtL !== null
  const [pdtWeightNon, setPdtWeightNon] = useState('')
  const [pdtWeightEpl, setPdtWeightEpl] = useState('')

  // Céleri
  const [celeryBranches, setCeleryBranches] = useState('')
  const [celeryWeight, setCeleryWeight] = useState('')

  // Ids normalisés
  const normId = (d.id || d.label || '').toString().toLowerCase().replace(/\s+/g, '_')
  const isPotato = normId === 'pomme_de_terre' || normId === 'pommes_de_terre' || normId === 'pdt'
  const isCelery = normId === 'celeri'

  // Poids unitaire PDT selon taille choisie
  const pdtUnit =
    pdtSize === 'S' ? (pdtS ?? 0) :
    pdtSize === 'M' ? (pdtM ?? 0) :
                      (pdtL ?? 0)

  // Poids unitaire effectif : PDT = taille choisie, sinon avg_unit_g
  const avgUnitEff = isPotato && hasPdt ? pdtUnit : (d.avg_unit_g || 0)

  // Constantes générales
  const density = d.density_g_ml ?? 1
  const tsp_g = d.tsp_g ?? (d.tbsp_g ? d.tbsp_g / 3 : null)
  const tbsp_g = d.tbsp_g ?? (tsp_g ? tsp_g * 3 : null)

  // Pâtes
  const pastaW = toNumMaybe(d.psta_wter)
  const pastaS = toNumMaybe(d.psta_slt)
  const hasPasta = (pastaW !== null) || (pastaS !== null)

  // Œufs
  const eggS = toNumMaybe(d.egg_s) ?? null
  const eggM = toNumMaybe(d.egg_m) ?? null
  const eggL = toNumMaybe(d.egg_l) ?? null
  const whitePct = toNumMaybe(d.whte_pctge) ?? null
  const yolkPct  = toNumMaybe(d.ylw_pctge)  ?? null
  const hasEggs =
    (eggS || eggM || eggL) !== null && (whitePct !== null || yolkPct !== null)
  const eggUnit = eggSize === 'S' ? (eggS ?? 0) : eggSize === 'M' ? (eggM ?? 0) : (eggL ?? 0)

  // Céleri (poids d'une branche)
  const celeryG = toNumMaybe((d as any).clr_lgth) ?? null
  const hasCelery = isCelery && celeryG !== null

  return (
    <View style={st.card}>
      {/* Titre + image */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={[st.h2, { flex: 1 }]}>{d.label}</Text>
        {IMAGES[d.id] && (
          <Image source={IMAGES[d.id]} style={{ width: 44, height: 44, marginLeft: 8 }} resizeMode="contain" />
        )}
      </View>

      {/* Infos clés (générales) */}
      {((!isPotato && d.avg_unit_g) || d.peeled_yield || d.juice_ml_per_unit) && (
        <View style={st.section}>
          <Text style={st.sTitle}>Infos clés</Text>
          {!isPotato && d.avg_unit_g ? (
            <Row left="Poids moyen (1 pièce)" right={`${fmt(d.avg_unit_g)} g`} />
          ) : null}
          {d.peeled_yield && d.avg_unit_g
            ? <Row left={`Poids épluché (×${fmt(d.peeled_yield)})`} right={`${fmt(d.avg_unit_g * d.peeled_yield)} g`} />
            : null}
          {d.juice_ml_per_unit
            ? <Row left="Jus moyen (1 pièce)" right={`${fmt(d.juice_ml_per_unit)} ml (≈ ${fmt(d.juice_ml_per_unit * density)} g)`} />
            : null}
        </View>
      )}

      {/* Module Œufs */}
      {hasEggs && (
        <View style={st.section}>
          <Text style={st.sTitle}>Infos clés</Text>
          <Row left="Œuf petit" right="< 50 g (S)" />
          <Row left="Œuf moyen" right="50–60 g (M)" />
          <Row left="Œuf gros" right="60–70 g (L)" />
          <View style={{ height: 6 }} />
          <Text style={st.sTitle}>Cuisson (départ eau bouillante)</Text>
          <Row left="Pochés" right="2 min" />
          <Row left="À la coque" right="3 min" />
          <Row left="Durs" right="9 min" />

          {/* Sélecteur S/M/L */}
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
            {(['S', 'M', 'L'] as const).map(sz => {
              const on = eggSize === sz
              return (
                <TouchableOpacity
                  key={sz}
                  onPress={() => setEggSize(sz)}
                  activeOpacity={0.9}
                  style={[st.sizeBtn, on && st.sizeBtnOn]}
                >
                  <Text style={[st.sizeBtnText, on && st.sizeBtnTextOn]}>{sz}</Text>
                </TouchableOpacity>
              )
            })}
          </View>

          {/* 1) Poids ↔ Quantité (total) */}
          <Text style={[st.sTitle, { marginTop: 10 }]}>Poids <Text style={st.arrow}>⇆</Text> Quantité</Text>
          <InputWithEcho
            value={eggTargetTotal}
            onChangeText={setEggTargetTotal}
            placeholder="Pds voulu Blanc+Jaune (g)"
            echoLabel="Blanc+Jaune (g)"
          />
          <Row
            left="Nombre d'œufs estimés"
            right={`${Math.ceil(num(eggTargetTotal) / Math.max(1, eggUnit))} œufs`}
          />

          {/* 2) Blancs seuls */}
          <InputWithEcho
            value={eggTargetWhite}
            onChangeText={setEggTargetWhite}
            placeholder="Poids voulu Blanc (g)"
            echoLabel="Blancs (g)"
          />
          <Row
            left="Nombre d'œufs estimés"
            right={`${Math.ceil(num(eggTargetWhite) / Math.max(1, (eggUnit * (whitePct ?? 0))))} œufs`}
          />

          {/* 3) Jaunes seuls */}
          <InputWithEcho
            value={eggTargetYolk}
            onChangeText={setEggTargetYolk}
            placeholder="Poids voulu Jaune (g)"
            echoLabel="Jaune (g)"
          />
          <Row
            left="Nombre d'œufs estimés"
            right={`${Math.ceil(num(eggTargetYolk) / Math.max(1, (eggUnit * (yolkPct ?? 0))))} œufs`}
          />

          {/* 4) Nombre d'œufs -> poids */}
          <InputWithEcho
            value={eggCount}
            onChangeText={setEggCount}
            placeholder="Nombre d'œufs (ex: 2)"
            echoLabel="Œufs"
          />
          {(() => {
            const c = num(eggCount)
            const total = c * eggUnit
            const whites = c * eggUnit * (whitePct ?? 0)
            const yolks  = c * eggUnit * (yolkPct ?? 0)
            return (
              <>
                <Row left="Blanc+Jaune" right={`${fmt(total)} g`} />
                <Row left="Blanc" right={`${fmt(whites)} g`} />
                <Row left="Jaune" right={`${fmt(yolks)} g`} />
              </>
            )
          })()}
        </View>
      )}

      {/* Pommes de terre : ordre validé */}
      {isPotato && hasPdt && (
        <View style={st.section}>
          {/* 1. Bloc Épluché ⇆ Non épluché (g) */}
          {d.peeled_yield ? (
            <View>
              <Text style={st.sTitle}>Épluché <Text style={st.arrow}>⇆</Text> Non épluché</Text>
              <InputWithEcho value={qtyEpl} onChangeText={setQtyEpl} placeholder="Quantité épluchée (g)" echoLabel="Épluché (g)" />
              <Row left="Quantité non épluchée" right={fmtAllUnits(num(qtyEpl) / (d.peeled_yield || 1))} />
              <InputWithEcho value={qtyNon} onChangeText={setQtyNon} placeholder="Quantité non épluchée (g)" echoLabel="Non épl. (g)" />
              <Row left="Quantité épluchée" right={fmtAllUnits(num(qtyNon) * (d.peeled_yield || 1))} />
            </View>
          ) : null}

          {/* 3. Info clés S/M/L (petite/moyenne/grosse) */}
          <View style={{ marginTop: 8 }}>
            <Text style={st.sTitle}>Infos clés</Text>
            {pdtS !== null && <Row left="Petite pomme de terre" right={`${fmt(pdtS)} g`} />}
            {pdtM !== null && <Row left="Pomme de terre moyenne" right={`${fmt(pdtM)} g`} />}
            {pdtL !== null && <Row left="Grosse pomme de terre" right={`${fmt(pdtL)} g`} />}
          </View>

          {/* 4. Sélecteur S / M / L */}
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
            {(['S', 'M', 'L'] as const).map(sz => {
              const on = pdtSize === sz
              return (
                <TouchableOpacity
                  key={sz}
                  onPress={() => setPdtSize(sz)}
                  activeOpacity={0.9}
                  style={[st.sizeBtn, on && st.sizeBtnOn]}
                >
                  <Text style={[st.sizeBtnText, on && st.sizeBtnTextOn]}>{sz}</Text>
                </TouchableOpacity>
              )
            })}
          </View>

          {/* 5. Quantité ⇆ Poids + Poids épl./non épl. + Pièces épl./non épl. (ordre demandé) */}
          {pdtUnit > 0 ? (
            <View style={{ marginTop: 12 }}>
              <Text style={st.sTitle}>Quantité <Text style={st.arrow}>⇆</Text> Poids</Text>

              {/* Poids épl. -> Nb pièces */}
              <InputWithEcho
                value={pdtWeightEpl}
                onChangeText={setPdtWeightEpl}
                placeholder="Poids épl. (g)"
                echoLabel="Épl. (g)"
              />
              {(() => {
                const y = d.peeled_yield ?? null
                const unitEpl = y ? pdtUnit * y : pdtUnit
                const pieces = Math.max(0, Math.ceil(num(pdtWeightEpl) / Math.max(1, unitEpl)))
                return <Row left="Nombre de pièces estimées" right={`${pieces} pièces`} />
              })()}

              {/* Poids non épl. -> Nb pièces */}
              <InputWithEcho
                value={pdtWeightNon}
                onChangeText={setPdtWeightNon}
                placeholder="Poids non épl. (g)"
                echoLabel="Non épl. (g)"
              />
              <Row
                left="Nombre de pièces estimées"
                right={`${Math.max(0, Math.ceil(num(pdtWeightNon) / Math.max(1, pdtUnit)))} pièces`}
              />

              {/* Pièces non épl. -> Poids */}
              <InputWithEcho
                value={countNon}
                onChangeText={setCountNon}
                placeholder="Pièces non épl. (ex: 3)"
                echoLabel="Pièces non épl."
              />
              <Row left="Poids estimé non épluché" right={fmtAllUnits(num(countNon) * pdtUnit)} />
              {d.peeled_yield ? (
                <Row left="Poids estimé épluché" right={fmtAllUnits(num(countNon) * pdtUnit * (d.peeled_yield || 1))} />
              ) : null}

              {/* Pièces épl. -> Poids */}
              <InputWithEcho
                value={countEpl}
                onChangeText={setCountEpl}
                placeholder="Pièces épl. (ex: 3)"
                echoLabel="Pièces épl."
              />
              <Row left="Poids estimé non épluché" right={fmtAllUnits(num(countEpl) * pdtUnit)} />
              {d.peeled_yield ? (
                <Row left="Poids estimé épluché" right={fmtAllUnits(num(countEpl) * pdtUnit * (d.peeled_yield || 1))} />
              ) : null}
            </View>
          ) : null}
        </View>
      )}

      {/* Épluché ⇆ Non épluché (g) — générique */}
      {d.peeled_yield ? (
        <View style={st.section}>
          <Text style={st.sTitle}>Épluché <Text style={st.arrow}>⇆</Text> Non épluché</Text>
          <InputWithEcho value={qtyEpl} onChangeText={setQtyEpl} placeholder="Quantité épluchée (g)" echoLabel="Épluché (g)" />
          <Row left="Quantité non épluchée" right={fmtAllUnits(num(qtyEpl) / (d.peeled_yield || 1))} />
          <InputWithEcho value={qtyNon} onChangeText={setQtyNon} placeholder="Quantité non épluchée (g)" echoLabel="Non épl. (g)" />
          <Row left="Quantité épluchée" right={fmtAllUnits(num(qtyNon) * (d.peeled_yield || 1))} />
        </View>
      ) : null}

      {/* Quantité ⇆ Poids — générique (pour les ingrédients non-PDT) */}
      {!isPotato && d.avg_unit_g ? (
        <View style={st.section}>
          <Text style={st.sTitle}>Quantité <Text style={st.arrow}>⇆</Text> Poids</Text>

          <InputWithEcho value={countNon} onChangeText={setCountNon} placeholder="Pièces non épl. (ex: 3)" echoLabel="Pièces non épl." />
          <Row left="Poids non épluché" right={fmtAllUnits(num(countNon) * (d.avg_unit_g || 0))} />
          {d.peeled_yield ? <Row left="Poids épluché" right={fmtAllUnits(num(countNon) * (d.avg_unit_g || 0) * (d.peeled_yield || 1))} /> : null}

          <InputWithEcho value={countEpl} onChangeText={setCountEpl} placeholder="Pièces épl. (ex: 3)" echoLabel="Pièces épl." />
          <Row left="Poids non épluché" right={fmtAllUnits(num(countEpl) * (d.avg_unit_g || 0))} />
          {d.peeled_yield ? <Row left="Poids épluché" right={fmtAllUnits(num(countEpl) * (d.avg_unit_g || 0) * (d.peeled_yield || 1))} /> : null}
        </View>
      ) : null}

      {/* Céleri */}
      {hasCelery && (
        <View style={st.section}>
          <Text style={st.sTitle}>Infos clés</Text>
          <Row left="1 branche de céleri" right={`${fmt(celeryG!)} g`} />

          <Text style={[st.sTitle, { marginTop: 8 }]}>
            Nombre de branches <Text style={st.arrow}>⇆</Text> Poids
          </Text>

          {/* Nb de branches -> Poids */}
          <InputWithEcho
            value={celeryBranches}
            onChangeText={setCeleryBranches}
            placeholder="Nb de branches (ex: 2)"
            echoLabel="Branches"
          />
          <Row left="Poids estimé" right={fmtAllUnits(num(celeryBranches) * (celeryG || 0))} />

          {/* Poids -> Nb de branches (arrondi à l'unité sup.) */}
          <InputWithEcho
            value={celeryWeight}
            onChangeText={setCeleryWeight}
            placeholder="Poids (ex: 200 g)"
            echoLabel="Poids (g)"
          />
          <Row
            left="Nombre de branches estimé"
            right={`${Math.ceil(num(celeryWeight) / Math.max(1, (celeryG || 0)))} branches`}
          />
        </View>
      )}

      {/* Jus */}
      {d.juice_ml_per_unit ? (
        <View style={st.section}>
          <Text style={st.sTitle}>Quantité <Text style={st.arrow}>⇆</Text> Jus</Text>
          <InputWithEcho value={countJuice} onChangeText={setCountJuice} placeholder="Nombre de pièces (ex: 2 citrons)" echoLabel="Pièces" />
          <Row
            left="Volume"
            right={`${fmt(num(countJuice) * (d.juice_ml_per_unit || 0))} ml  |  ${fmt(num(countJuice) * (d.juice_ml_per_unit || 0) / 10)} cl  |  ${fmt(num(countJuice) * (d.juice_ml_per_unit || 0) / 1000)} l`}
          />
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
          <Text style={[st.sTitle, { marginTop: 10 }]}>Poids <Text style={st.arrow}>⇆</Text> Cuillères</Text>
          <InputWithEcho value={weightToSpoons} onChangeText={setWeightToSpoons} placeholder="Poids (g) — ex: 15" echoLabel="Poids (g)" />
          <Row
            left="Équivalent"
            right={`${tsp_g ? `${fmt(num(weightToSpoons) / tsp_g, 2)} c. à café` : '— c. à café'}   |   ${tbsp_g ? `${fmt(num(weightToSpoons) / tbsp_g, 2)} c. à soupe` : '— c. à soupe'}`}
          />
        </View>
      ) : null}

      {/* Pâtes */}
      {hasPasta && (
        <View style={st.section}>
          <Text style={st.sTitle}>Pâtes <Text style={st.arrow}>⇆</Text> Eau & Sel</Text>
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

  navLink: {
    color: '#7c3aed',
    fontWeight: '900',
    fontSize: 18,
  },

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
  sizeBtnOn: {
    borderColor: '#FF4FA2',
    backgroundColor: '#FF92E0',
  },
  sizeBtnText: {
    fontWeight: '800',
    color: '#FF4FA2',
  },
  sizeBtnTextOn: {
    color: '#fff',
  },
})
