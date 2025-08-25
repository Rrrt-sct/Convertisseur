// app/timer.tsx
import { useKeepAwake } from 'expo-keep-awake'; // npm i expo-keep-awake (facultatif mais pratique)
import { router } from 'expo-router'
import React, { useMemo, useRef } from 'react'
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { msToMMSS, useTimer } from '../src/timerContext'

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

export default function TimerScreen() {
  useKeepAwake() // évite que l’écran se mette en veille pendant le minuteur

  const { running, remainingMs, durationMs, start, pause, reset, setRemaining } = useTimer()

  // réglage local
  const minsRef = useRef('3')
  const secsRef = useRef('00')
  const setMins = (t: string) => { minsRef.current = t }
  const setSecs = (t: string) => { secsRef.current = t }

  const totalMs = useMemo(() => {
    const m = clamp(Number(minsRef.current.replace(',', '.')) || 0, 0, 999)
    const s = clamp(Number(secsRef.current.replace(',', '.')) || 0, 0, 59)
    return (m * 60 + s) * 1000
  }, [running, remainingMs]) // recalcul léger

  const display = msToMMSS(running ? remainingMs : (durationMs || totalMs))

  // Progress simple (barre)
  const progress = durationMs > 0 ? 1 - remainingMs / durationMs : 0
  const pct = Math.max(0, Math.min(1, progress))

  return (
    <View style={st.container}>
      <View style={st.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={st.link}>↩︎ Retour</Text>
        </TouchableOpacity>
        <Text style={st.title}>⏱️ Minuteur</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={st.timeBox}>
        <Text style={st.timeText}>{display}</Text>

        <View style={st.progressTrack}>
          <View style={[st.progressFill, { width: `${pct * 100}%` }]} />
        </View>

        <Text style={st.subTime}>
          {running ? 'En cours…' : (durationMs > 0 ? 'En pause' : 'Prêt')}
        </Text>
      </View>

      <View style={st.settingsCard}>
        <Text style={st.sectionTitle}>Réglage</Text>

        <View style={st.inputsRow}>
          <View style={st.inputWrap}>
            <Text style={st.label}>Minutes</Text>
            <TextInput
              style={st.input}
              keyboardType="numeric"
              defaultValue="3"
              onChangeText={t => setMins(String(t).replace(/[^\d,\.]/g, ''))}
              placeholder="0"
              placeholderTextColor="#ff8fcd"
              maxLength={3}
            />
          </View>

          <View style={st.inputWrap}>
            <Text style={st.label}>Secondes</Text>
            <TextInput
              style={st.input}
              keyboardType="numeric"
              defaultValue="00"
              onChangeText={t => setSecs(String(t).replace(/[^\d,\.]/g, ''))}
              placeholder="0"
              placeholderTextColor="#ff8fcd"
              maxLength={2}
            />
          </View>
        </View>

        <View style={st.presetRow}>
          {[1, 3, 5, 10].map(m => (
            <TouchableOpacity
              key={m}
              style={st.pill}
              onPress={() => {
                minsRef.current = String(m)
                secsRef.current = '00'
                if (!running) setRemaining(m * 60 * 1000)
              }}
            >
              <Text style={st.pillText}>{m} min</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={st.actionsRow}>
        {!running ? (
          <TouchableOpacity style={[st.btn, st.btnPrimary]} onPress={() => start(totalMs)} activeOpacity={0.9}>
            <Text style={st.btnText}>Démarrer</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[st.btn, st.btnWarn]} onPress={pause} activeOpacity={0.9}>
            <Text style={st.btnText}>Pause</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[st.btn, st.btnGhost]}
          onPress={() => reset()}
          onLongPress={() => { minsRef.current = '0'; secsRef.current = '00'; reset() }}
          activeOpacity={0.9}
        >
          <Text style={st.btnGhostText}>Réinitialiser</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFEEFC', padding: 16, paddingTop: 28 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  link: { color: '#7c3aed', fontWeight: '700' },
  title: { fontSize: 22, fontWeight: '900', color: '#FF4FA2' },

  timeBox: {
    backgroundColor: '#fff',
    borderRadius: 26,
    paddingVertical: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF8FCD',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 6,
    marginBottom: 14,
  },
  timeText: {
    fontSize: 72,                 // 👈 plus grand
    fontWeight: '900',
    color: '#FF4FA2',
    letterSpacing: 1,
    textShadowColor: '#ffd6ef',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  subTime: { marginTop: 8, color: '#7c7c8a', fontWeight: '700' },

  // barre de progression
  progressTrack: {
    width: '86%',
    height: 10,
    backgroundColor: '#FFE4F6',
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 14,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FF92E0',
  },

  settingsCard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 14,
    shadowColor: '#FF8FCD',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 5,
    marginBottom: 12,
  },
  sectionTitle: { fontWeight: '800', color: '#444', marginBottom: 8 },
  inputsRow: { flexDirection: 'row', gap: 12 },
  inputWrap: { flex: 1 },
  label: { fontSize: 13, fontWeight: '700', color: '#FF69B4', marginBottom: 6 },
  input: {
    backgroundColor: '#FFF0FA',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#FFB6F9',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 20,                 // 👈 un poil plus grand
    color: '#FF4FA2',
    textAlign: 'center',
  },

  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  pill: {
    backgroundColor: '#FFE4F6',
    borderColor: '#FFB6F9',
    borderWidth: 2,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pillText: { color: '#FF4FA2', fontWeight: '800' },

  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  btn: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#FF4FA2',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
  },
  btnPrimary: { backgroundColor: '#FF92E0' },
  btnWarn: { backgroundColor: '#f59e0b' },
  btnText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  btnGhost: { backgroundColor: '#fff', borderWidth: 2, borderColor: '#FFB6F9' },
  btnGhostText: { color: '#FF4FA2', fontWeight: '900', fontSize: 16 },
})
