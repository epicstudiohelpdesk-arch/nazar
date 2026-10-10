import React from 'react';
import {
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  type ViewProps,
  type ViewStyle,
  type StyleProp,
  type TouchableOpacityProps,
  type ScrollViewProps,
} from 'react-native';
import { useTheme } from '../theme/index.js';
import type { SpacingTokens, RadiiTokens, ShadowTokens } from '../tokens/index.js';

export interface BoxProps extends ViewProps {
  readonly p?: number | keyof SpacingTokens;
  readonly px?: number | keyof SpacingTokens;
  readonly py?: number | keyof SpacingTokens;
  readonly m?: number | keyof SpacingTokens;
  readonly mx?: number | keyof SpacingTokens;
  readonly my?: number | keyof SpacingTokens;
  readonly bg?: string;
  readonly radius?: keyof RadiiTokens | number;
  readonly border?: boolean | string;
  readonly elevationLevel?: keyof ShadowTokens;
  readonly style?: StyleProp<ViewStyle>;
  readonly children?: React.ReactNode;
}

export const Box: React.FC<BoxProps> = ({
  p,
  px,
  py,
  m,
  mx,
  my,
  bg,
  radius,
  border,
  elevationLevel,
  style,
  children,
  ...rest
}) => {
  const { spacing, radii, shadows, colors } = useTheme();

  const resolveSpacing = (val?: number | keyof SpacingTokens): number | undefined => {
    if (val === undefined) return undefined;
    if (typeof val === 'number') return val;
    return spacing[val as keyof typeof spacing];
  };

  const resolveRadius = (r?: keyof RadiiTokens | number): number | undefined => {
    if (r === undefined) return undefined;
    if (typeof r === 'number') return r;
    return radii[r as keyof typeof radii];
  };

  const shadowStyle = elevationLevel ? shadows[elevationLevel] : undefined;

  const boxStyle: ViewStyle = {
    padding: resolveSpacing(p),
    paddingHorizontal: resolveSpacing(px),
    paddingVertical: resolveSpacing(py),
    margin: resolveSpacing(m),
    marginHorizontal: resolveSpacing(mx),
    marginVertical: resolveSpacing(my),
    backgroundColor: bg,
    borderRadius: resolveRadius(radius),
    ...(border
      ? {
          borderWidth: 1,
          borderColor: typeof border === 'string' ? border : colors.border,
        }
      : {}),
    ...shadowStyle,
  };

  return (
    <View style={[boxStyle, style]} {...rest}>
      {children}
    </View>
  );
};

export interface StackProps extends BoxProps {
  readonly direction?: 'row' | 'column';
  readonly gap?: number | keyof SpacingTokens;
  readonly align?: ViewStyle['alignItems'];
  readonly justify?: ViewStyle['justifyContent'];
  readonly wrap?: ViewStyle['flexWrap'];
}

export const Stack: React.FC<StackProps> = ({
  direction = 'column',
  gap,
  align,
  justify,
  wrap,
  style,
  children,
  ...rest
}) => {
  const { spacing } = useTheme();
  const gapValue = typeof gap === 'string' ? spacing[gap as keyof typeof spacing] : gap;

  const stackStyle: ViewStyle = {
    flexDirection: direction,
    gap: gapValue,
    alignItems: align,
    justifyContent: justify,
    flexWrap: wrap,
  };

  return (
    <Box style={[stackStyle, style]} {...rest}>
      {children}
    </Box>
  );
};

export type RowProps = Omit<StackProps, 'direction'>;

export const Row: React.FC<RowProps> = ({
  align = 'center',
  justify,
  gap,
  style,
  children,
  ...rest
}) => {
  return (
    <Stack direction="row" align={align} justify={justify} gap={gap} style={style} {...rest}>
      {children}
    </Stack>
  );
};

export type ColumnProps = Omit<StackProps, 'direction'>;

export const Column: React.FC<ColumnProps> = ({
  align,
  justify,
  gap,
  style,
  children,
  ...rest
}) => {
  return (
    <Stack direction="column" align={align} justify={justify} gap={gap} style={style} {...rest}>
      {children}
    </Stack>
  );
};

export interface SpacerProps {
  readonly size?: number | keyof SpacingTokens;
  readonly flex?: number;
}

export const Spacer: React.FC<SpacerProps> = ({ size, flex }) => {
  const { spacing } = useTheme();
  const resolvedSize = typeof size === 'string' ? spacing[size as keyof typeof spacing] : size;

  if (flex !== undefined) {
    return <View style={{ flex }} />;
  }

  return <View style={{ width: resolvedSize || 0, height: resolvedSize || 0 }} />;
};

export interface DividerProps {
  readonly orientation?: 'horizontal' | 'vertical';
  readonly color?: string;
  readonly thickness?: number;
  readonly style?: StyleProp<ViewStyle>;
}

export const Divider: React.FC<DividerProps> = ({
  orientation = 'horizontal',
  color,
  thickness = 1,
  style,
}) => {
  const { colors } = useTheme();
  const dividerColor = color || colors.border;

  const dividerStyle: ViewStyle =
    orientation === 'horizontal'
      ? {
          width: '100%',
          height: thickness,
          backgroundColor: dividerColor,
        }
      : {
          height: '100%',
          width: thickness,
          backgroundColor: dividerColor,
        };

  return <View style={[dividerStyle, style]} accessibilityRole="none" />;
};

export interface PressableProps extends TouchableOpacityProps {
  readonly children?: React.ReactNode;
}

export const Pressable: React.FC<PressableProps> = ({
  children,
  activeOpacity = 0.75,
  ...rest
}) => {
  return (
    <TouchableOpacity activeOpacity={activeOpacity} {...rest}>
      {children}
    </TouchableOpacity>
  );
};

export interface ScrollContainerProps extends ScrollViewProps {
  readonly p?: number | keyof SpacingTokens;
  readonly px?: number | keyof SpacingTokens;
  readonly py?: number | keyof SpacingTokens;
  readonly bg?: string;
  readonly children?: React.ReactNode;
}

export const ScrollContainer: React.FC<ScrollContainerProps> = ({
  p,
  px,
  py,
  bg,
  contentContainerStyle,
  style,
  children,
  ...rest
}) => {
  const { colors, spacing } = useTheme();

  const resolveSpacing = (val?: number | keyof SpacingTokens): number | undefined => {
    if (val === undefined) return undefined;
    if (typeof val === 'number') return val;
    return spacing[val as keyof typeof spacing];
  };

  const containerPadding: ViewStyle = {
    padding: resolveSpacing(p),
    paddingHorizontal: resolveSpacing(px),
    paddingVertical: resolveSpacing(py),
  };

  return (
    <ScrollView
      style={[{ flex: 1, backgroundColor: bg || colors.background }, style]}
      contentContainerStyle={[containerPadding, contentContainerStyle]}
      keyboardShouldPersistTaps="handled"
      {...rest}
    >
      {children}
    </ScrollView>
  );
};

export interface SafeAreaContainerProps extends ViewProps {
  readonly bg?: string;
  readonly children?: React.ReactNode;
}

export const SafeAreaContainer: React.FC<SafeAreaContainerProps> = ({
  bg,
  style,
  children,
  ...rest
}) => {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={[{ flex: 1, backgroundColor: bg || colors.background }, style]} {...rest}>
      {children}
    </SafeAreaView>
  );
};
