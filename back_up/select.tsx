import { router } from 'expo-router'
import React, { useMemo, useState } from 'react'
import { Button, Card, Input, ScrollView, Text, XStack, YStack } from 'tamagui'

// Mini base d’ingrédients (exemples)
const INGREDIENTS = [
  { id: 'farine',      label: 'Farine',        gPerTbsp: 8,  gPerTsp: 3,  avgUnitG: 0,   peeledFactor: 1.00 },
  { id: 'sucre',       label: 'Sucre',         gPerTbsp: 12, gPerTsp: 4,  avgUnitG: 0,   peeledFactor: 1.00 },
  { id: 'sel',         label: 'Sel fin',       gPerTbsp: 18, gPerTsp: 6,  avgUnitG: 0,   peeledFactor: 1.00 },
  { id: 'huile',       label: 'Huile',         gPerTbsp: 14, gPerTsp: 5,  avgUnitG: 0,   peeledFactor: 1.00 },
  { id: 'lait',        label: 'Lait',          gPerTbsp: 15, gPerTsp: 5,  avgUnitG: 0,   peeledFactor: 1.00 },
  { id: 'riz',         label: 'Riz cru',       gPerTbsp: 12, gPerTsp: 4,  avgUnitG: 0,   peeledFactor: 1.00 },
  { id: 'beurre',      label: 'Beurre',        gPerTbsp: 14, gPerTsp: 5,  avgUnitG: 0,   peeledFactor: 1.00 },
  { id: 'carotte',     label: 'Carotte',       gPerTbsp: 0,  gPerTsp: 0,  avgUnitG: 60,  peeledFactor: 0.90 },
  { id: 'pomme',       label: 'Pomme',         gPerTbsp: 0,  gPerTsp: 0,  avgUnitG: 180, peeledFactor: 0.90 },
  { id: 'oignon',      label: 'Oignon',        gPerTbsp: 0,  gPerTsp: 0,  avgUnitG: 110, peeledFactor: 0.88 },
  { id: 'ail',         label: 'Gousse d’ail',  gPerTbsp: 0,  gPerTsp: 0,  avgUnitG: 4,   peeledFactor: 0.95 },
]

export default function Select() {
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<string[]>([])

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return !s ? INGREDIENTS
      : INGREDIENTS.filter(i => i.label.toLowerCase().includes(s) || i.id.includes(s))
  }, [q])

  const toggle = (id: string) =>
    setSel(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const goResults = () => {
    const payload = JSON.stringify(sel)
    router.push({ pathname: '/results', params: { items: payload } })
  }

  return (
    <YStack f={1} bg="$background" p="$4" gap="$4">
      <Text fontSize={22} fontWeight="800">Sélection d’ingrédients</Text>

      {/* Recherche */}
      <Input
        placeholder="Rechercher… (ex: farine, sucre, carotte)"
        value={q}
        onChangeText={setQ}
      />

      {/* Sélection en cours */}
      {sel.length > 0 && (
        <XStack flexWrap="wrap" gap="$2">
          {sel.map(id => {
            const it = INGREDIENTS.find(i => i.id === id)!
            return (
              <Button
                key={id}
                size="$3"
                bg="$blue10"
                px="$3"
                br="$8"
                onPress={() => toggle(id)}
              >
                <Text color="white">{it.label} ✕</Text>
              </Button>
            )
          })}
        </XStack>
      )}

      {/* Liste filtrée */}
      <ScrollView style={{ flex: 1 }}>
        <YStack gap="$3" pb="$6">
          {list.map(it => {
            const on = sel.includes(it.id)
            return (
              <Card
                key={it.id}
                p="$3"
                br="$8"
                bordered
                bg={on ? '$blue4' : '$background'}
                pressStyle={{ scale: 0.98 }}
                onPress={() => toggle(it.id)}
              >
                <XStack ai="center" jc="space-between">
                  <Text fontSize={16} fontWeight="700">{it.label}</Text>
                  <Button size="$3" variant={on ? 'solid' : 'outlined'}>
                    {on ? 'Ajouté' : 'Ajouter'}
                  </Button>
                </XStack>
              </Card>
            )
          })}
        </YStack>
      </ScrollView>

      {/* Valider */}
      <Button
        bg="$blue10"
        br="$10"
        px="$6"
        py="$3"
        disabled={sel.length === 0}
        opacity={sel.length === 0 ? 0.5 : 1}
        onPress={goResults}
      >
        <Text color="white" fontWeight="800">Valider ({sel.length})</Text>
      </Button>
    </YStack>
  )
}
