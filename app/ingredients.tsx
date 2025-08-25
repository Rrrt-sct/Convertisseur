// app/ingredients.tsx
import { router } from 'expo-router'
import React, { useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'

// ✅ Charger le JSON via require (compatible Metro)
const RAW: any[] = require('../data/ingredients.json')

type Item = {
  id: string
  label: string
  avg_unit_g?: number | null
  peeled_yield?: number | null
  juice_ml_per_unit?: number | null
  lgth_g?: number | null
  tbsp_g?: number | null
  tsp_g?: number | null
}

/** Donne un id et un label sûrs même si le CSV est incomplet */
function normalizeRow(x: any): Item | null {
  const rawId = (x?.id ?? x?.label ?? '').toString().trim()
  const id = rawId || `item_${Math.random().toString(36).slice(2)}`
  const rawLabel = (x?.label ?? x?.id ?? '').toString().trim()
  if (!rawLabel && !rawId) return null
  const label = (rawLabel || rawId)
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^\w/, (m) => m.toUpperCase())

  return {
    id,
    label,
    avg_unit_g: toNum(x?.avg_unit_g),
    peeled_yield: toNum(x?.peeled_yield),
    juice_ml_per_unit: toNum(x?.juice_ml_per_unit),
    lgth_g: toNum(x?.lgth_g),
    tbsp_g: toNum(x?.tbsp_g),
    tsp_g: toNum(x?.tsp_g),
  }
}

function toNum(v: any): number | null {
  if (v === undefined || v === null || v === '') return null
  const n = Number(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

export default function IngredientsScreen() {
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<string[]>([])

  // ✅ Normalise + trie en sécurité
  const list = useMemo(() => {
    const base = (Array.isArray(RAW) ? RAW : []).map(normalizeRow).filter(Boolean) as Item[]
    const s = q.trim().toLowerCase()
    const sorted = base.sort((a, b) =>
      (a.label ?? '').localeCompare(b.label ?? '', 'fr', { sensitivity: 'base' }),
    )
    return s
      ? sorted.filter(
          (x) => x.label.toLowerCase().includes(s) || x.id.toLowerCase().includes(s),
        )
      : sorted
  }, [q])

  const toggle = (id: string) =>
    setSel((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const validate = () => {
    if (sel.length === 0) return
    router.push({ pathname: '/results', params: { items: JSON.stringify(sel) } })
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
          {list.map((it) => {
            const on = sel.includes(it.id)
            return (
              <TouchableOpacity
                key={it.id}
                onPress={() => toggle(it.id)}
                activeOpacity={0.9}
                style={[st.chip, on && st.chipOn]}
              >
                <Text style={[st.chipText, on && st.chipTextOn]}>{it.label}</Text>
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
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 14,
    shadowColor: '#FF8FCD',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 6,
  },
  input: {
    backgroundColor: '#FFF0FA',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#FFB6F9',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: '#FF4FA2',
    marginBottom: 10,
  },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingVertical: 6 },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#FFE4F6',
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#FFB6F9',
  },
  chipOn: { backgroundColor: '#FF92E0', borderColor: '#FF4FA2' },
  chipText: { color: '#FF4FA2', fontWeight: '700' },
  chipTextOn: { color: '#fff' },
  cta: {
    marginTop: 14,
    backgroundColor: '#FF92E0',
    borderRadius: 999,
    alignItems: 'center',
    paddingVertical: 14,
    shadowColor: '#FF4FA2',
    shadowOpacity: 0.28,
    shadowRadius: 6,
    elevation: 5,
  },
  ctaText: { color: '#fff', fontSize: 18, fontWeight: '900' },
})
