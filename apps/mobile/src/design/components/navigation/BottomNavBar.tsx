import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/index.js';

export interface BottomNavBarProps {
  readonly children: React.ReactNode;
  readonly style?: ViewStyle;
  readonly testID?: string;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  children,
  style,
  testID,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, shadows } = useTheme();

  return (
    <View
      style={[
        styles.navBar,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingBottom: Math.max(insets.bottom, 10),
          ...shadows.shadowSM,
        },
        style,
      ]}
      accessibilityRole="tablist"
      testID={testID}
    >
      <View style={styles.itemsRow}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  navBar: {
    width: '100%',
    borderTopWidth: 1,
    paddingTop: 8,
  },
  itemsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
  },
});
