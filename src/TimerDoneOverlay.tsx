// src/TimerDoneOverlay.tsx
import React, { useEffect, useRef, useState } from 'react'
import { Animated, Easing, StyleSheet, Text, TouchableOpacity } from 'react-native'
import { useTimers } from './timerContext'

export default function TimerDoneOverlay() {
  const { doneEvent, clearDoneEvent } = useTimers()
  const [visible, setVisible] = useState(false)
  const [label, setLabel] = useState<string>('Minuteur')

  const fade = useRef(new Animated.Value(0)).current
  const loopRef = useRef<Animated.CompositeAnimation | null>(null)

  const SHOW_MS = 12000

  useEffect(() => {
    if (!doneEvent) return
    // 🔒 snapshot du nom (et fallback propre)
    const name = (doneEvent.name ?? '').trim()
    setLabel(name.length > 0 ? name : 'Minuteur')

    setVisible(true)
    loopRef.current?.stop?.()
    fade.setValue(0)
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(fade, { toValue: 1, duration: 450, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(fade, { toValue: 0.2, duration: 450, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    )
    loopRef.current = loop
    loop.start()

    const t = setTimeout(() => {
      loop.stop()
      setVisible(false)
      clearDoneEvent()
    }, SHOW_MS)

    return () => { clearTimeout(t); loop.stop() }
  }, [doneEvent, fade, clearDoneEvent])

  if (!visible) return null

  return (
    <TouchableOpacity
      style={st.overlay}
      activeOpacity={1}
      onPress={() => {
        loopRef.current?.stop?.()
        setVisible(false)
        clearDoneEvent()
      }}
    >
      <Animated.View style={[st.overlayBox, { opacity: fade }]}>
        {/* Nom bien visible */}
        <Text style={st.nameText} numberOfLines={2}>{label}</Text>
        {/* Mention prêt! en dessous */}
        <Text style={st.readyText}>prêt !</Text>
      </Animated.View>
    </TouchableOpacity>
  )
}

const st = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0, right: 0, top: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
    zIndex: 9999,
  },
  overlayBox: {
    minWidth: '70%',
    paddingVertical: 22,
    paddingHorizontal: 22,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#FFB6F9',
    backgroundColor: '#FFF0FA',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 10,
    alignItems: 'center',
  },
  nameText: {
    color: '#FF4FA2',
    fontWeight: '900',
    fontSize: 30,          // 👈 plus grand pour le nom
    textAlign: 'center',
  },
  readyText: {
    marginTop: 6,
    color: '#7a3c84',
    fontWeight: '900',
    fontSize: 22,
    textAlign: 'center',
  },
})
