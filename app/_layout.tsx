// app/_layout.tsx
import { Stack } from 'expo-router'
import { TamaguiProvider, Theme } from 'tamagui'
import tamagui from '../tamagui.config'

export default function Layout() {
  return (
    <TamaguiProvider config={tamagui}>
      {/* thème global (change en "dark" si tu veux forcer le sombre) */}
      <Theme name="light">
        <Stack screenOptions={{ headerShown: false }}>
          {/* Accueil (hero + bouton ENTRER) */}
          <Stack.Screen name="index" />

          {/* Sélection des ingrédients */}
          <Stack.Screen
            name="ingredients"
            options={{ headerShown: true, title: 'Ingrédients' }}
          />

          {/* Écran convertisseur (kawaii) */}
          <Stack.Screen
            name="convertisseur"
            options={{ headerShown: true, title: 'Convertisseur' }}
          />
        </Stack>
      </Theme>
    </TamaguiProvider>
  )
}
