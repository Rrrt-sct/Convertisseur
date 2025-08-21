// app/ingredients.tsx
import { router } from 'expo-router'
import React, { useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'

const DB = [
  'Farine','Sucre','Sel','Beurre','Huile','Lait',
  'Riz','Pâtes','Cacao','Amande','Noisette',
  'Carotte','Pomme','Poire','Oignon','Ail','Tomate',
  'Pommes de terre','Courgette','Poivron','Citron'
]

export default function IngredientsScreen() {
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<string[]>([])

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return s ? DB.filter(x => x.toLowerCase().includes(s)) : DB
  }, [q])

  const toggle = (name: string) =>
    setSel(prev => prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name])

  const validate = () => {
    // plus tard: router.push({ pathname:'/convertisseur', params:{ items: JSON.stringify(sel) }})
    router.push('/convertisseur') // pour l’instant on enchaîne vers l’écran suivant
  }

  return (
    <View style={st.container}>
      <Text style={st.title}>🧺 Ingrédients</Text>

      <View style={st.card}>
        <TextInput
          style={st.input}
          value={q}
          onChangeText={setQ}
          placeholder="Rechercher un ingrédient…"
          placeholderTextColor="#ff8fcd"
        />

        <ScrollView contentContainerStyle={st.chipsWrap} keyboardShouldPersistTaps="handled">
          {list.map((name) => {
            const on = sel.includes(name)
            return (
              <TouchableOpacity
                key={name}
                onPress={() => toggle(name)}
                activeOpacity={0.9}
                style={[st.chip, on && st.chipOn]}
              >
                <Text style={[st.chipText, on && st.chipTextOn]}>{name}</Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>

        <TouchableOpacity
          onPress={validate}
          disabled={sel.length === 0}
          activeOpacity={0.9}
          style={[st.cta, sel.length === 0 && { opacity: 0.5 }]}
        >
          <Text style={st.ctaText}>Valider ({sel.length})</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFEEFC', padding: 18, paddingTop: 36 },
  title: { fontSize: 26, fontWeight: '900', color: '#FF4FA2', marginBottom: 14 },
  card: {
    flex: 1, backgroundColor: '#fff', borderRadius: 22, padding: 14,
    shadowColor: '#FF8FCD', shadowOpacity: 0.18, shadowRadius: 10, elevation: 6
  },
  input: {
    backgroundColor: '#FFF0FA', borderRadius: 14, borderWidth: 2, borderColor: '#FFB6F9',
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, color: '#FF4FA2', marginBottom: 10
  },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingVertical: 6 },
  chip: {
    paddingVertical: 10, paddingHorizontal: 14,
    backgroundColor: '#FFE4F6', borderRadius: 999, borderWidth: 2, borderColor: '#FFB6F9'
  },
  chipOn: { backgroundColor: '#FF92E0', borderColor: '#FF4FA2' },
  chipText: { color: '#FF4FA2', fontWeight: '700' },
  chipTextOn: { color: '#fff' },
  cta: {
    marginTop: 14, backgroundColor: '#FF92E0', borderRadius: 999, alignItems: 'center',
    paddingVertical: 14, shadowColor: '#FF4FA2', shadowOpacity: 0.28, shadowRadius: 6, elevation: 5
  },
  ctaText: { color: '#fff', fontSize: 18, fontWeight: '900' },
})
