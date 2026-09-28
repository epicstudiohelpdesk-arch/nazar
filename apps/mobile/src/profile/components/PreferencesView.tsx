import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { PreferencesResponse, Gender, RelationshipIntent } from '@platform/api-contracts';

interface PreferencesViewProps {
  preferences: PreferencesResponse;
}

const GENDER_LABELS: Record<Gender, string> = {
  WOMAN: 'Women',
  MAN: 'Men',
  NON_BINARY: 'Non-Binary',
  OTHER: 'Other',
};

const INTENT_LABELS: Record<RelationshipIntent, string> = {
  LONG_TERM: 'Long-term relationship',
  SHORT_TERM: 'Short-term relationship',
  CASUAL: 'Casual dating',
  FRIENDSHIP: 'New friends',
  NOT_SURE: 'Still figuring it out',
};

export const PreferencesView: React.FC<PreferencesViewProps> = ({ preferences }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Discovery Preferences</Text>

      <View style={styles.row}>
        <Text style={styles.label}>Age Range</Text>
        <Text style={styles.value}>
          {preferences.minAge} – {preferences.maxAge} years
        </Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Maximum Distance</Text>
        <Text style={styles.value}>{preferences.maxDistanceKm} km</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Looking for</Text>
        <Text style={styles.value}>
          {preferences.genderPreferences.map((g) => GENDER_LABELS[g] || g).join(', ')}
        </Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Relationship Intent</Text>
        <Text style={styles.value}>
          {INTENT_LABELS[preferences.relationshipIntent] || preferences.relationshipIntent}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  label: {
    fontSize: 14,
    color: '#6B7280',
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
});
