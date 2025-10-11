// src/TimerDoneOverlay.tsx
import React, { useEffect, useRef } from 'react'
import { Animated, BackHandler, StyleSheet, Text, TouchableOpacity } from 'react-native'
import { useTimer } from './timerContext'

export default function TimerDoneOverlay() {
  const { doneVisible, setDoneVisible, displayName } = useTimer()
  const fade = useRef(new Animated.Value(1)).current
  const loopRef = useRef<Animated.CompositeAnimation | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (doneVisible) {
      fade.setValue(1)
      loopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(fade, { toValue: 0.25, duration: 400, useNativeDriver: true }),
          Animated.timing(fade, { toValue: 1, duration: 400, useNativeDriver: true }),
        ])
      )
      loopRef.current.start()

      // auto-hide après 4.2s
      timeoutRef.current = setTimeout(() => setDoneVisible(false), 12000)

      // hardware back → ferme l’overlay
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        setDoneVisible(false)
        return true
      })
      return () => { sub.remove() }
    }
    return () => {}
  }, [doneVisible, fade, setDoneVisible])

  useEffect(() => {
    return () => {
      loopRef.current?.stop?.()
      loopRef.current = null
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null }
    }
  }, [])

  if (!doneVisible) return null

  const close = () => {
    loopRef.current?.stop?.()
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null }
    setDoneVisible(false)
  }

  return (
    <TouchableOpacity style={st.overlay} activeOpacity={1} onPress={close}>
      <Animated.View style={[st.box, { opacity: fade }]}>
        <Text style={st.text}>{(displayName || 'Minuteur') + ' prêt !'}</Text>
      </Animated.View>
    </TouchableOpacity>
  )
}

const st = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0, right: 0, top: 0, bottom: 0,
    zIndex: 9999,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  box: {
    backgroundColor: '#FFE4F6',
    borderColor: '#FF4FA2',
    borderWidth: 2,
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 22,
    minWidth: '70%',
    alignItems: 'center',
  },
  text: {
    color: '#FF4FA2',
    fontWeight: '900',
    fontSize: 28,
    textAlign: 'center',
  },
  hint: { marginTop: 6, color: '#7a3c84', fontWeight: '700' },
})
