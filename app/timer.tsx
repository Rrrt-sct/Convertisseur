// app/timer.tsx
import { router } from 'expo-router'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Keyboard, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { msToMMSS, useTimer } from '../src/timerContext'

/**
 * Écran Minuteur
 * - Robuste côté parsing des entrées (minutes/secondes)
 * - Normalise les secondes (>= 60 ⇒ report en minutes)
 * - Empêche le démarrage à 0s
 * - Boutons accessibles + états désactivés cohérents
 * - Ne dépend que de l'état du timer (running/remainingMs)
 */
export default function TimerScreen() {
  const { running, remainingMs, start, pause, reset } = useTimer()

  // Champs contrôlés en texte pour éviter les NaN et conserver les zéros non significatifs à l'affichage
  const [minutes, setMinutes] = useState('')
  const [seconds, setSeconds] = useState('')

  // === Helpers ===
  const onlyDigits = (s: string) => s.replace(/[^0-9]/g, '')
  const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

  const normalizeInputs = useCallback((mStr: string, sStr: string) => {
    // Nettoyage
    let m = Number(onlyDigits(mStr)) || 0
    let s = Number(onlyDigits(sStr)) || 0

    // Report des secondes en minutes si s >= 60
    if (s >= 60) {
      m += Math.floor(s / 60)
      s = s % 60
    }

    // Clamp raisonnable (éviter des valeurs absurdes)
    m = clamp(m, 0, 9999)
    s = clamp(s, 0, 59)

    return { m, s }
  }, [])

  const totalMs = useMemo(() => {
    const { m, s } = normalizeInputs(minutes, seconds)
    return (m * 60 + s) * 1000
  }, [minutes, seconds, normalizeInputs])

  const canStart = !running && totalMs > 0
  const canPause = running
  const canReset = running || remainingMs > 0

  const onStartPause = useCallback(() => {
    if (running) {
      pause()
    } else {
      if (totalMs > 0) {
        Keyboard.dismiss()
        start(totalMs)
      }
    }
  }, [running, pause, start, totalMs])

  const onReset = useCallback(() => {
    reset()
    setMinutes('')
    setSeconds('')
  }, [reset])

  // Normalisation visuelle sur blur ("07" → "07", "7" → "07")
  const onMinutesBlur = useCallback(() => {
    const { m } = normalizeInputs(minutes, '0')
    setMinutes(m.toString())
  }, [minutes, normalizeInputs])

  const onSecondsBlur = useCallback(() => {
    const { s } = normalizeInputs('0', seconds)
    setSeconds(s.toString().padStart(2, '0'))
  }, [seconds, normalizeInputs])

  // Si on est en cours, on masque le clavier au changement d'état
  useEffect(() => {
    if (running) Keyboard.dismiss()
  }, [running])

  return (
    <View style={st.container}>
      <Text style={st.title} accessibilityRole="header">⏱️ Minuteur</Text>

      {/* Affichage du temps restant issu du contexte (fiable à l'horloge) */}
      <Text style={st.timeDisplay} accessibilityLabel={`Temps restant ${msToMMSS(remainingMs)}`}>
        {msToMMSS(remainingMs)}
      </Text>

      {/* Saisie minutes / secondes */}
      <View style={st.inputsRow}>
        <TextInput
          style={st.timeInput}
          keyboardType="numeric"
          value={minutes}
          onChangeText={(t) => setMinutes(onlyDigits(t))}
          onBlur={onMinutesBlur}
          placeholder="00"
          placeholderTextColor="#FFB6F9"
          caretHidden={true}
          maxLength={4}
          accessibilityLabel="Minutes"
          returnKeyType="done"
        />
        <Text style={st.separator}>:</Text>
        <TextInput
          style={st.timeInput}
          keyboardType="numeric"
          value={seconds}
          onChangeText={(t) => setSeconds(onlyDigits(t))}
          onBlur={onSecondsBlur}
          placeholder="00"
          placeholderTextColor="#FFB6F9"
          caretHidden={true}
          maxLength={2}
          accessibilityLabel="Secondes"
          returnKeyType="done"
        />
      </View>

      {/* Bouton principal */}
      <TouchableOpacity
        style={[st.cta, running ? st.ctaPause : st.ctaStart, (!canStart && !canPause) && st.ctaDisabled]}
        onPress={onStartPause}
        disabled={!canStart && !canPause}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canStart && !canPause, busy: running }}
      >
        <Text style={st.ctaText}>{running ? 'Pause' : 'Démarrer'}</Text>
      </TouchableOpacity>

      {/* Reset */}
      <TouchableOpacity
        style={[st.cta, st.ctaReset, !canReset && st.ctaDisabled]}
        onPress={onReset}
        disabled={!canReset}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canReset }}
      >
        <Text style={st.ctaText}>Réinitialiser</Text>
      </TouchableOpacity>

      {/* Retour */}
      <TouchableOpacity onPress={() => router.back()} style={st.backBtn} accessibilityRole="button">
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
  title: { fontSize: 52, fontWeight: '900', color: '#FF4FA2', marginBottom: 20 },
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
  ctaDisabled: { opacity: 0.5 },
  ctaText: { color: '#fff', fontWeight: '900', fontSize: 20, textAlign: 'center' },
  backBtn: { marginTop: 16 },
  backText: { color: '#7c3aed', fontWeight: '700', fontSize: 20 },
})
