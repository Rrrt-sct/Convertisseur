// app/index.tsx
import { router } from 'expo-router'
import React from 'react'
import { Image, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native'

export default function HomeScreen() {
  const { height, width } = useWindowDimensions()

  // image = ~60% de la hauteur écran, bornée
  const IMG_H = Math.round(Math.min(640, Math.max(340, height * 0.80)))

  const go = () => router.push('/ingredients') // nouvelle destination

  return (
    <View style={styles.container}>
      {/* IMAGE – hauteur explicite pour éviter toute disparition */}
      <TouchableOpacity style={[styles.imageWrapper, { height: IMG_H }]} onPress={go} activeOpacity={0.9}>
        <Image
          // ⚠️ adapte l’extension si nécessaire (.webp/.png/.jpg)
          source={require('../assets/hero-splash.webp')}
          style={styles.image}
          resizeMode="contain"   // ne coupe ni haut ni bas
        />
      </TouchableOpacity>

      {/* BOUTON – plus haut (moins d’espace bas) */}
      <TouchableOpacity style={styles.button} onPress={go} activeOpacity={0.9}>
        <Text style={styles.buttonText}>ENTRER</Text>
      </TouchableOpacity>
    </View>
  )
}

const ORANGE_FOND = '#F7A14D'
const BEIGE_BTN   = '#FBE9D0'
const BRUN        = '#6B3E1D'

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ORANGE_FOND,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12, // 👈 moins d’espace bas
  },
  imageWrapper: {
    width: '100%',
    marginTop: 8,
    marginBottom: 12,  // 👈 bouton remonte
    borderRadius: 16,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  button: {
    backgroundColor: BEIGE_BTN,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: BRUN,
    paddingVertical: 10,     // fin
    paddingHorizontal: 56,   // allongé
    // remonte visuellement le bouton
    marginBottom: 8,
    // petite ombre douce
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '800',
    color: BRUN,
    letterSpacing: 0.5,
  },
})
