// app/calculatrice.tsx
import AsyncStorage from '@react-native-async-storage/async-storage'
import { router } from 'expo-router'
import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  GestureResponderEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

/**
 * Calculatrice avec historique persistant
 * - +, -, ×, ÷, %, ^, parenthèses, signe unaire, Ans
 * - Historique (20 derniers) : tap → réinjecte l’expression, long press → supprimer
 * - Bouton "Effacer l’historique"
 * - Overwrite après "=" (prochain chiffre remplace l’affichage)
 * - Pas de message d’erreur tant que l’expression est incomplète
 */

type Tok =
  | { t: 'num'; v: number }
  | { t: 'op'; v: '+' | '-' | '*' | '/' | '%' | '^' }
  | { t: 'lpar' }
  | { t: 'rpar' }

const prec: Record<NonNullable<Extract<Tok, { t: 'op' }>['v']>, number> = {
  '+': 1, '-': 1, '*': 2, '/': 2, '%': 2, '^': 3,
}
const rightAssoc = (op: string) => op === '^'

// ---------- Parsing / Eval ----------
function tokenize(expr: string): Tok[] {
  const s = expr
    .replace(/[x×]/g, '*')
    .replace(/[÷]/g, '/')
    .replace(/[−]/g, '-') // vrai “moins” U+2212
    .replace(/=/g, '')    // supprime tout "=" résiduel

  const out: Tok[] = []
  let i = 0
  let prev: Tok | undefined

  while (i < s.length) {
    const c = s[i]
    if (/\s/.test(c)) { i++; continue }

    if (/[0-9.]/.test(c)) {
      let j = i, dot = 0
      while (j < s.length && /[0-9.]/.test(s[j])) { if (s[j] === '.') dot++; j++ }
      const seg = s.slice(i, j)
      if (dot > 1) throw new Error('Nombre invalide')
      const v = Number(seg)
      if (!Number.isFinite(v)) throw new Error('Nombre invalide')
      out.push({ t: 'num', v })
      prev = out[out.length - 1]
      i = j
      continue
    }

    if (c === '(') { out.push({ t: 'lpar' }); prev = out[out.length - 1]; i++; continue }
    if (c === ')') { out.push({ t: 'rpar' }); prev = out[out.length - 1]; i++; continue }

    if (/[+\-*/%^]/.test(c)) {
      const isUnaryMinus = c === '-' && (!prev || prev.t === 'op' || prev.t === 'lpar')
      if (isUnaryMinus) out.push({ t: 'num', v: 0 })
      out.push({ t: 'op', v: c as any })
      prev = out[out.length - 1]
      i++
      continue
    }

    throw new Error(`Caractère invalide: ${c}`)
  }
  return out
}

function toRPN(tokens: Tok[]): Tok[] {
  const out: Tok[] = []
  const stack: Tok[] = []
  for (const tk of tokens) {
    if (tk.t === 'num') out.push(tk)
    else if (tk.t === 'op') {
      while (
        stack.length &&
        stack[stack.length - 1].t === 'op' &&
        (
          prec[(stack[stack.length - 1] as any).v] > prec[tk.v] ||
          (prec[(stack[stack.length - 1] as any).v] === prec[tk.v] && !rightAssoc(tk.v))
        )
      ) out.push(stack.pop() as Tok)
      stack.push(tk)
    } else if (tk.t === 'lpar') stack.push(tk)
    else if (tk.t === 'rpar') {
      while (stack.length && stack[stack.length - 1].t !== 'lpar') out.push(stack.pop() as Tok)
      if (!stack.length) throw new Error('Parenthèse fermante orpheline')
      stack.pop()
    }
  }
  while (stack.length) {
    const top = stack.pop() as Tok
    if (top.t === 'lpar') throw new Error('Parenthèses non fermées')
    out.push(top)
  }
  return out
}

function evalRPN(rpn: Tok[]): number {
  const st: number[] = []
  for (const tk of rpn) {
    if (tk.t === 'num') st.push(tk.v)
    else if (tk.t === 'op') {
      const b = st.pop(), a = st.pop()
      if (a == null || b == null) throw new Error('Expression invalide')
      let r: number
      switch (tk.v) {
        case '+': r = a + b; break
        case '-': r = a - b; break
        case '*': r = a * b; break
        case '/': if (b === 0) throw new Error('Division par zéro'); r = a / b; break
        case '%': if (b === 0) throw new Error('Modulo par zéro'); r = a % b; break
        case '^': r = Math.pow(a, b); break
        default: throw new Error('Opérateur inconnu')
      }
      st.push(r)
    }
  }
  if (st.length !== 1) throw new Error('Expression invalide')
  return st[0]
}

const fmt = (n: number) => {
  if (!Number.isFinite(n)) return '—'
  return Number(n.toFixed(12)).toString()
}

// ---------- Historique ----------
type HItem = { id: string; expr: string; result: string; ts: number }
const HIST_KEY = 'calc_history_v1'
const clampLen = <T,>(arr: T[], max = 20) => (arr.length > max ? arr.slice(0, max) : arr)

export default function CalculatorScreen() {
  const [expr, setExpr] = useState('')
  const [ans, setAns] = useState<number | null>(null)
  const [error, setError] = useState<string>('')
  const [hist, setHist] = useState<HItem[]>([])
  const [overwrite, setOverwrite] = useState(false) // ← overwrite après "="

  // Charger l’historique au mount
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(HIST_KEY)
        if (raw) setHist(JSON.parse(raw))
      } catch {}
    })()
  }, [])

  // Sauvegarder à chaque changement
  useEffect(() => {
    AsyncStorage.setItem(HIST_KEY, JSON.stringify(hist)).catch(() => {})
  }, [hist])

  // Résultat live : pas d’erreur affichée si expression manifestement incomplète
  const result = useMemo(() => {
    const raw = expr.trim()
    if (!raw) { setError(''); return '' }

    // incomplète si: finit par opérateur ou par "(" ou par une décimale inachevée
    if (/[+\-*/%^]$/.test(raw) || /\($/.test(raw) || /\.$/.test(raw)) {
      setError('')
      return ''
    }

    try {
      const prepared = raw
        .replace(/[−]/g, '-')
        .replace(/=/g, '')
        .replace(/\bAns\b/gi, String(ans ?? 0))
      const tokens = tokenize(prepared)
      const rpn = toRPN(tokens)
      const val = evalRPN(rpn)
      setError('')
      return fmt(val)
    } catch {
      // masque l’erreur live : on ne montre pas “Expression invalide” pendant la frappe
      setError('')
      return ''
    }
  }, [expr, ans])

  const press = (s: string) => {
  const norm = s
    .replace(/[×x]/g, '*')
    .replace('÷', '/')
    .replace('−', '-')

  const isDigitLike = (ch: string) =>
    /^[0-9.]$/.test(ch) || ch === '(' || ch === 'Ans'
  const isOperator = (ch: string) => ['+','-','*','/','%','^'].includes(ch)

  setExpr(prev => {
    if (overwrite) {
      // On vient de faire "="
      setOverwrite(false)

      if (isDigitLike(norm)) {
        // Nouveau calcul : on remplace tout par le premier caractère
        return norm
      }
      if (isOperator(norm)) {
        // Enchaîner: on part de Ans (ou 0 si null)
        const base = ans != null ? fmt(ans) : '0'
        return base + norm
      }
      // Autres cas (ex: ")") — on repart proprement
      return norm
    }

    // Cas normal: on concatène
    return prev + norm
  })
}


  const back = () => setExpr(x => (x.length ? x.slice(0, -1) : ''))
  const clear = () => { setExpr(''); setError(''); setOverwrite(false) }

  const addToHistory = (e: string, r: string) => {
    const id = Math.random().toString(36).slice(2)
    setHist(prev => clampLen([{ id, expr: e, result: r, ts: Date.now() }, ...prev], 20))
  }

  const submit = () => {
  try {
    const prepared = expr
      .replace(/[−]/g, '-')
      .replace(/=/g, '')
      .replace(/\bAns\b/gi, String(ans ?? 0))

    const tokens = tokenize(prepared)
    const rpn = toRPN(tokens)
    const val = evalRPN(rpn)
    const valStr = fmt(val)

    setAns(val)
    addToHistory(expr, valStr)

    // 🔸 On N’ÉCRASE PLUS l’expression : elle reste affichée en haut
    // On passe simplement en mode overwrite pour la prochaine saisie
    setError('')
    setOverwrite(true)
  } catch (e: any) {
    setError(e?.message || 'Erreur')
    setOverwrite(false)
  }
}


  const useHistoryItem = (item: HItem) => { setExpr(item.expr); setOverwrite(false) }
  const deleteHistoryItem = (item: HItem) => setHist(prev => prev.filter(h => h.id !== item.id))
  const clearHistory = () => {
    Alert.alert('Effacer l’historique ?', 'Cette action est irréversible.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Effacer', style: 'destructive', onPress: () => setHist([]) },
    ])
  }

  const Key = ({ label, onPress, wide = false }: { label: string; onPress: (e: GestureResponderEvent) => void; wide?: boolean }) => (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={[st.key, wide && st.keyWide]}>
      <Text style={st.keyTxt}>{label}</Text>
    </TouchableOpacity>
  )

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={st.container} contentContainerStyle={{ padding: 16, paddingTop: 28 }}>
        {/* Header */}
        <View style={st.headerWrap}>
          <Text style={st.h1}>🧮 Calculatrice</Text>
          <View style={st.actionsWrap}>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={st.actionLink}>↩︎ Retour</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={st.card}>
          {/* Affichage */}
          <View style={st.display}>
            <Text style={st.expr} selectable>{expr || ' '}</Text>
            <Text style={st.res} accessible accessibilityLabel={`Résultat ${result || 'vide'}`}>
              {result || ' '}
            </Text>
          </View>
          {error ? <Text style={st.err}>{error}</Text> : null}

          {/* Lignes de touches */}
          <View style={st.row}>
            <Key label="AC" onPress={clear} />
            <Key label="⌫" onPress={back} />
            <Key label="(" onPress={() => press('(')} />
            <Key label=")" onPress={() => press(')')} />
            <Key label="Ans" onPress={() => press('Ans')} />
          </View>

          <View style={st.row}>
            <Key label="7" onPress={() => press('7')} />
            <Key label="8" onPress={() => press('8')} />
            <Key label="9" onPress={() => press('9')} />
            <Key label="÷" onPress={() => press('÷')} />
          </View>
          <View style={st.row}>
            <Key label="4" onPress={() => press('4')} />
            <Key label="5" onPress={() => press('5')} />
            <Key label="6" onPress={() => press('6')} />
            <Key label="×" onPress={() => press('×')} />
          </View>
          <View style={st.row}>
            <Key label="1" onPress={() => press('1')} />
            <Key label="2" onPress={() => press('2')} />
            <Key label="3" onPress={() => press('3')} />
            <Key label="−" onPress={() => press('-')} />
          </View>
          <View style={st.row}>
            <Key label="0" onPress={() => press('0')} />
            <Key label="." onPress={() => press('.')} />
            <Key label="%" onPress={() => press('%')} />
            <Key label="+" onPress={() => press('+')} />
          </View>
          <View style={st.row}>
            <Key label="^" onPress={() => press('^')} />
            <Key label="=" onPress={submit} wide />
          </View>
        </View>

        {/* Historique */}
        <View style={[st.card, { marginTop: 12 }]}>
          <View style={st.histHeader}>
            <Text style={st.sTitle}>Historique</Text>
            <TouchableOpacity onPress={clearHistory} hitSlop={{ top: 6, left: 6, right: 6, bottom: 6 }}>
              <Text style={st.histClear}>Effacer</Text>
            </TouchableOpacity>
          </View>

          {hist.length === 0 ? (
            <Text style={{ color: '#666', fontWeight: '600' }}>Aucun calcul pour l’instant.</Text>
          ) : (
            <View style={{ gap: 8 }}>
              {hist.map(item => (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => useHistoryItem(item)}
                  onLongPress={() =>
                    Alert.alert('Supprimer cet élément ?', `${item.expr} = ${item.result}`, [
                      { text: 'Annuler', style: 'cancel' },
                      { text: 'Supprimer', style: 'destructive', onPress: () => deleteHistoryItem(item) },
                    ])
                  }
                  activeOpacity={0.9}
                  style={st.histRow}
                >
                  <Text style={st.histExpr} numberOfLines={1}>{item.expr}</Text>
                  <Text style={st.histEq}>=</Text>
                  <Text style={st.histRes} numberOfLines={1}>{item.result}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  )
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFEEFC' },

  headerWrap: { marginBottom: 12 },
  h1: { fontSize: 24, fontWeight: '900', color: '#FF4FA2' },
  actionsWrap: { marginTop: 6, flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center' },
  actionLink: { fontWeight: '900', color: '#7c3aed', fontSize: 16 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    shadowColor: '#FF8FCD',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 2,
    borderColor: '#FFB6F9',
  },

  display: {
    backgroundColor: '#FFF0FA',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#FFB6F9',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  expr: { color: '#9a3aa5', fontWeight: '700', fontSize: 18 },
  res: { color: '#FF4FA2', fontWeight: '900', fontSize: 26, textAlign: 'right' },
  err: { color: '#dc2626', fontWeight: '700', marginBottom: 8 },

  row: { flexDirection: 'row', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  key: {
    flexGrow: 1,
    flexBasis: '22%',
    backgroundColor: '#FFE4F6',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#FFB6F9',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyWide: { flexBasis: '46%' },
  keyTxt: { color: '#FF4FA2', fontWeight: '900', fontSize: 18 },

  sTitle: { fontWeight: '900', color: '#444' },

  // Historique
  histHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  histClear: { color: '#7c3aed', fontWeight: '900' },
  histRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF6FB',
    borderWidth: 1,
    borderColor: '#FFB6F9',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  histExpr: { color: '#57324B', fontWeight: '700', flex: 1 },
  histEq: { color: '#7a3c84', fontWeight: '900' },
  histRes: { color: '#FF4FA2', fontWeight: '900', maxWidth: 140, textAlign: 'right' },
})
