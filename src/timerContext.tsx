// src/timerContext.tsx
import React, {
  createContext, useCallback, useContext, useEffect,
  useMemo, useRef, useState
} from 'react'
import { AppState } from 'react-native'
import { playBell, prepareBell } from './bell'

export type TimerItem = {
  id: string
  name: string
  running: boolean
  deadline: number | null
  hasRung: boolean
  createdAt: number
}

export type DoneEvent = {
  id: string
  name: string
  at: number
}

export type TimersCtx = {
  // état
  timers: TimerItem[]
  activeId: string | null
  now: number

  // événement "prêt!"
  doneEvent: DoneEvent | null
  clearDoneEvent: () => void

  // dérivés
  remainingMsById: (id: string) => number
  primary: TimerItem | null

  // actions
  addTimer: (name?: string) => string
  removeTimer: (id: string) => void
  setPrimary: (id: string) => void
  setName: (id: string, name: string) => void
  startTimer: (id: string, durationMs: number) => void
  pauseTimer: (id: string) => void
  resetTimer: (id: string) => void
}

const TimersContext = createContext<TimersCtx | undefined>(undefined)

export function msToMMSS(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

const newId = () => Math.random().toString(36).slice(2)

export const TimerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [timers, setTimers] = useState<TimerItem[]>(() => [
    { id: newId(), name: '', running: false, deadline: null, hasRung: false, createdAt: Date.now() }
  ])
  const [activeId, setActiveId] = useState<string | null>(() => timers[0]?.id ?? null)

  // horloge commune (tick léger)
  const [now, setNow] = useState(() => Date.now())
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const playingRef = useRef(false)

  // ✅ événement global pour l’overlay
  const [doneEvent, setDoneEvent] = useState<DoneEvent | null>(null)
  const clearDoneEvent = useCallback(() => setDoneEvent(null), [])

  useEffect(() => { prepareBell().catch(() => {}) }, [])

  // tick si au moins un timer tourne
  useEffect(() => {
    const anyRunning = timers.some(t => t.running)
    if (!anyRunning) {
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null }
      return
    }
    if (!tickRef.current) {
      tickRef.current = setInterval(() => setNow(Date.now()), 250)
    }
    return () => {
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null }
    }
  }, [timers])

  // protection retour d'arrière-plan
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(Date.now())
    })
    return () => sub.remove()
  }, [])

  const remainingMsById = useCallback((id: string) => {
    const t = timers.find(x => x.id === id)
    if (!t || !t.deadline) return 0
    return Math.max(0, t.deadline - now)
  }, [timers, now])

  // ✅ Déclenchement “Prêt !” + nom — alimente doneEvent
  useEffect(() => {
    setTimers(prev => prev.map(t => {
      if (!t.running || !t.deadline || t.hasRung) return t
      const remaining = Math.max(0, t.deadline - now)
      if (remaining > 0) return t
      // terminé
      if (!playingRef.current) {
        playingRef.current = true
        playBell().finally(() => { playingRef.current = false })
      }
      // alimente l’overlay avec le NOM figé à l’instant T
      setDoneEvent({
        id: t.id,
        name: (t.name || 'Minuteur').trim(),
        at: Date.now(),
      })
      return { ...t, running: false, hasRung: true }
    }))
  }, [now])

  // actions
  const addTimer = useCallback((name?: string) => {
    const id = newId()
    setTimers(prev => [...prev, {
      id, name: name ?? '', running: false, deadline: null, hasRung: false, createdAt: Date.now()
    }])
    // s’il n’y a pas de principal, on prend le nouveau
    setActiveId(prev => prev ?? id)
    return id
  }, [])

  const removeTimer = useCallback((id: string) => {
    setTimers(prev => prev.filter(t => t.id !== id))
    setActiveId(prev => (prev === id ? null : prev))
  }, [])

  const setPrimary = useCallback((id: string) => setActiveId(id), [])

  const setName = useCallback((id: string, name: string) => {
    setTimers(prev => prev.map(t => t.id === id ? { ...t, name } : t))
  }, [])

  const startTimer = useCallback((id: string, durationMs: number) => {
    const dl = Date.now() + Math.max(0, durationMs)
    setTimers(prev => prev.map(t => t.id === id ? ({
      ...t, deadline: dl, running: durationMs > 0, hasRung: false
    }) : t))
  }, [])

  const pauseTimer = useCallback((id: string) => {
    setTimers(prev => prev.map(t => {
      if (t.id !== id) return t
      if (!t.deadline) return { ...t, running: false }
      const rest = Math.max(0, t.deadline - Date.now())
      return { ...t, deadline: Date.now() + rest, running: false }
    }))
  }, [])

  const resetTimer = useCallback((id: string) => {
    setTimers(prev => prev.map(t => t.id === id ? ({
      ...t, running: false, deadline: null, hasRung: false
    }) : t))
  }, [])

  const primary = useMemo(
    () => (activeId ? timers.find(t => t.id === activeId) ?? null : null),
    [timers, activeId]
  )

  const value = useMemo<TimersCtx>(() => ({
    timers, activeId, now,
    doneEvent, clearDoneEvent,
    remainingMsById,
    primary,
    addTimer, removeTimer, setPrimary, setName,
    startTimer, pauseTimer, resetTimer,
  }), [
    timers, activeId, now,
    doneEvent, clearDoneEvent,
    remainingMsById, primary,
    addTimer, removeTimer, setPrimary, setName, startTimer, pauseTimer, resetTimer
  ])

  return <TimersContext.Provider value={value}>{children}</TimersContext.Provider>
}

// Hook multi-timers
export function useTimers() {
  const ctx = useContext(TimersContext)
  if (!ctx) throw new Error('useTimers must be used within TimerProvider')
  return ctx
}

// Hook “compat” : timer principal pour l’écran /app/timer
export function useTimer() {
  const {
    primary, remainingMsById, startTimer, pauseTimer, resetTimer, setName
  } = useTimers()
  if (!primary) {
    return {
      running: false,
      remainingMs: 0,
      deadline: null,
      hasRung: false,
      start: (_: number) => {},
      pause: () => {},
      reset: () => {},
      displayName: '',
      setDisplayName: (_: string) => {},
    }
  }
  return {
    running: primary.running,
    remainingMs: remainingMsById(primary.id),
    deadline: primary.deadline,
    hasRung: primary.hasRung,
    start: (ms: number) => startTimer(primary.id, ms),
    pause: () => pauseTimer(primary.id),
    reset: () => resetTimer(primary.id),
    displayName: primary.name,
    setDisplayName: (s: string) => setName(primary.id, s),
  }
}
