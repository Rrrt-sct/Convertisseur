// src/timerContext.tsx — correctif tick "now"
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AppState } from 'react-native'
import { playBell, prepareBell } from './bell'

export type TimerCtx = {
  running: boolean
  remainingMs: number
  deadline: number | null
  hasRung: boolean
  start: (durationMs: number) => void
  pause: () => void
  reset: () => void
}

const TimerContext = createContext<TimerCtx | undefined>(undefined)

export function msToMMSS(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export const TimerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [deadline, setDeadline] = useState<number | null>(null)
  const [running, setRunning] = useState(false)
  const [hasRung, setHasRung] = useState(false)

  // ✅ NOUVEAU : horloge interne qui force le render
  const [now, setNow] = useState(() => Date.now())

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const playingRef = useRef(false)

  useEffect(() => {
    prepareBell().catch(() => {})
  }, [])

  // ✅ remainingMs dépend de "now"
  const remainingMs = useMemo(() => {
    if (!deadline) return 0
    return Math.max(0, deadline - now)
  }, [deadline, now])

  const start = useCallback((durationMs: number) => {
    const dl = Date.now() + durationMs
    setDeadline(dl)
    setRunning(true)
    setHasRung(false)
    setNow(Date.now()) // reset tick de référence
  }, [])

  const pause = useCallback(() => {
    if (deadline) {
      const rest = Math.max(0, deadline - Date.now())
      setDeadline(Date.now() + rest)
    }
    setRunning(false)
  }, [deadline])

  const reset = useCallback(() => {
    setRunning(false)
    setDeadline(null)
    setHasRung(false)
    setNow(Date.now())
  }, [])

  // ✅ Intervalle : on met à jour "now" (et uniquement ça)
  useEffect(() => {
    if (!running) {
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null }
      return
    }
    if (!tickRef.current) {
      tickRef.current = setInterval(() => {
        setNow(Date.now())
      }, 250)
    }
    return () => {
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null }
    }
  }, [running])

  // ✅ Déclenchement unique quand remainingMs atteint 0
  useEffect(() => {
    if (!running || hasRung || !deadline) return
    if (remainingMs > 0) return

    setRunning(false)
    setHasRung(true)

    if (!playingRef.current) {
      playingRef.current = true
      playBell().finally(() => { playingRef.current = false })
    }
  }, [running, hasRung, deadline, remainingMs])

  // Protection retour d’arrière-plan
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(Date.now())
    })
    return () => sub.remove()
  }, [])

  const value = useMemo<TimerCtx>(() => ({
    running,
    remainingMs,
    deadline,
    hasRung,
    start,
    pause,
    reset,
  }), [running, remainingMs, deadline, hasRung, start, pause, reset])

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>
}

export function useTimer() {
  const ctx = useContext(TimerContext)
  if (!ctx) throw new Error('useTimer must be used within TimerProvider')
  return ctx
}
