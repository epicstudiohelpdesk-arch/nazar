import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { ProfilePromptItem } from '@platform/api-contracts';

interface PromptsListProps {
  prompts: ProfilePromptItem[];
}

export const PromptsList: React.FC<PromptsListProps> = ({ prompts }) => {
  if (prompts.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Prompts</Text>
        <Text style={styles.emptyText}>
          No prompts answered yet. Answer at least 1 prompt to activate.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Prompts ({prompts.length}/3)</Text>
      {prompts.map((p) => (
        <View key={p.id} style={styles.promptCard}>
          <Text style={styles.questionText}>{p.prompt}</Text>
          <Text style={styles.answerText}>{p.answer}</Text>
        </View>
      ))}
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
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 13,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  promptCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginVertical: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#E11D48',
  },
  questionText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  answerText: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '500',
    lineHeight: 22,
  },
});
