import { router } from 'expo-router'
import React from 'react'
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'

export default function ConvertisseurScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>✨ Convertisseur Kawaii 💖</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Valeur à convertir</Text>
        <TextInput style={styles.input} placeholder="ex: 2 c. à s." placeholderTextColor="#ff8fcd" />

        <Text style={styles.label}>Ingrédient</Text>
        <TextInput style={styles.input} placeholder="ex: farine" placeholderTextColor="#ff8fcd" />

        <TouchableOpacity style={styles.cta} onPress={() => {}}>
          <Text style={styles.ctaText}>💫 Convertir</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
        <Text style={{ color: '#ff4fa2', fontWeight: '700' }}>⬅️ Retour</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFEEFC', alignItems: 'center', justifyContent: 'center', padding: 20 },
  title: { fontSize: 26, fontWeight: '900', color: '#FF4FA2', marginBottom: 20, textShadowColor: '#fff', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 3 },
  card: { width: '92%', backgroundColor: '#fff', borderRadius: 24, padding: 20, shadowColor: '#FF8FCD', shadowOpacity: 0.2, shadowRadius: 10, elevation: 8 },
  label: { fontSize: 15, fontWeight: '700', color: '#FF69B4', marginBottom: 6 },
  input: { backgroundColor: '#FFF0FA', borderRadius: 14, borderWidth: 2, borderColor: '#FFB6F9', padding: 12, fontSize: 16, color: '#FF4FA2', marginBottom: 14 },
  cta: { backgroundColor: '#FF92E0', borderRadius: 999, paddingVertical: 14, alignItems: 'center', elevation: 4, shadowColor: '#FF4FA2', shadowOpacity: 0.3, shadowRadius: 6 },
  ctaText: { color: '#fff', fontWeight: '900', fontSize: 18 },
})
