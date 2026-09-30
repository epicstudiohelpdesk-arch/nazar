import React from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import { useTheme } from '../../theme/index.js';
import { Text } from '../../primitives/Text.js';
import { Button } from '../../components/button/Button.js';
import { BottomSheet } from '../../components/modal/BottomSheet.js';
import { Slider } from '../../components/input/Slider.js';
import { SelectableChip } from '../../components/input/SelectionRows.js';

export const FilterChip = SelectableChip;

// --- FILTER SECTION ---
export interface FilterSectionProps {
  readonly title: string;
  readonly valueLabel?: string;
  readonly onClear?: () => void;
  readonly children: React.ReactNode;
  readonly style?: StyleProp<ViewStyle>;
}

export const FilterSection: React.FC<FilterSectionProps> = ({
  title,
  valueLabel,
  onClear,
  children,
  style,
}) => {
  const { colors, spacing } = useTheme();

  return (
    <View style={[styles.section, { marginBottom: spacing.lg }, style]}>
      <View style={styles.sectionHeader}>
        <Text variant="title" weight="semibold" style={{ color: colors.textPrimary }}>
          {title}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {valueLabel && (
            <Text variant="bodySmall" weight="semibold" style={{ color: colors.accent, marginRight: spacing.sm }}>
              {valueLabel}
            </Text>
          )}
          {onClear && (
            <TouchableOpacity onPress={onClear}>
              <Text variant="caption" weight="medium" style={{ color: colors.textTertiary }}>
                Clear
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      <View style={{ marginTop: spacing.sm }}>{children}</View>
    </View>
  );
};

// --- RANGE SELECTOR ---
export interface RangeSelectorProps {
  readonly label: string;
  readonly value: number;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly unit?: string;
  readonly onChange: (value: number) => void;
  readonly style?: StyleProp<ViewStyle>;
}

export const RangeSelector: React.FC<RangeSelectorProps> = ({
  label,
  value,
  min = 18,
  max = 60,
  step = 1,
  unit = '',
  onChange,
  style,
}) => {
  return (
    <Slider
      label={label}
      value={value}
      min={min}
      max={max}
      step={step}
      unit={unit}
      onChange={onChange}
      style={style as any}
    />
  );
};

// --- PREFERENCE SELECTOR ---
export interface PreferenceOption {
  readonly id: string;
  readonly label: string;
}

export interface PreferenceSelectorProps {
  readonly title: string;
  readonly options: readonly PreferenceOption[];
  readonly selectedIds: readonly string[];
  readonly onToggle: (id: string) => void;
  readonly maxSelection?: number;
  readonly style?: StyleProp<ViewStyle>;
}

export const PreferenceSelector: React.FC<PreferenceSelectorProps> = ({
  title,
  options,
  selectedIds,
  onToggle,
  maxSelection,
  style,
}) => {
  return (
    <FilterSection
      title={title}
      valueLabel={maxSelection ? `${selectedIds.length}/${maxSelection}` : undefined}
      style={style}
    >
      <View style={styles.chipWrap}>
        {options.map((opt) => (
          <FilterChip
            key={opt.id}
            label={opt.label}
            isSelected={selectedIds.includes(opt.id)}
            onToggle={() => onToggle(opt.id)}
          />
        ))}
      </View>
    </FilterSection>
  );
};

// --- FILTER SHEET ---
export interface FilterSheetProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly onApply: () => void;
  readonly onReset?: () => void;
  readonly title?: string;
  readonly children: React.ReactNode;
  readonly isSubmitting?: boolean;
}

export const FilterSheet: React.FC<FilterSheetProps> = ({
  visible,
  onClose,
  onApply,
  onReset,
  title = 'Discovery Filters',
  children,
  isSubmitting = false,
}) => {
  const { spacing } = useTheme();

  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      <ScrollView
        style={styles.sheetScroll}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}
      >
        {children}

        {/* Action Buttons */}
        <View style={[styles.sheetFooter, { marginTop: spacing.lg }]}>
          {onReset && (
            <Button
              label="Reset"
              variant="tertiary"
              size="md"
              onPress={onReset}
              disabled={isSubmitting}
              style={{ flex: 1, marginRight: spacing.sm }}
            />
          )}
          <Button
            label="Apply Filters"
            variant="primary"
            size="md"
            onPress={onApply}
            isLoading={isSubmitting}
            style={{ flex: 2 }}
          />
        </View>
      </ScrollView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  section: {
    width: '100%',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sheetScroll: {
    maxHeight: 520,
  },
  sheetFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
});
