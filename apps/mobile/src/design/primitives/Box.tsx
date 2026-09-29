import React from 'react';
import { View, type ViewProps, type ViewStyle, type StyleProp } from 'react-native';
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
