// app/about.tsx
import { router } from 'expo-router'
import React from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

const LAST_UPDATED = 'Octobre 2025' // ← change quand tu publies des données

export default function AboutScreen() {
  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={st.container} contentContainerStyle={{ padding: 16, paddingTop: 28 }}>
        {/* Header */}
        <View style={st.headerWrap}>
          <Text style={st.h1}>ℹ️ À propos • Sources & méthode</Text>
          <View style={st.actionsWrap}>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={st.actionLink}>↩︎ Retour</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Carte principale */}
        <View style={st.card}>
          <Text style={st.sTitle}>Objectif</Text>
          <Text style={st.p}>
            Cette application fournit des convertisseurs culinaires fiables et pratiques,
            adaptés aux produits du quotidien.
          </Text>

          <Text style={[st.sTitle, { marginTop: 10 }]}>Sources des données</Text>
          <Text style={st.p}>
            • <Text style={st.strong}>Mesures directes</Text> : les poids moyens, rendements
            d’épluchage et ratios spécifiques proviennent de <Text style={st.strong}>pesées et tests effectués par l’auteur</Text>.<Text>{'\n'}</Text>
            • <Text style={st.strong}>Synthèse d’usages</Text> : les recommandations (cuissons,
            farines, café, etc.) sont issues de <Text style={st.strong}>l'expérience culinaire de l'auteur,</Text> d’un <Text style={st.strong}>croisement de sources publiques</Text>{' '}
            (littérature culinaire et ressources en ligne) et de <Text style={st.strong}>suggestions de ChatGPT</Text>,<Text></Text>
            <Text>vérifiées par un nouveau croisement de sources et harmonisées manuellement avant intégration.</Text>
          </Text>

          <Text style={[st.sTitle, { marginTop: 10 }]}>Méthodologie</Text>
          <View style={st.tipBox}>
            <Text style={st.tipText}>
              • Pesées réalisées sur produits disponibles dans le commerce.{'\n'}
              • Normalisation des unités (g, ml, cl, l) et des libellés.{'\n'}
              • Quand une plage est fournie (ex. « 88–92 °C »), l’app l’affiche telle quelle.{'\n'}
              • Les rendements épluchés suivent un libellé précis (ex. « Pomme pelée & évidée »).
            </Text>
          </View>

          <Text style={[st.sTitle, { marginTop: 10 }]}>Mises à jour</Text>
          <Text style={st.p}>
            Dernière mise à jour des données : <Text style={st.strong}>{LAST_UPDATED}</Text>.
          </Text>

          <Text style={[st.sTitle, { marginTop: 10 }]}>Clause de non-responsabilité</Text>
          <Text style={st.p}>
            Les valeurs et recommandations sont fournies à titre indicatif et peuvent varier
            selon la variété, la saison ou les conditions de préparation. Elles ne remplacent
            pas le jugement du cuisinier. L’auteur décline toute responsabilité en cas de
            variations ou d’erreurs.
          </Text>

          <Text style={[st.sTitle, { marginTop: 10 }]}>Contact</Text>
          <Text style={st.p}>
            Une correction ? Une suggestion ? N’hésite pas à nous écrire.
          </Text>
        </View>
      </ScrollView>
    </View>
  )
}

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
  actionLink: { fontWeight: '900', color: '#7c3aed', fontSize: 16 },

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

  sTitle: { fontWeight: '900', color: '#444', marginBottom: 6 },
  strong: { fontWeight: '900', color: '#FF4FA2' },
  p: { color: '#57324B', lineHeight: 20, fontWeight: '600' },

  tipBox: {
    marginTop: 6,
    backgroundColor: '#FFF6FB',
    borderColor: '#FFB6F9',
    borderWidth: 1,
    padding: 10,
    borderRadius: 12,
  },
  tipText: { color: '#57324B', fontWeight: '600' },
})
