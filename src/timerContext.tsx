// src/timerContext.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'

type TimerCtx = {
  running: boolean
  remainingMs: number
  durationMs: number
  start: (totalMs: number) => void
  pause: () => void
  reset: () => void
  setRemaining: (ms: number) => void
}

const Ctx = createContext<TimerCtx | null>(null)

export function msToMMSS(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return `${mm}:${ss}`
}

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const [running, setRunning] = useState(false)
  const [targetTs, setTargetTs] = useState<number | null>(null)
  const [remainingMs, setRemainingMs] = useState(0)
  const [durationMs, setDurationMs] = useState(0)

  // tick
  useEffect(() => {
    let raf: number | null = null
    const loop = () => {
      if (!running || targetTs == null) return
      const now = Date.now()
      const left = Math.max(0, targetTs - now)
      setRemainingMs(left)
      if (left === 0) {
        setRunning(false)
        setTargetTs(null)
      } else {
        raf = requestAnimationFrame(loop)
      }
    }
    if (running) raf = requestAnimationFrame(loop)
    return () => { if (raf) cancelAnimationFrame(raf) }
  }, [running, targetTs])

  const start = (totalMs: number) => {
    if (!Number.isFinite(totalMs) || totalMs <= 0) return
    const now = Date.now()
    setTargetTs(now + totalMs)
    setRemainingMs(totalMs)  // affichage immédiat
    setDurationMs(totalMs)   // pour la barre de progression
    setRunning(true)
  }

  const pause = () => {
    if (!running) return
    setRunning(false)
    if (targetTs) {
      const left = Math.max(0, targetTs - Date.now())
      setRemainingMs(left)
      setTargetTs(null)
    }
  }

  const reset = () => {
    setRunning(false)
    setTargetTs(null)
    setRemainingMs(0)
    setDurationMs(0)
  }

  /** Permet d’ajuster la valeur affichée (presets, etc.) sans relancer */
  const setRemaining = (ms: number) => {
    setRemainingMs(Math.max(0, ms | 0))
    setDurationMs((d) => (d > 0 ? d : Math.max(0, ms | 0)))
    setTargetTs(null)
    setRunning(false)
  }

  const value = useMemo(() => ({
    running,
    remainingMs,
    durationMs,
    start,
    pause,
    reset,
    setRemaining,
  }), [running, remainingMs, durationMs])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useTimer() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useTimer must be used within <TimerProvider>')
  return ctx
}
