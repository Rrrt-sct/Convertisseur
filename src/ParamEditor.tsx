// src/ParamEditor.tsx
import React, { useEffect, useState } from 'react'
import { Modal, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { clearOverrides, loadOverrides, normalizeId, saveOverridesRaw } from './useIngredientOverrides'

type Spec = {
  key: string
  label: string
  type: 'number' | 'text'
  hint?: string
}

type Props = {
  targetId: string
  base: Record<string, any>
  specs: Spec[]
  visible: boolean
  onClose: () => void
  /** Appelé après save/reset pour permettre au parent (results.tsx) de recharger et mettre à jour le bandeau */
  onSaved?: () => void
}

export default function ParamEditor(props: Props) {
  const { targetId, base, specs, visible, onClose, onSaved } = props
  const normId = normalizeId(targetId)

  // Valeurs d’édition (string pour TextInput)
  const [form, setForm] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  // Charger les overrides existants et pré-remplir
  useEffect(() => {
    let mounted = true
    const run = async () => {
      setLoading(true)
      const existing = await loadOverrides(normId)
      if (!mounted) return

      const initial: Record<string, string> = {}
      for (const s of specs) {
        // priorité à l’override si présent, sinon valeur de base si dispo
        const v =
          existing[s.key] ??
          (base[s.key] !== undefined && base[s.key] !== null ? String(base[s.key]) : '')
        initial[s.key] = String(v ?? '')
      }
      setForm(initial)
      setLoading(false)
    }
    run()
    return () => {
      mounted = false
    }
  }, [normId, specs, base, visible])

  const handleChange = (k: string, v: string) => {
    setForm((f) => ({ ...f, [k]: v }))
  }

  const handleSave = async () => {
    // On ne stocke que les champs non vides
    const toSave: Record<string, any> = {}
    for (const s of specs) {
      const raw = form[s.key]
      if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
        toSave[s.key] = s.type === 'number' ? Number(String(raw).replace(',', '.')) : raw
      }
    }
    await saveOverridesRaw(normId, toSave)
    onSaved?.()     // pour que le parent recharge (bandeau, recalculs)
    onClose()
  }

  const handleReset = async () => {
    await clearOverrides(normId)
    onSaved?.()     // pour que le parent recharge
    onClose()
  }

  if (!visible) return null

  // UI modal centrée (Modal natif iOS/Android, et fallback web)
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
    // overlay centré pour le web
    return (
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
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
