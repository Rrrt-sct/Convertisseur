// src/useIngredientOverrides.ts

import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useState } from 'react'

/* -------------------------------------------------
 * Normalisation d’un identifiant (sans accents / minuscules)
 * ------------------------------------------------- */
export function normalizeId(s: string) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // supprime les accents
    .replace(/\s+/g, '_')
    .replace(/[^\w-]/g, '')
}

/* -------------------------------------------------
 * Clé de stockage unique
 * ------------------------------------------------- */
const key = (id: string) => `ovr_${normalizeId(id)}`

/* -------------------------------------------------
 * Lecture brute (AsyncStorage)
 * ------------------------------------------------- */
export async function loadOverrides(id: string): Promise<Record<string, any>> {
  try {
    const raw = await AsyncStorage.getItem(key(id))
    if (!raw) return {}
    const data = JSON.parse(raw)
    return data && typeof data === 'object' ? data : {}
  } catch {
    return {}
  }
}

/* -------------------------------------------------
 * Écriture (remplacement complet)
 * ------------------------------------------------- */
export async function saveOverridesRaw(id: string, obj: Record<string, any>): Promise<void> {
  try {
    await AsyncStorage.setItem(key(id), JSON.stringify(obj))
  } catch (e) {
    console.warn('saveOverridesRaw error', e)
  }
}

/* -------------------------------------------------
 * Suppression (réinitialisation)
 * ------------------------------------------------- */
export async function clearOverrides(id: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key(id))
  } catch (e) {
    console.warn('clearOverrides error', e)
  }
}

/* -------------------------------------------------
 * Vérifie s’il existe au moins une valeur utilisateur
 * ------------------------------------------------- */
export async function hasOverrides(id: string): Promise<boolean> {
  const data = await loadOverrides(id)
  return Object.values(data).some(
    (v) => v !== null && v !== undefined && String(v).trim?.() !== ''
  )
}

/* -------------------------------------------------
 * Hook réactif pour lire et modifier les overrides
 * ------------------------------------------------- */
export function useIngredientOverrides(id: string) {
  const norm = normalizeId(id || 'unknown')
  const [values, setValues] = useState<Record<string, any>>({})
  const [version, setVersion] = useState(0)

  const reload = useCallback(async () => {
    const v = await loadOverrides(norm)
    setValues(v)
  }, [norm])

  // Lecture initiale
  useEffect(() => {
    reload()
  }, [reload])

  // Sauvegarde via le hook
  const saveOverrides = useCallback(
    async (obj: Record<string, any>) => {
      await saveOverridesRaw(norm, obj)
      await reload()
      setVersion((v) => v + 1)
    },
    [norm, reload]
  )

  // Reset via le hook
  const resetOverrides = useCallback(async () => {
    await clearOverrides(norm)
    await reload()
    setVersion((v) => v + 1)
  }, [norm, reload])

  return { values, reload, saveOverrides, resetOverrides, version }
}

/* -------------------------------------------------
 * Fusion des valeurs de base + overrides utilisateur
 * (ne remplace que les clés présentes et valides)
 * ------------------------------------------------- */
export function mergeWithOverrides<T extends object>(
  base: T,
  ov: Record<string, any>,
  keys: string[]
): T {
  const out: any = { ...base }
  if (ov && typeof ov === 'object') {
    for (const key of keys) {
      const v = (ov as any)[key]
      const has =
        v !== null &&
        v !== undefined &&
        !(typeof v === 'string' && v.trim() === '')
      if (has) out[key] = v
    }
  }
  return out as T
}
