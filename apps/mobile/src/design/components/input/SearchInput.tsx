import React from 'react';
import {
  View,
  TextInput as RNTextInput,
  TouchableOpacity,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../../theme/index.js';
import { Icon } from '../../primitives/Icon.js';

export interface SearchInputProps {
  readonly value: string;
  readonly onChangeText: (text: string) => void;
  readonly placeholder?: string;
  readonly onClear?: () => void;
  readonly disabled?: boolean;
  readonly style?: ViewStyle;
  readonly testID?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChangeText,
  placeholder = 'Search by name, interests, or city...',
  onClear,
  disabled = false,
  style,
  testID,
}) => {
  const { colors, radii, spacing } = useTheme();

  const handleClear = () => {
    onChangeText('');
    onClear?.();
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surfaceMuted,
          borderRadius: radii.radiusFull,
          borderColor: colors.border,
          borderWidth: 1,
          paddingHorizontal: spacing.md,
        },
        style,
      ]}
      testID={testID}
    >
      <Icon name="search" size="sm" color={colors.textTertiary} style={{ marginRight: spacing.xs }} />

      <RNTextInput
        style={[styles.input, { color: colors.textPrimary }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        editable={!disabled}
        accessibilityRole="search"
        accessibilityLabel={placeholder}
        returnKeyType="search"
      />

      {value.length > 0 && (
        <TouchableOpacity
          onPress={handleClear}
          accessibilityRole="button"
          accessibilityLabel="Clear search text"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name="close" size="tiny" color={colors.textTertiary} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    width: '100%',
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
});

export const SearchField = SearchInput;
