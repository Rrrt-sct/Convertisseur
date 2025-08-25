// app/timer.tsx
import { router } from 'expo-router'
import React, { useState } from 'react'
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { msToMMSS, useTimer } from '../src/timerContext'

export default function TimerScreen() {
  const { running, remainingMs, start, pause, reset } = useTimer()
  const [minutes, setMinutes] = useState('')
  const [seconds, setSeconds] = useState('')

  const onStartPause = () => {
    if (running) {
      pause()
    } else {
      const totalMs = (Number(minutes) * 60 + Number(seconds)) * 1000
      if (totalMs > 0) start(totalMs)
    }
  }

  const onReset = () => {
    reset()
    setMinutes('')
    setSeconds('')
  }

  return (
    <View style={st.container}>
      <Text style={st.title}>⏱️ Minuteur</Text>

      {/* Affichage du temps restant */}
      <Text style={st.timeDisplay}>{msToMMSS(remainingMs)}</Text>

      {/* Saisie minutes / secondes */}
      <View style={st.inputsRow}>
        <TextInput
          style={st.timeInput}
          keyboardType="numeric"
          value={minutes}
          onChangeText={setMinutes}
          placeholder="00"
          caretHidden={true} // plus de curseur
        />
        <Text style={st.separator}>:</Text>
        <TextInput
          style={st.timeInput}
          keyboardType="numeric"
          value={seconds}
          onChangeText={setSeconds}
          placeholder="00"
          caretHidden={true}
        />
      </View>

      {/* Boutons */}
      <TouchableOpacity
        style={[st.cta, running ? st.ctaPause : st.ctaStart]}
        onPress={onStartPause}
      >
        <Text style={st.ctaText}>{running ? 'Pause' : 'Démarrer'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[st.cta, st.ctaReset]} onPress={onReset}>
        <Text style={st.ctaText}>Réinitialiser</Text>
      </TouchableOpacity>

      {/* Retour */}
      <TouchableOpacity onPress={() => router.back()} style={st.backBtn}>
        <Text style={st.backText}>↩︎ Retour</Text>
      </TouchableOpacity>
    </View>
  )
}

const st = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFEEFC',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: { fontSize: 52, fontWeight: '900', color: '#FF4FA2', marginBottom: 20 }, // même taille que compteur
  timeDisplay: { fontSize: 52, fontWeight: '900', color: '#FF4FA2', marginBottom: 20 },
  inputsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  timeInput: {
    backgroundColor: '#FFF0FA',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#FFB6F9',
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 28,
    color: '#FF4FA2',
    textAlign: 'center',
    minWidth: 80,
  },
  separator: { fontSize: 32, fontWeight: '900', color: '#FF4FA2', marginHorizontal: 10 },
  cta: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 26,
    marginBottom: 14,
    backgroundColor: '#FF92E0',
    elevation: 4,
  },
  ctaStart: { backgroundColor: '#FF92E0' },
  ctaPause: { backgroundColor: '#FF92E0' },
  ctaReset: { backgroundColor: '#FF92E0' },
  ctaText: { color: '#fff', fontWeight: '900', fontSize: 20, textAlign: 'center' },
  backBtn: { marginTop: 16 },
  backText: { color: '#7c3aed', fontWeight: '700', fontSize: 20 }, // plus grand
})
