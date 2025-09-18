// src/bell.ts
import { Audio } from 'expo-av'

let sound: Audio.Sound | null = null
let loading: Promise<void> | null = null

export async function prepareBell() {
  if (sound || loading) return loading || Promise.resolve()
  loading = (async () => {
    sound = new Audio.Sound()
    await sound.loadAsync(require('../assets/bell.mp3'), { shouldPlay: false })
  })()
  return loading
}

export async function playBell() {
  await prepareBell()
  if (!sound) return
  try {
    await sound.setPositionAsync(0)
    await sound.playAsync()
  } catch {}
}

export async function unloadBell() {
  if (sound) {
    try { await sound.unloadAsync() } catch {}
    sound = null
    loading = null
  }
}
