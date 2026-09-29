import React from 'react';
import {
  Modal,
  View,
  TouchableOpacity,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/index.js';
import { Text } from '../../primitives/Text.js';
import { Heading } from '../../primitives/Heading.js';
import { Icon } from '../../primitives/Icon.js';

export interface BottomSheetProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly title?: string;
  readonly subtitle?: string;
  readonly children: React.ReactNode;
  readonly style?: ViewStyle;
  readonly testID?: string;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  visible,
  onClose,
  title,
  subtitle,
  children,
  style,
  testID,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, radii, spacing, shadows } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot} testID={testID}>
        {/* Backdrop */}
        <TouchableOpacity
          style={[styles.backdrop, { backgroundColor: colors.overlay }]}
          activeOpacity={1}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss sheet"
        />

        {/* Sheet Content Surface */}
        <View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: colors.surface,
              borderTopLeftRadius: radii.radiusXL,
              borderTopRightRadius: radii.radiusXL,
              paddingBottom: Math.max(insets.bottom, 16),
              ...shadows.shadowLG,
            },
            style,
          ]}
        >
          {/* Drag Grabber Notch */}
          <View style={styles.grabberWrapper}>
            <View
              style={[
                styles.grabber,
                { backgroundColor: colors.borderStrong, borderRadius: radii.radiusFull },
              ]}
            />
          </View>

          {/* Sheet Header */}
          {(title || subtitle) && (
            <View
              style={[
                styles.headerRow,
                {
                  paddingHorizontal: spacing.lg,
                  paddingBottom: spacing.sm,
                  borderBottomColor: colors.border,
                  borderBottomWidth: 1,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                {title && <Heading level="h3">{title}</Heading>}
                {subtitle && (
                  <Text variant="caption" style={{ color: colors.textSecondary, marginTop: 2 }}>
                    {subtitle}
                  </Text>
                )}
              </View>

              <TouchableOpacity
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close sheet"
                style={styles.closeBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon name="close" size="sm" color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          )}

          {/* Sheet Body */}
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
            {children}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheetContainer: {
    width: '100%',
    maxHeight: '85%',
  },
  grabberWrapper: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 10,
  },
  grabber: {
    width: 38,
    height: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
