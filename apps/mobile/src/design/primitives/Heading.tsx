import React from 'react';
import {
  Text as RNText,
  type TextProps as RNTextProps,
  type TextStyle,
  type StyleProp,
} from 'react-native';
import { useTheme } from '../theme/index.js';

export type HeadingLevel = 'display' | 'h1' | 'h2' | 'h3' | 'title';

export interface HeadingProps extends RNTextProps {
  readonly level?: HeadingLevel;
  readonly color?: string;
  readonly align?: 'left' | 'center' | 'right';
  readonly style?: StyleProp<TextStyle>;
}

export const Heading: React.FC<HeadingProps> = ({
  level = 'h2',
  color,
  align = 'left',
  style,
  children,
  ...rest
}) => {
  const { colors, typographyScale } = useTheme();

  const getScaleStyle = () => {
    switch (level) {
      case 'display':
        return typographyScale.display;
      case 'h1':
        return typographyScale.heading1;
      case 'h2':
        return typographyScale.heading2;
      case 'h3':
        return typographyScale.heading3;
      case 'title':
        return typographyScale.title;
      default:
        return typographyScale.heading2;
    }
  };

  const scaleStyle = getScaleStyle();

  return (
    <RNText
      accessibilityRole="header"
      allowFontScaling={true}
      style={[
        {
          fontSize: scaleStyle.fontSize,
          lineHeight: scaleStyle.lineHeight,
          fontWeight: scaleStyle.fontWeight,
          letterSpacing: 'letterSpacing' in scaleStyle ? scaleStyle.letterSpacing : undefined,
          color: color || colors.textPrimary,
          textAlign: align,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </RNText>
  );
};
