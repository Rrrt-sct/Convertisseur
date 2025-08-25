// src/timerContext.ts
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AppState } from 'react-native'

export function msToMMSS(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

type TimerCtx = {
  running: boolean
  remainingMs: number
  durationMs: number
  start: (totalMs: number) => void
  pause: () => void
  reset: () => void
  /** compteur d'événements “fin de minuteur” pour déclencher un son ailleurs */
  finishCount: number
}

const Ctx = createContext<TimerCtx | null>(null)

export const useTimer = () => {
  const v = useContext(Ctx)
  if (!v) throw new Error('useTimer must be used within <TimerProvider>')
  return v
}

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const [running, setRunning] = useState(false)
  const [targetTs, setTargetTs] = useState<number | null>(null)
  const [remainingMs, setRemainingMs] = useState(0)
  const [durationMs, setDurationMs] = useState(0)
  const [finishCount, setFinishCount] = useState(0)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // mise à jour de l'affichage
  useEffect(() => {
    function clear() {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    if (running && targetTs) {
      // tick toutes les 250 ms
      intervalRef.current = setInterval(() => {
        const now = Date.now()
        const rem = Math.max(0, targetTs - now)
        setRemainingMs(rem)

        if (rem <= 0) {
          clear()
          setRunning(false)
          setTargetTs(null)
          setRemainingMs(0)
          // signal “fini”
          setFinishCount((c) => c + 1)
        }
      }, 250)
    } else {
      clear()
    }

    return () => clear()
  }, [running, targetTs])

  // Ajuste immédiatement au retour d'arrière-plan
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active' && running && targetTs) {
        const rem = Math.max(0, targetTs - Date.now())
        setRemainingMs(rem)
        if (rem <= 0) {
          setRunning(false)
          setTargetTs(null)
          setRemainingMs(0)
          setFinishCount((c) => c + 1)
        }
      }
    })
    return () => sub.remove()
  }, [running, targetTs])

  // API
  const start = (totalMs: number) => {
    const ms = Math.max(0, Math.floor(totalMs || 0))
    if (ms <= 0) return
    const now = Date.now()
    setDurationMs(ms)
    setTargetTs(now + ms)
    setRemainingMs(ms) // affichage immédiat
    setRunning(true)
  }

  const pause = () => {
    if (!running) return
    const rem = targetTs ? Math.max(0, targetTs - Date.now()) : remainingMs
    setRunning(false)
    setTargetTs(null)
    setRemainingMs(rem)
  }

  const reset = () => {
    setRunning(false)
    setTargetTs(null)
    setRemainingMs(0)
  }

  const value = useMemo(
    () => ({
      running,
      remainingMs,
      durationMs,
      start,
      pause,
      reset,
      finishCount,
    }),
    [running, remainingMs, durationMs, finishCount]
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
