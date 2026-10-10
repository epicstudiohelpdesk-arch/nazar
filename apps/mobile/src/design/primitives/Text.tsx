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
  'primary' | 'secondary' | 'tertiary' | 'inverse' | 'accent' | 'error' | 'success' | 'warning';

export interface TextProps extends RNTextProps {
  readonly variant?: TextVariant;
  readonly level?: TextVariant;
  readonly color?: TextColor | string;
  readonly align?: 'left' | 'center' | 'right';
  readonly weight?: 'normal' | 'medium' | 'semibold' | 'bold';
  readonly style?: StyleProp<TextStyle>;
  readonly children?: React.ReactNode;
}

export const Text: React.FC<TextProps> = ({
  variant,
  level,
  color = 'primary',
  align = 'left',
  weight,
  style,
  children,
  ...rest
}) => {
  const { colors, typographyScale, typography } = useTheme();

  const effectiveVariant = variant || level || 'body';
  const variantStyle = typographyScale[effectiveVariant] || typographyScale.body;

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
  const letterSpacing = 'letterSpacing' in variantStyle ? variantStyle.letterSpacing : undefined;

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

// Semantic Typography Specializations
export type SemanticTextProps = Omit<TextProps, 'variant' | 'level'>;

export const DisplayText: React.FC<SemanticTextProps> = (props) => (
  <Text variant="display" {...props} />
);

export interface HeadingTextProps extends SemanticTextProps {
  readonly level?: 'h1' | 'h2' | 'h3';
}

export const HeadingText: React.FC<HeadingTextProps> = ({ level = 'h2', ...props }) => {
  const variantMap: Record<string, TextVariant> = {
    h1: 'heading1',
    h2: 'heading2',
    h3: 'heading3',
  };
  return <Text variant={variantMap[level] || 'heading2'} {...props} />;
};

export const TitleText: React.FC<SemanticTextProps> = (props) => (
  <Text variant="title" weight="semibold" {...props} />
);

export const BodyText: React.FC<SemanticTextProps> = (props) => <Text variant="body" {...props} />;

export const BodySmallText: React.FC<SemanticTextProps> = (props) => (
  <Text variant="bodySmall" {...props} />
);

export const CaptionText: React.FC<SemanticTextProps> = (props) => (
  <Text variant="caption" color="secondary" {...props} />
);

export const LabelText: React.FC<SemanticTextProps> = (props) => (
  <Text variant="label" weight="medium" color="secondary" {...props} />
);

export const ButtonText: React.FC<SemanticTextProps> = (props) => (
  <Text variant="button" weight="semibold" {...props} />
);

export const NumericText: React.FC<SemanticTextProps> = (props) => (
  <Text variant="numeric" weight="semibold" {...props} />
);
