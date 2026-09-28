import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { InterestItem } from '@platform/api-contracts';

interface InterestsPickerProps {
  taxonomy: InterestItem[];
  selectedIds: readonly string[];
  onToggleInterest: (interestId: string) => void;
  maxInterests?: number;
}

export const InterestsPicker: React.FC<InterestsPickerProps> = ({
  taxonomy,
  selectedIds,
  onToggleInterest,
  maxInterests = 10,
}) => {
  const selectedSet = new Set(selectedIds);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Interests ({selectedIds.length}/{maxInterests})
      </Text>
      <Text style={styles.subtitle}>Select at least 3 interests that represent what you love.</Text>

      <View style={styles.chipsContainer}>
        {taxonomy.map((item) => {
          const isSelected = selectedSet.has(item.id);
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.chip, isSelected && styles.chipSelected]}
              onPress={() => onToggleInterest(item.id)}
            >
              <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                {item.name}
              </Text>
            </TouchableOpacity>
          );
        })}
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
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 12,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chipSelected: {
    backgroundColor: '#FFE4E6',
    borderColor: '#E11D48',
  },
  chipText: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '500',
  },
  chipTextSelected: {
    color: '#E11D48',
    fontWeight: '700',
  },
});
