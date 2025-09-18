// app/_layout.tsx
import { Asset } from 'expo-asset'
import { Stack } from 'expo-router'
import React, { useEffect } from 'react'
import { TimerProvider } from '../src/timerContext'

export default function RootLayout() {
  useEffect(() => {
    // Précharge l’image d’accueil au démarrage
    const preload = async () => {
      try {
        const mod = require('../assets/hero-splash.webp') // adapte l'extension si besoin
        await Asset.fromModule(mod).downloadAsync()
      } catch (e) {
        console.warn('Préchargement hero-splash raté', e)
      }
    }
    preload()
  }, [])

  return (
    <TimerProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen
          name="ingredients"
          options={{ headerShown: true, title: 'Ingrédients' }}
        />
        <Stack.Screen
          name="convertisseur"
          options={{ headerShown: true, title: 'Convertisseur' }}
        />
        <Stack.Screen
          name="results"
          options={{ headerShown: true, title: 'Convertisseurs' }}
        />
        <Stack.Screen name="timer" options={{ headerShown: false }} />
      </Stack>
    </TimerProvider>
  )
}
