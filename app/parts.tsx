// app/parts.tsx
import { router } from 'expo-router'
import React, { useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'

/** ========= Helpers ========= */
const toNum = (s: string): number => {
  const cleaned = (s ?? '')
    .toString()
    .replace(/\u00A0/g, '')  // NBSP
    .replace(/\s+/g, '')     // espaces
    .replace(',', '.')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : NaN
}

const nf = new Intl.NumberFormat('fr-FR', { useGrouping: false, maximumFractionDigits: 4 })
const fmt = (n: number) => (Number.isFinite(n) ? nf.format(n) : '')

/**
 * Essaie de trouver le 1er nombre dans une chaîne (ex: "250 g farine" -> 250),
 * renvoie { qty, before, after } pour reconstruire joliment.
 */
function extractFirstNumber(s: string): { qty: number | null; before: string; after: string } {
  if (!s) return { qty: null, before: '', after: '' }
  const m = s.match(/([-+]?\d+(?:[.,]\d+)?)/)
  if (!m) return { qty: null, before: '', after: s.trim() }
  const idx = m.index ?? 0
  const qty = toNum(m[0])
  const before = s.slice(0, idx).trim()
  const after = s.slice(idx + m[0].length).trim()
  return { qty: Number.isFinite(qty) ? qty : null, before, after }
}

function scaleLine(line: string, factor: number): { initial: string; scaled: string } {
  const { qty, before, after } = extractFirstNumber(line)
  const initial = line?.trim() || ''
  if (qty == null || !Number.isFinite(factor) || factor <= 0) {
    return { initial, scaled: '' }
  }
  const scaledQty = qty * factor
  const parts = [before, fmt(scaledQty), after].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
  return { initial, scaled: parts }
}

/** ========= Écran ========= */
export default function PartsConverterScreen() {
  const [origParts, setOrigParts] = useState<string>('')
  const [targetParts, setTargetParts] = useState<string>('')

  // 10 ingrédients (2 colonnes x 5 lignes)
  const [rows, setRows] = useState<[string, string][]>([
    ['', ''],
    ['', ''],
    ['', ''],
    ['', ''],
    ['', ''],
  ])

  const factor = useMemo(() => {
    const a = toNum(origParts)
    const b = toNum(targetParts)
    if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0) return NaN
    return b / a
  }, [origParts, targetParts])

  const [showResults, setShowResults] = useState(false)

  const results = useMemo(() => {
    const f = factor
    return rows.map(([l, r]) => [scaleLine(l, f), scaleLine(r, f)] as const)
  }, [rows, factor])

  const canConvert =
    Number.isFinite(factor) &&
    factor > 0 &&
    rows.some(([a, b]) => (a && extractFirstNumber(a).qty != null) || (b && extractFirstNumber(b).qty != null))

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={st.container} contentContainerStyle={{ padding: 16, paddingTop: 28 }}>
        {/* Header */}
        <View style={st.headerWrap}>
          <Text style={st.h1}>🍽️ Conversion de parts</Text>
          <View style={st.actionsWrap}>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={st.actionLink}>↩︎ Retour</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Paramètres */}
        <View style={st.card}>
          <Text style={st.sTitle}>Paramètres</Text>

          <View style={st.row}>
            <Text style={st.k}>Parts (recette d’origine)</Text>
            <TextInput
              style={st.input}
              value={origParts}
              onChangeText={setOrigParts}
              placeholder="ex: 4"
              keyboardType="numeric"
              placeholderTextColor="#FF92E0"
            />
          </View>

          <View style={st.row}>
            <Text style={st.k}>Parts souhaitées</Text>
            <TextInput
              style={st.input}
              value={targetParts}
              onChangeText={setTargetParts}
              placeholder="ex: 6"
              keyboardType="numeric"
              placeholderTextColor="#FF92E0"
            />
          </View>

          <View style={[st.row, { marginTop: 6 }]}>
            <Text style={st.k}>Facteur</Text>
            <View style={[st.input, st.inputReadonly]}>
              <Text style={st.resultText}>{Number.isFinite(factor) && factor > 0 ? fmt(factor) : '—'}</Text>
            </View>
          </View>
        </View>

        {/* Valeurs à convertir */}
        <View style={st.card}>
          <Text style={st.sTitle}>Valeurs à convertir</Text>

          {rows.map(([left, right], rowIdx) => {
            const n1 = rowIdx * 2 + 1
            const n2 = n1 + 1
            const resLeft = results[rowIdx]?.[0]
            const resRight = results[rowIdx]?.[1]
            const show = showResults && Number.isFinite(factor) && factor > 0

            return (
              <View key={rowIdx} style={st.blockRow}>
                <View style={st.duo}>
                  {/* Colonne gauche */}
                  <View style={st.duoCell}>
                    <Text style={st.subLabel}>Ingrédient {n1}</Text>
                    <TextInput
                      style={st.input}
                      value={left}
                      onChangeText={(t) =>
                        setRows(prev => prev.map((r, i) => (i === rowIdx ? [t, r[1]] : r)))
                      }
                      placeholder="ex: 250 g farine"
                      keyboardType="default"
                      placeholderTextColor="#FF92E0"
                    />
                    {show && resLeft?.scaled ? (
                      <View style={st.resultBox}>
                        <Text style={st.resultMini}>
                          <Text style={st.resultMiniK}>Converti</Text> : {resLeft.scaled}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Colonne droite */}
                  <View style={st.duoCell}>
                    <Text style={st.subLabel}>Ingrédient {n2}</Text>
                    <TextInput
                      style={st.input}
                      value={right}
                      onChangeText={(t) =>
                        setRows(prev => prev.map((r, i) => (i === rowIdx ? [r[0], t] : r)))
                      }
                      placeholder="ex: 50 g sucre"
                      keyboardType="default"
                      placeholderTextColor="#FF92E0"
                    />
                    {show && resRight?.scaled ? (
                      <View style={st.resultBox}>
                        <Text style={st.resultMini}>
                          <Text style={st.resultMiniK}>Converti</Text> : {resRight.scaled}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>
            )
          })}

          {/* Actions */}
          <TouchableOpacity
            onPress={() => setShowResults(true)}
            activeOpacity={0.9}
            style={[st.cta, !canConvert && st.ctaDisabled]}
            disabled={!canConvert}
          >
            <Text style={st.ctaText}>Convertir</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setShowResults(false)
              setRows(prev => prev.map(() => ['', '']))
            }}
            activeOpacity={0.9}
            style={[st.cta, st.ctaGhost]}
          >
            <Text style={[st.ctaText, { color: '#FF4FA2' }]}>Effacer</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  )
}

/** ========= Styles ========= */
const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFEEFC' },

  headerWrap: { marginBottom: 12 },
  h1: { fontSize: 24, fontWeight: '900', color: '#FF4FA2' },
  actionsWrap: {
    marginTop: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'center',
  },
  actionLink: { fontWeight: '900', color: '#7c3aed' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    shadowColor: '#FF8FCD',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 2,
    borderColor: '#FFB6F9',
  },

  sTitle: { fontWeight: '900', color: '#444', marginBottom: 8 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  k: {
    color: '#57324B',
    fontWeight: '800',
    minWidth: 160,
    maxWidth: 200,
    flexShrink: 1,
  },
  input: {
    flex: 1,
    backgroundColor: '#FFF0FA',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#FFB6F9',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#FF4FA2',
  },
  inputReadonly: {
    justifyContent: 'center',
    opacity: 0.97,
  },
  resultText: {
    color: '#FF4FA2',
    fontSize: 16,
    fontWeight: '700',
  },

  // Grille 2 colonnes
  blockRow: { marginBottom: 10 },
  duo: { flexDirection: 'row', gap: 8 },
  duoCell: { flex: 1 },
  subLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#7a6680',
    marginBottom: 4,
    paddingLeft: 6,
  },

  // Résultats sous chaque champ
  resultBox: {
    marginTop: 6,
    backgroundColor: '#FFF6FB',
    borderColor: '#FFB6F9',
    borderWidth: 1,
    borderRadius: 10,
    padding: 8,
  },
  resultMini: { color: '#57324B', fontWeight: '600' },
  resultMiniK: { color: '#7a3c84', fontWeight: '900' },

  // CTA
  cta: {
    marginTop: 8,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#FF92E0',
    alignItems: 'center',
  },
  ctaDisabled: { opacity: 0.5 },
  ctaText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  ctaGhost: {
    backgroundColor: '#FFE4F6',
    borderWidth: 2,
    borderColor: '#FFB6F9',
  },
})
