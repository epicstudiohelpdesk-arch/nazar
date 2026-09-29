import React from 'react';
import {
  Text as RNText,
  type TextProps as RNTextProps,
  type TextStyle,
  type StyleProp,
} from 'react-native';
import { useTheme } from '../theme/index.js';

export type TextVariant =
  | 'display'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'title'
  | 'bodyLarge'
  | 'body'
  | 'bodySmall'
  | 'caption'
  | 'label'
  | 'button'
  | 'numeric';

export type TextColor =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'inverse'
  | 'accent'
  | 'error'
  | 'success'
  | 'warning';

export interface TextProps extends RNTextProps {
  readonly variant?: TextVariant;
  readonly color?: TextColor | string;
  readonly align?: 'left' | 'center' | 'right';
  readonly weight?: 'normal' | 'medium' | 'semibold' | 'bold';
  readonly style?: StyleProp<TextStyle>;
}

export const Text: React.FC<TextProps> = ({
  variant = 'body',
  color = 'primary',
  align = 'left',
  weight,
  style,
  children,
  ...rest
}) => {
  const { colors, typographyScale, typography } = useTheme();

  const variantStyle = typographyScale[variant] || typographyScale.body;

  const resolveColor = (): string => {
    switch (color) {
      case 'primary':
        return colors.textPrimary;
      case 'secondary':
        return colors.textSecondary;
      case 'tertiary':
        return colors.textTertiary;
      case 'inverse':
        return colors.textInverse;
      case 'accent':
        return colors.accent;
      case 'error':
        return colors.error;
      case 'success':
        return colors.success;
      case 'warning':
        return colors.warning;
      default:
        return color;
    }
  };

  const resolvedWeight = weight ? typography.fontWeight[weight] : variantStyle.fontWeight;
  const textTransform =
    'textTransform' in variantStyle
      ? (variantStyle.textTransform as TextStyle['textTransform'])
      : undefined;
  const letterSpacing =
    'letterSpacing' in variantStyle ? variantStyle.letterSpacing : undefined;

  return (
    <RNText
      style={[
        {
          fontSize: variantStyle.fontSize,
          lineHeight: variantStyle.lineHeight,
          fontWeight: resolvedWeight as TextStyle['fontWeight'],
          letterSpacing,
          textTransform,
          color: resolveColor(),
          textAlign: align,
        },
        style,
      ]}
      allowFontScaling={true}
      {...rest}
    >
      {children}
    </RNText>
  );
};
