import React, { useState } from 'react';
import { View, TouchableOpacity, Modal, FlatList, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/index.js';
import { Text } from '../../primitives/Text.js';
import { Icon } from '../../primitives/Icon.js';

export interface SelectOption<T = string> {
  readonly label: string;
  readonly value: T;
  readonly description?: string;
}

export interface SelectProps<T = string> {
  readonly label?: string;
  readonly options: readonly SelectOption<T>[];
  readonly value?: T;
  readonly onSelect?: (value: T) => void;
  readonly onSelectOption?: (value: T) => void;
  readonly placeholder?: string;
  readonly error?: string;
  readonly disabled?: boolean;
  readonly style?: ViewStyle;
  readonly testID?: string;
}

export const Select = <T extends string | number>({
  label,
  options,
  value,
  onSelect,
  onSelectOption,
  placeholder = 'Select an option',
  error,
  disabled = false,
  style,
  testID,
}: SelectProps<T>): React.JSX.Element => {
  const { colors, radii, spacing, shadows } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);

  const selectedOption = options.find((o) => o.value === value);
  const hasError = Boolean(error);
  const effectiveSelect = onSelect || onSelectOption || (() => {});

  const handleSelect = (val: T) => {
    effectiveSelect(val);
    setModalVisible(false);
  };

  return (
    <View style={[styles.container, style]} testID={testID}>
      {label && (
        <Text
          variant="label"
          style={[styles.label, { color: hasError ? colors.error : colors.textSecondary }]}
        >
          {label}
        </Text>
      )}

      <TouchableOpacity
        style={[
          styles.trigger,
          {
            backgroundColor: disabled ? colors.surfaceMuted : colors.surface,
            borderColor: hasError ? colors.error : colors.border,
            borderRadius: radii.radiusMD,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
          },
        ]}
        onPress={() => setModalVisible(true)}
        disabled={disabled}
        accessibilityRole="combobox"
        accessibilityLabel={label || placeholder}
        accessibilityState={{ disabled, expanded: modalVisible }}
      >
        <Text
          variant="body"
          style={{
            color: selectedOption ? colors.textPrimary : colors.textTertiary,
            flex: 1,
          }}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </Text>
        <Icon name="chevron" direction="down" size="tiny" color={colors.textTertiary} />
      </TouchableOpacity>

      {hasError && (
        <View style={styles.feedbackRow}>
          <Icon
            name="warning"
            size="tiny"
            color={colors.error}
            style={{ marginRight: spacing.xxs }}
          />
          <Text variant="caption" style={{ color: colors.error }}>
            {error}
          </Text>
        </View>
      )}

      {/* Selection Modal Sheet */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={[styles.backdrop, { backgroundColor: colors.overlay }]}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: colors.surface,
                borderRadius: radii.radiusLG,
                padding: spacing.md,
                ...shadows.shadowLG,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text variant="title">{label || 'Select Option'}</Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Close selection modal"
              >
                <Icon name="close" size="sm" color={colors.textTertiary} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={options}
              keyExtractor={(item) => String(item.value)}
              renderItem={({ item }) => {
                const isSelected = item.value === value;
                return (
                  <TouchableOpacity
                    style={[
                      styles.optionRow,
                      {
                        borderBottomColor: colors.border,
                        borderBottomWidth: 1,
                        paddingVertical: spacing.sm,
                      },
                    ]}
                    onPress={() => handleSelect(item.value)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        variant="body"
                        weight={isSelected ? 'semibold' : 'normal'}
                        style={{ color: isSelected ? colors.accent : colors.textPrimary }}
                      >
                        {item.label}
                      </Text>
                      {item.description && (
                        <Text variant="caption" style={{ color: colors.textTertiary }}>
                          {item.description}
                        </Text>
                      )}
                    </View>
                    {isSelected && <Icon name="check" size="sm" color={colors.accent} />}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 12,
  },
  label: {
    marginBottom: 6,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    borderWidth: 1,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 380,
    maxHeight: 440,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
});

export const SelectField = Select;
