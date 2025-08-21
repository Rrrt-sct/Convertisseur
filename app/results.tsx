import { router, useLocalSearchParams } from 'expo-router'
import React, { useMemo } from 'react'
import { Button, Card, Separator, Text, XStack, YStack } from 'tamagui'

// Même base que dans select (tu peux later factoriser dans /constants)
const DB: Record<string, {
  label: string
  gPerTbsp: number
  gPerTsp: number
  avgUnitG: number
  peeledFactor: number
}> = {
  farine:  { label:'Farine',       gPerTbsp:8,  gPerTsp:3,  avgUnitG:0,   peeledFactor:1.00 },
  sucre:   { label:'Sucre',        gPerTbsp:12, gPerTsp:4,  avgUnitG:0,   peeledFactor:1.00 },
  sel:     { label:'Sel fin',      gPerTbsp:18, gPerTsp:6,  avgUnitG:0,   peeledFactor:1.00 },
  huile:   { label:'Huile',        gPerTbsp:14, gPerTsp:5,  avgUnitG:0,   peeledFactor:1.00 },
  lait:    { label:'Lait',         gPerTbsp:15, gPerTsp:5,  avgUnitG:0,   peeledFactor:1.00 },
  riz:     { label:'Riz cru',      gPerTbsp:12, gPerTsp:4,  avgUnitG:0,   peeledFactor:1.00 },
  beurre:  { label:'Beurre',       gPerTbsp:14, gPerTsp:5,  avgUnitG:0,   peeledFactor:1.00 },
  carotte: { label:'Carotte',      gPerTbsp:0,  gPerTsp:0,  avgUnitG:60,  peeledFactor:0.90 },
  pomme:   { label:'Pomme',        gPerTbsp:0,  gPerTsp:0,  avgUnitG:180, peeledFactor:0.90 },
  oignon:  { label:'Oignon',       gPerTbsp:0,  gPerTsp:0,  avgUnitG:110, peeledFactor:0.88 },
  ail:     { label:'Gousse d’ail', gPerTbsp:0,  gPerTsp:0,  avgUnitG:4,   peeledFactor:0.95 },
}

function Row({ left, right }: { left: string; right: string }) {
  return (
    <XStack ai="center" jc="space-between">
      <Text>{left}</Text>
      <Text fontWeight="700">{right}</Text>
    </XStack>
  )
}

export default function Results() {
  const { items } = useLocalSearchParams<{ items?: string }>()
  const ids: string[] = useMemo(() => {
    try { return items ? JSON.parse(items) : [] } catch { return [] }
  }, [items])

  return (
    <YStack f={1} bg="$background" p="$4" gap="$4">
      <XStack ai="center" jc="space-between">
        <Text fontSize={22} fontWeight="800">Conversions</Text>
        <Button size="$3" variant="outlined" onPress={() => router.back()}>↩︎ Modifier</Button>
      </XStack>

      {ids.length === 0 && (
        <Text>Pas d’ingrédients sélectionnés.</Text>
      )}

      <YStack gap="$4" pb="$6">
        {ids.map((id) => {
          const d = DB[id]
          if (!d) return null

          const tbsp = d.gPerTbsp ? `${d.gPerTbsp} g` : '—'
          const tsp  = d.gPerTsp  ? `${d.gPerTsp} g`  : '—'
          const unit = d.avgUnitG ? `${d.avgUnitG} g` : '—'
          const peeled =
            d.avgUnitG && d.peeledFactor
              ? `${Math.round(d.avgUnitG * d.peeledFactor)} g`
              : '—'

          return (
            <Card key={id} p="$4" br="$8" bordered elevate>
              <Text fontWeight="800" fontSize={18} mb="$3">{d.label}</Text>

              <YStack gap="$2">
                <Row left="1 c. à soupe ↔ g" right={tbsp} />
                <Row left="1 c. à café ↔ g"  right={tsp} />
                <Row left="1 pièce moyenne"  right={unit} />
                <Row left="Épluché (par pièce)" right={peeled} />
              </YStack>

              <Separator my="$3" />

              {/* Exemples rapides utiles */}
              <YStack gap="$1">
                {!!d.gPerTbsp && <Text>2 c. à soupe ≈ <Text fontWeight="700">{d.gPerTbsp * 2} g</Text></Text>}
                {!!d.gPerTsp  && <Text>3 c. à café ≈ <Text fontWeight="700">{d.gPerTsp * 3} g</Text></Text>}
              </YStack>
            </Card>
          )
        })}
      </YStack>
    </YStack>
  )
}
