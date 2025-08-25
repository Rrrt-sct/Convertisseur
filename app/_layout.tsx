// app/_layout.tsx
import { Stack } from 'expo-router'
import React from 'react'
import { TimerProvider } from '../src/timerContext'

export default function RootLayout() {
  return (
    <TimerProvider>
      <Stack screenOptions={{ headerShown: false }}>
        {/* Accueil */}
        <Stack.Screen name="index" />

        {/* Sélection des ingrédients */}
        <Stack.Screen
          name="ingredients"
          options={{ headerShown: true, title: 'Ingrédients' }}
        />

        {/* Convertisseur (kawaii) */}
        <Stack.Screen
          name="convertisseur"
          options={{ headerShown: true, title: 'Convertisseur' }}
        />

        {/* Résultats / convertisseurs */}
        <Stack.Screen
          name="results"
          options={{ headerShown: true, title: 'Convertisseurs' }}
        />

        {/* Minuteur */}
        <Stack.Screen name="timer" options={{ headerShown: false }} />
      </Stack>
    </TimerProvider>
  )
}
