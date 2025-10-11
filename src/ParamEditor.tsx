// src/ParamEditor.tsx
import React, { useEffect, useState } from 'react'
import { Modal, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { clearOverrides, loadOverrides, normalizeId, saveOverridesRaw } from './useIngredientOverrides'

type Spec = {
  key: string
  label: string
  type: 'number' | 'text'
  hint?: string
  toUi?:   (raw: any, allRaw?: Record<string, any>) => any
  fromUi?: (ui: any, helpers?: { getStorage?: (k: string) => any; getUi?: (k: string) => any }) => any
}

type Props = {
  targetId: string
  base: Record<string, any>
  specs: Spec[]
  visible: boolean
  onClose: () => void
  onSaved?: () => void
}

const numUi = (v: any) => {
  const n = Number(String(v ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

export default function ParamEditor(props: Props) {
  const { targetId, base, specs, visible, onClose, onSaved } = props
  const normId = normalizeId(targetId)

  const [form, setForm] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    const run = async () => {
      setLoading(true)
      const existing = await loadOverrides(normId)
      if (!mounted) return

      const initial: Record<string, string> = {}
      for (const s of specs) {
        const raw = (existing[s.key] !== undefined ? existing[s.key] : base[s.key])
        const uiVal = s.toUi ? s.toUi(raw, existing) : raw
        initial[s.key] = uiVal !== undefined && uiVal !== null ? String(uiVal) : ''
      }
      setForm(initial)
      setLoading(false)
    }
    run()
    return () => { mounted = false }
  }, [normId, specs, base, visible])

  const handleChange = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    const toSave: Record<string, any> = {}
    const getStorage = (k: string) => {
      const v = toSave[k]
      return v === undefined ? (base as any)[k] : v
    }
    const getUi = (k: string) => form[k]

    for (const s of specs) {
      const ui = form[s.key]
      if (ui === undefined || ui === null || String(ui).trim() === '') continue

      if (s.fromUi) {
        toSave[s.key] = s.fromUi(ui, { getStorage, getUi })
      } else {
        toSave[s.key] = s.type === 'number' ? numUi(ui) : ui
      }
    }

    await saveOverridesRaw(normId, toSave)
    onSaved?.()
    onClose()
  }

  const handleReset = async () => {
    await clearOverrides(normId)
    onSaved?.()
    onClose()
  }

  if (!visible) return null

  const Card = (
    <View
      style={{
        width: '92%',
        maxWidth: 520,
        backgroundColor: '#fff',
        borderRadius: 18,
        padding: 14,
        borderWidth: 2,
        borderColor: '#FFB6F9',
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 10,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <Text style={{ flex: 1, fontWeight: '900', fontSize: 16, color: '#FF4FA2' }}>
          Paramètres personnalisés
        </Text>
        <TouchableOpacity
          onPress={onClose}
          style={{
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 10,
            backgroundColor: '#FFE4F6',
            borderWidth: 1,
            borderColor: '#FFB6F9',
          }}
        >
          <Text style={{ fontWeight: '900', fontSize: 12, color: '#7a3c84' }}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ paddingBottom: 8 }}>
        {loading ? (
          <Text style={{ color: '#57324B' }}>Chargement…</Text>
        ) : (
          specs.map((s) => (
            <View key={s.key} style={{ marginBottom: 10 }}>
              <Text style={{ fontWeight: '800', color: '#444', marginBottom: 4 }}>{s.label}</Text>
              <TextInput
                value={form[s.key] ?? ''}
                onChangeText={(t) => handleChange(s.key, t)}
                placeholder={s.hint ?? ''}
                keyboardType={s.type === 'number' ? 'numeric' : 'default'}
                style={{
                  backgroundColor: '#FFF0FA',
                  borderRadius: 14,
                  borderWidth: 2,
                  borderColor: '#FFB6F9',
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  fontSize: 16,
                  color: '#FF4FA2',
                }}
                placeholderTextColor="#ff8fcd"
              />
            </View>
          ))
        )}
      </ScrollView>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
        <TouchableOpacity
          onPress={handleReset}
          activeOpacity={0.9}
          style={{
            paddingVertical: 10,
            paddingHorizontal: 14,
            borderRadius: 999,
            borderWidth: 2,
            borderColor: '#FFB6F9',
            backgroundColor: '#FFE4F6',
          }}
        >
          <Text style={{ fontWeight: '900', color: '#FF4FA2' }}>Réinitialiser</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleSave}
          activeOpacity={0.9}
          style={{
            paddingVertical: 10,
            paddingHorizontal: 14,
            borderRadius: 999,
            borderWidth: 2,
            borderColor: '#FF4FA2',
            backgroundColor: '#FF92E0',
          }}
        >
          <Text style={{ fontWeight: '900', color: '#fff' }}>Enregistrer</Text>
        </TouchableOpacity>
      </View>
    </View>
  )

  if (Platform.OS === 'web') {
    return (
      <View
        style={{
          position: 'absolute',
          left: 0, right: 0, top: 0, bottom: 0,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.35)',
          padding: 12,
          zIndex: 9999,
        }}
      >
        {Card}
      </View>
    )
  }

  return (
    <Modal transparent visible onRequestClose={onClose} animationType="fade">
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.35)',
          padding: 12,
        }}
      >
        {Card}
      </View>
    </Modal>
  )
}
