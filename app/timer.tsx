// app/timer.tsx
import { router } from 'expo-router'
import React, { useCallback, useEffect, useState } from 'react'
import {
  Keyboard, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View
} from 'react-native'
import { useTimers } from '../src/timerContext'

type HMS = { h: string; m: string; s: string }
type InputsById = Record<string, HMS>

/** Utils */
const onlyDigits = (s: string) => (s ?? '').replace(/[^0-9]/g, '')
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

function normalizeHMS(hStr: string, mStr: string, sStr: string) {
  let h = Number(onlyDigits(hStr)) || 0
  let m = Number(onlyDigits(mStr)) || 0
  let s = Number(onlyDigits(sStr)) || 0

  if (s >= 60) { m += Math.floor(s / 60); s = s % 60 }
  if (m >= 60) { h += Math.floor(m / 60); m = m % 60 }

  h = clamp(h, 0, 9999)
  m = clamp(m, 0, 59)
  s = clamp(s, 0, 59)
  return { h, m, s }
}
const hmsToMs = (h: number, m: number, s: number) => ((h * 60 + m) * 60 + s) * 1000

export default function TimersScreen() {
  const {
    timers, addTimer, removeTimer, setName,
    startTimer, pauseTimer, resetTimer, remainingMsById
  } = useTimers()

  // Entrées HH/MM/SS par minuteur
  const [inputsById, setInputsById] = useState<InputsById>({})

  // Initialise un bloc d'entrée pour chaque minuteur existant
  useEffect(() => {
    setInputsById(prev => {
      const next = { ...prev }
      for (const t of timers) {
        if (!next[t.id]) next[t.id] = { h: '', m: '', s: '' }
      }
      for (const id of Object.keys(next)) {
        if (!timers.some(t => t.id === id)) delete (next as any)[id]
      }
      return next
    })
  }, [timers])

  const onStartPause = useCallback((id: string) => {
    const inp = inputsById[id] || { h: '', m: '', s: '' }
    const { h, m, s } = normalizeHMS(inp.h, inp.m, inp.s)
    const total = hmsToMs(h, m, s)
    const t = timers.find(x => x.id === id)
    if (!t) return
    if (t.running) {
      pauseTimer(id)
    } else if (total > 0) {
      Keyboard.dismiss()
      startTimer(id, total)
    }
  }, [inputsById, timers, pauseTimer, startTimer])

  const onReset = useCallback((id: string) => {
    resetTimer(id)
    setInputsById(prev => ({ ...prev, [id]: { h: '', m: '', s: '' } }))
  }, [resetTimer])

  const setField = (id: string, field: keyof HMS, val: string) => {
    setInputsById(prev => ({
      ...prev,
      [id]: { ...(prev[id] || { h: '', m: '', s: '' }), [field]: onlyDigits(val) }
    }))
  }
  const onBlurMM = (id: string) => {
    setInputsById(prev => {
      const cur = prev[id] || { h: '', m: '', s: '' }
      const { m } = normalizeHMS('0', cur.m, '0')
      return { ...prev, [id]: { ...cur, m: m.toString().padStart(2, '0') } }
    })
  }
  const onBlurSS = (id: string) => {
    setInputsById(prev => {
      const cur = prev[id] || { h: '', m: '', s: '' }
      const { s } = normalizeHMS('0', '0', cur.s)
      return { ...prev, [id]: { ...cur, s: s.toString().padStart(2, '0') } }
    })
  }

  const addNewTimer = () => { addTimer() }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={st.container} contentContainerStyle={{ padding: 16, paddingTop: 28 }}>

        {/* En-tête avec retour (hors des cartes pour rester cliquable) */}
        <View style={st.headerRow}>
          <Text style={st.h1}>⏱️ Minuteurs</Text>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, left: 8, right: 8, bottom: 8 }}>
            <Text style={st.navLink}>↩︎ Retour</Text>
          </TouchableOpacity>
        </View>

        {/* CTA : Nouveau minuteur, sous l’entête */}
        <TouchableOpacity onPress={addNewTimer} activeOpacity={0.9} style={st.newTimerChip}>
          <Text style={st.newTimerChipTxt}>＋ Nouveau minuteur</Text>
        </TouchableOpacity>

        {/* Liste des minuteurs (ordre de création) */}
        {timers.map(t => {
          const remaining = remainingMsById(t.id)
          const inp = inputsById[t.id] || { h: '', m: '', s: '' }

          // format 00:00:00
          const total = Math.max(0, Math.floor(remaining / 1000))
          const H = String(Math.floor(total / 3600)).padStart(2, '0')
          const M = String(Math.floor((total % 3600) / 60)).padStart(2, '0')
          const S = String(total % 60).padStart(2, '0')

          return (
            <View key={t.id} style={st.card}>

              {/* Nom du minuteur (centré) */}
              <TextInput
                style={[st.nameInput, { alignSelf: 'stretch' }]}
                value={t.name}
                onChangeText={(s) => setName(t.id, s)}
                placeholder="Nom du minuteur"
                placeholderTextColor="#FFB6F9"
                accessibilityLabel="Nom du minuteur"
                returnKeyType="done"
              />

              {/* Affichage temps restant (centré) */}
              <View style={st.centerRow}>
                <Text style={st.timeDisplay}>{H}:{M}:{S}</Text>
              </View>

              {/* Entrées HH:MM:SS (centrées) */}
              <View style={[st.inputsRow, st.centerRow]}>
                <TextInput
                  style={st.timeInput}
                  keyboardType="numeric"
                  value={inp.h}
                  onChangeText={(v) => setField(t.id, 'h', v)}
                  placeholder="HH"
                  placeholderTextColor="#FFB6F9"
                  maxLength={4}
                  returnKeyType="done"
                />
                <Text style={st.separator}>:</Text>
                <TextInput
                  style={st.timeInput}
                  keyboardType="numeric"
                  value={inp.m}
                  onChangeText={(v) => setField(t.id, 'm', v)}
                  onBlur={() => onBlurMM(t.id)}
                  placeholder="MM"
                  placeholderTextColor="#FFB6F9"
                  maxLength={2}
                  returnKeyType="done"
                />
                <Text style={st.separator}>:</Text>
                <TextInput
                  style={st.timeInput}
                  keyboardType="numeric"
                  value={inp.s}
                  onChangeText={(v) => setField(t.id, 's', v)}
                  onBlur={() => onBlurSS(t.id)}
                  placeholder="SS"
                  placeholderTextColor="#FFB6F9"
                  maxLength={2}
                  returnKeyType="done"
                />
              </View>

              {/* Actions centrées */}
              <View style={st.centerRow}>
                <TouchableOpacity
                  style={[st.cta, t.running ? st.ctaPause : st.ctaStart]}
                  onPress={() => onStartPause(t.id)}
                >
                  <Text style={st.ctaText}>{t.running ? 'Pause' : 'Démarrer'}</Text>
                </TouchableOpacity>
              </View>

              <View style={[st.rowActions, { justifyContent: 'center' }]}>
                <TouchableOpacity style={[st.ctaSm, st.ctaReset]} onPress={() => onReset(t.id)}>
                  <Text style={st.ctaSmText}>Réinitialiser</Text>
                </TouchableOpacity>

                {/* On laisse la possibilité de supprimer un minuteur supplémentaire */}
                {timers.length > 1 && (
                  <TouchableOpacity style={[st.ctaSm, st.ctaDelete]} onPress={() => removeTimer(t.id)}>
                    <Text style={[st.ctaSmText, { color: '#B00020' }]}>Supprimer</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )
        })}
      </ScrollView>
    </View>
  )
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFEEFC' },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  h1: { fontSize: 24, fontWeight: '900', color: '#FF4FA2' },
  navLink: { color: '#7c3aed', fontWeight: '900', fontSize: 18 },

  // Chip “Nouveau minuteur”
  newTimerChip: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#FFB6F9',
    backgroundColor: '#FFE4F6',
    marginBottom: 10,
  },
  newTimerChipTxt: { fontWeight: '800', color: '#FF4FA2' },

  // Carte minuteur
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#FF8FCD',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 2,
    borderColor: '#FFB6F9',
  },

  // Nom (mêmes styles que inputs temps)
  nameInput: {
    backgroundColor: '#FFF0FA',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#FFB6F9',
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 18,
    color: '#FF4FA2',
    marginBottom: 10,
  },

  // Centrage réutilisable
  centerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },

  // Display temps
  timeDisplay: { fontSize: 36, fontWeight: '900', color: '#FF4FA2', marginBottom: 12 },

  // Entrées HH:MM:SS
  inputsRow: { marginBottom: 12 },
  timeInput: {
    backgroundColor: '#FFF0FA',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#FFB6F9',
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 24,
    color: '#FF4FA2',
    textAlign: 'center',
    minWidth: 90,
  },
  separator: { fontSize: 28, fontWeight: '900', color: '#FF4FA2', marginHorizontal: 10 },

  // CTA
  cta: {
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginBottom: 10,
    backgroundColor: '#FF92E0',
    elevation: 4,
    alignItems: 'center',
  },
  ctaStart: { backgroundColor: '#FF92E0' },
  ctaPause: { backgroundColor: '#FF92E0' },
  ctaText: { color: '#fff', fontWeight: '900', fontSize: 18 },

  rowActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  ctaSm: {
    flexGrow: 0,
    minWidth: 140,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    borderWidth: 2,
  },
  ctaReset: { borderColor: '#FFB6F9', backgroundColor: '#FFE4F6' },
  ctaDelete: { borderColor: '#F5B7C6', backgroundColor: '#FFF0F3' },
  ctaSmText: { color: '#FF4FA2', fontWeight: '900' },
})
