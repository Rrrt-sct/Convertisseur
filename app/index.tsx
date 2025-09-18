// app/index.tsx
import { router } from 'expo-router'
import React, { useMemo } from 'react'
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native'

// On garde un require() (local) : avec le préchargement + require, l’affichage est instantané
const HERO = require('../assets/hero-splash.webp') // adapte l'extension si besoin

export default function HomeScreen() {
  const { height } = useWindowDimensions()

  // image occuppe ~80% hauteur écran, bornée
  const IMG_H = useMemo(
    () => Math.round(Math.min(640, Math.max(340, height * 0.8))),
    [height]
  )

  const go = () => router.push('/ingredients')

  return (
    <View style={styles.container}>
      {/* IMAGE — hauteur explicite + source locale (préchargée dans _layout) */}
      <TouchableOpacity
        style={[styles.imageWrapper, { height: IMG_H }]}
        onPress={go}
        activeOpacity={0.9}
      >
        <Image
          source={HERO}
          // defaultSource améliore encore le rendu immédiat (iOS surtout)
          defaultSource={HERO}
          style={styles.image}
          resizeMode="contain"
          // fondu très court sur Android pour éviter effet flash
          {...(Platform.OS === 'android' ? { fadeDuration: 80 } as any : {})}
        />
      </TouchableOpacity>

      {/* BOUTON */}
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
    paddingBottom: 12,
  },
  imageWrapper: {
    width: '100%',
    marginTop: 8,
    marginBottom: 12,
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
    paddingVertical: 10,
    paddingHorizontal: 56,
    marginBottom: 8,
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
