import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/index.js';

export type IconName =
  | 'heart'
  | 'close'
  | 'message'
  | 'search'
  | 'filter'
  | 'settings'
  | 'shield'
  | 'flag'
  | 'more'
  | 'back'
  | 'chevron'
  | 'location'
  | 'calendar'
  | 'camera'
  | 'edit'
  | 'check'
  | 'plus'
  | 'sparkles'
  | 'user'
  | 'bell'
  | 'lock'
  | 'refresh'
  | 'share'
  | 'warning'
  | 'info'
  | 'eye'
  | 'eyeOff'
  | 'trash'
  | 'send'
  | 'star';

export type IconSize = 'tiny' | 'sm' | 'md' | 'lg' | number;

export interface IconProps {
  readonly name: IconName;
  readonly size?: IconSize;
  readonly color?: string;
  readonly strokeWidth?: number;
  readonly style?: ViewStyle;
  readonly accessibilityLabel?: string;
  readonly testID?: string;
  readonly direction?: 'left' | 'right' | 'up' | 'down';
}

const resolveSize = (size: IconSize): number => {
  if (typeof size === 'number') return size;
  switch (size) {
    case 'tiny':
      return 14;
    case 'sm':
      return 18;
    case 'md':
      return 24;
    case 'lg':
      return 32;
    default:
      return 24;
  }
};

export const Icon: React.FC<IconProps> = ({
  name,
  size = 'md',
  color,
  strokeWidth = 2,
  style,
  accessibilityLabel,
  testID,
  direction = 'right',
}) => {
  const { colors } = useTheme();
  const iconColor = color || colors.textPrimary;
  const dimension = resolveSize(size);
  const half = dimension / 2;

  const renderIconContent = (): React.ReactNode => {
    switch (name) {
      case 'close': {
        const lineLen = dimension * 0.65;
        return (
          <View style={[styles.center, { width: dimension, height: dimension }]}>
            <View
              style={{
                position: 'absolute',
                width: lineLen,
                height: strokeWidth,
                backgroundColor: iconColor,
                borderRadius: strokeWidth,
                transform: [{ rotate: '45deg' }],
              }}
            />
            <View
              style={{
                position: 'absolute',
                width: lineLen,
                height: strokeWidth,
                backgroundColor: iconColor,
                borderRadius: strokeWidth,
                transform: [{ rotate: '-45deg' }],
              }}
            />
          </View>
        );
      }

      case 'plus': {
        const lineLen = dimension * 0.65;
        return (
          <View style={[styles.center, { width: dimension, height: dimension }]}>
            <View
              style={{
                position: 'absolute',
                width: lineLen,
                height: strokeWidth,
                backgroundColor: iconColor,
                borderRadius: strokeWidth,
              }}
            />
            <View
              style={{
                position: 'absolute',
                width: strokeWidth,
                height: lineLen,
                backgroundColor: iconColor,
                borderRadius: strokeWidth,
              }}
            />
          </View>
        );
      }

      case 'check': {
        return (
          <View style={[styles.center, { width: dimension, height: dimension }]}>
            <View
              style={{
                width: dimension * 0.35,
                height: dimension * 0.6,
                borderColor: iconColor,
                borderRightWidth: strokeWidth,
                borderBottomWidth: strokeWidth,
                transform: [{ rotate: '45deg' }, { translateY: -dimension * 0.08 }],
                borderRadius: 1,
              }}
            />
          </View>
        );
      }

      case 'back':
      case 'chevron': {
        const rotationMap: Record<string, string> = {
          left: '135deg',
          right: '-45deg',
          up: '-135deg',
          down: '45deg',
        };
        const activeDir = name === 'back' ? 'left' : direction;
        const rot = rotationMap[activeDir] || '-45deg';
        return (
          <View style={[styles.center, { width: dimension, height: dimension }]}>
            <View
              style={{
                width: dimension * 0.38,
                height: dimension * 0.38,
                borderColor: iconColor,
                borderRightWidth: strokeWidth,
                borderBottomWidth: strokeWidth,
                transform: [{ rotate: rot }],
                borderRadius: 1,
              }}
            />
          </View>
        );
      }

      case 'search': {
        const circleSize = dimension * 0.52;
        return (
          <View style={[styles.center, { width: dimension, height: dimension }]}>
            <View
              style={{
                position: 'absolute',
                top: dimension * 0.16,
                left: dimension * 0.16,
                width: circleSize,
                height: circleSize,
                borderRadius: circleSize / 2,
                borderWidth: strokeWidth,
                borderColor: iconColor,
              }}
            />
            <View
              style={{
                position: 'absolute',
                bottom: dimension * 0.16,
                right: dimension * 0.16,
                width: dimension * 0.32,
                height: strokeWidth,
                backgroundColor: iconColor,
                borderRadius: strokeWidth,
                transform: [{ rotate: '45deg' }],
              }}
            />
          </View>
        );
      }

      case 'heart': {
        const lobSize = dimension * 0.44;
        return (
          <View style={[styles.center, { width: dimension, height: dimension }]}>
            <View
              style={{
                position: 'absolute',
                top: dimension * 0.18,
                left: dimension * 0.14,
                width: lobSize,
                height: lobSize * 1.3,
                borderTopLeftRadius: lobSize / 2,
                borderTopRightRadius: lobSize / 2,
                borderBottomLeftRadius: lobSize / 4,
                backgroundColor: iconColor,
                transform: [{ rotate: '-45deg' }],
              }}
            />
            <View
              style={{
                position: 'absolute',
                top: dimension * 0.18,
                right: dimension * 0.14,
                width: lobSize,
                height: lobSize * 1.3,
                borderTopLeftRadius: lobSize / 2,
                borderTopRightRadius: lobSize / 2,
                borderBottomRightRadius: lobSize / 4,
                backgroundColor: iconColor,
                transform: [{ rotate: '45deg' }],
              }}
            />
          </View>
        );
      }

      case 'message': {
        return (
          <View style={[styles.center, { width: dimension, height: dimension }]}>
            <View
              style={{
                width: dimension * 0.76,
                height: dimension * 0.58,
                borderRadius: dimension * 0.18,
                borderWidth: strokeWidth,
                borderColor: iconColor,
              }}
            />
            <View
              style={{
                position: 'absolute',
                bottom: dimension * 0.14,
                left: dimension * 0.28,
                width: dimension * 0.18,
                height: strokeWidth,
                backgroundColor: iconColor,
                transform: [{ rotate: '45deg' }],
              }}
            />
          </View>
        );
      }

      case 'filter': {
        return (
          <View style={[styles.center, { width: dimension, height: dimension, justifyContent: 'space-evenly' }]}>
            <View style={{ width: dimension * 0.75, height: strokeWidth, backgroundColor: iconColor, borderRadius: 2 }} />
            <View style={{ width: dimension * 0.5, height: strokeWidth, backgroundColor: iconColor, borderRadius: 2 }} />
            <View style={{ width: dimension * 0.25, height: strokeWidth, backgroundColor: iconColor, borderRadius: 2 }} />
          </View>
        );
      }

      case 'settings': {
        return (
          <View style={[styles.center, { width: dimension, height: dimension }]}>
            <View
              style={{
                width: dimension * 0.65,
                height: dimension * 0.65,
                borderRadius: dimension * 0.35,
                borderWidth: strokeWidth,
                borderColor: iconColor,
              }}
            />
            <View
              style={{
                width: dimension * 0.22,
                height: dimension * 0.22,
                borderRadius: dimension * 0.11,
                backgroundColor: iconColor,
              }}
            />
          </View>
        );
      }

      case 'shield': {
        return (
          <View style={[styles.center, { width: dimension, height: dimension }]}>
            <View
              style={{
                width: dimension * 0.65,
                height: dimension * 0.72,
                borderWidth: strokeWidth,
                borderColor: iconColor,
                borderTopLeftRadius: 4,
                borderTopRightRadius: 4,
                borderBottomLeftRadius: dimension * 0.35,
                borderBottomRightRadius: dimension * 0.35,
              }}
            />
          </View>
        );
      }

      case 'flag': {
        return (
          <View style={[styles.center, { width: dimension, height: dimension }]}>
            <View
              style={{
                position: 'absolute',
                left: dimension * 0.22,
                top: dimension * 0.15,
                width: strokeWidth,
                height: dimension * 0.7,
                backgroundColor: iconColor,
                borderRadius: strokeWidth,
              }}
            />
            <View
              style={{
                position: 'absolute',
                left: dimension * 0.22 + strokeWidth,
                top: dimension * 0.18,
                width: dimension * 0.45,
                height: dimension * 0.32,
                borderWidth: strokeWidth,
                borderColor: iconColor,
                borderTopRightRadius: 3,
                borderBottomRightRadius: 3,
              }}
            />
          </View>
        );
      }

      case 'more': {
        const dot = dimension * 0.14;
        return (
          <View style={[styles.center, { width: dimension, height: dimension, flexDirection: 'row', justifyContent: 'space-evenly' }]}>
            <View style={{ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: iconColor }} />
            <View style={{ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: iconColor }} />
            <View style={{ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: iconColor }} />
          </View>
        );
      }

      case 'location': {
        const pinSize = dimension * 0.52;
        return (
          <View style={[styles.center, { width: dimension, height: dimension }]}>
            <View
              style={{
                position: 'absolute',
                top: dimension * 0.12,
                width: pinSize,
                height: pinSize,
                borderRadius: pinSize / 2,
                borderWidth: strokeWidth,
                borderColor: iconColor,
              }}
            />
            <View
              style={{
                position: 'absolute',
                top: dimension * 0.28,
                width: dimension * 0.16,
                height: dimension * 0.16,
                borderRadius: dimension * 0.08,
                backgroundColor: iconColor,
              }}
            />
            <View
              style={{
                position: 'absolute',
                bottom: dimension * 0.14,
                width: strokeWidth,
                height: dimension * 0.32,
                backgroundColor: iconColor,
                borderRadius: strokeWidth,
              }}
            />
          </View>
        );
      }

      case 'calendar': {
        return (
          <View style={[styles.center, { width: dimension, height: dimension }]}>
            <View
              style={{
                width: dimension * 0.72,
                height: dimension * 0.65,
                borderRadius: 4,
                borderWidth: strokeWidth,
                borderColor: iconColor,
              }}
            />
            <View
              style={{
                position: 'absolute',
                top: dimension * 0.36,
                width: dimension * 0.72,
                height: strokeWidth,
                backgroundColor: iconColor,
              }}
            />
          </View>
        );
      }

      case 'camera': {
        return (
          <View style={[styles.center, { width: dimension, height: dimension }]}>
            <View
              style={{
                width: dimension * 0.76,
                height: dimension * 0.55,
                borderRadius: 5,
                borderWidth: strokeWidth,
                borderColor: iconColor,
              }}
            />
            <View
              style={{
                width: dimension * 0.26,
                height: dimension * 0.26,
                borderRadius: dimension * 0.13,
                borderWidth: strokeWidth,
                borderColor: iconColor,
              }}
            />
          </View>
        );
      }

      case 'edit': {
        return (
          <View style={[styles.center, { width: dimension, height: dimension }]}>
            <View
              style={{
                width: dimension * 0.65,
                height: strokeWidth * 2.5,
                borderRadius: 2,
                backgroundColor: iconColor,
                transform: [{ rotate: '-45deg' }],
              }}
            />
            <View
              style={{
                position: 'absolute',
                bottom: dimension * 0.2,
                left: dimension * 0.2,
                width: dimension * 0.15,
                height: strokeWidth,
                backgroundColor: iconColor,
              }}
            />
          </View>
        );
      }

      case 'sparkles':
      case 'star': {
        return (
          <View style={[styles.center, { width: dimension, height: dimension }]}>
            <View
              style={{
                width: dimension * 0.45,
                height: dimension * 0.45,
                borderWidth: strokeWidth,
                borderColor: iconColor,
                transform: [{ rotate: '45deg' }],
                borderRadius: 2,
              }}
            />
          </View>
        );
      }

      case 'user': {
        const head = dimension * 0.34;
        return (
          <View style={[styles.center, { width: dimension, height: dimension }]}>
            <View
              style={{
                width: head,
                height: head,
                borderRadius: head / 2,
                borderWidth: strokeWidth,
                borderColor: iconColor,
                marginBottom: 2,
              }}
            />
            <View
              style={{
                width: dimension * 0.65,
                height: dimension * 0.3,
                borderTopLeftRadius: dimension * 0.3,
                borderTopRightRadius: dimension * 0.3,
                borderWidth: strokeWidth,
                borderBottomWidth: 0,
                borderColor: iconColor,
              }}
            />
          </View>
        );
      }

      case 'bell': {
        return (
          <View style={[styles.center, { width: dimension, height: dimension }]}>
            <View
              style={{
                width: dimension * 0.55,
                height: dimension * 0.52,
                borderTopLeftRadius: dimension * 0.28,
                borderTopRightRadius: dimension * 0.28,
                borderWidth: strokeWidth,
                borderColor: iconColor,
              }}
            />
            <View
              style={{
                width: dimension * 0.7,
                height: strokeWidth,
                backgroundColor: iconColor,
                borderRadius: 1,
              }}
            />
            <View
              style={{
                width: dimension * 0.18,
                height: dimension * 0.08,
                backgroundColor: iconColor,
                borderRadius: 2,
                marginTop: 2,
              }}
            />
          </View>
        );
      }

      case 'lock': {
        return (
          <View style={[styles.center, { width: dimension, height: dimension }]}>
            <View
              style={{
                width: dimension * 0.38,
                height: dimension * 0.3,
                borderTopLeftRadius: dimension * 0.19,
                borderTopRightRadius: dimension * 0.19,
                borderWidth: strokeWidth,
                borderBottomWidth: 0,
                borderColor: iconColor,
              }}
            />
            <View
              style={{
                width: dimension * 0.62,
                height: dimension * 0.42,
                borderRadius: 4,
                borderWidth: strokeWidth,
                borderColor: iconColor,
              }}
            />
          </View>
        );
      }

      case 'refresh': {
        return (
          <View style={[styles.center, { width: dimension, height: dimension }]}>
            <View
              style={{
                width: dimension * 0.6,
                height: dimension * 0.6,
                borderRadius: dimension * 0.3,
                borderWidth: strokeWidth,
                borderColor: iconColor,
                borderBottomColor: 'transparent',
              }}
            />
            <View
              style={{
                position: 'absolute',
                top: dimension * 0.16,
                right: dimension * 0.18,
                width: dimension * 0.18,
                height: dimension * 0.18,
                borderRightWidth: strokeWidth,
                borderBottomWidth: strokeWidth,
                borderColor: iconColor,
                transform: [{ rotate: '45deg' }],
              }}
            />
          </View>
        );
      }

      case 'share': {
        const dotSize = dimension * 0.16;
        return (
          <View style={[styles.center, { width: dimension, height: dimension }]}>
            <View style={{ position: 'absolute', left: dimension * 0.15, top: half - dotSize / 2, width: dotSize, height: dotSize, borderRadius: dotSize / 2, backgroundColor: iconColor }} />
            <View style={{ position: 'absolute', right: dimension * 0.15, top: dimension * 0.18, width: dotSize, height: dotSize, borderRadius: dotSize / 2, backgroundColor: iconColor }} />
            <View style={{ position: 'absolute', right: dimension * 0.15, bottom: dimension * 0.18, width: dotSize, height: dotSize, borderRadius: dotSize / 2, backgroundColor: iconColor }} />
            <View style={{ position: 'absolute', left: dimension * 0.28, top: dimension * 0.34, width: dimension * 0.42, height: strokeWidth, backgroundColor: iconColor, transform: [{ rotate: '-25deg' }] }} />
            <View style={{ position: 'absolute', left: dimension * 0.28, bottom: dimension * 0.34, width: dimension * 0.42, height: strokeWidth, backgroundColor: iconColor, transform: [{ rotate: '25deg' }] }} />
          </View>
        );
      }

      case 'warning': {
        return (
          <View style={[styles.center, { width: dimension, height: dimension }]}>
            <View
              style={{
                width: dimension * 0.72,
                height: dimension * 0.68,
                borderWidth: strokeWidth,
                borderColor: iconColor,
                borderTopLeftRadius: 6,
                borderTopRightRadius: 6,
                borderBottomLeftRadius: 4,
                borderBottomRightRadius: 4,
              }}
            />
            <View
              style={{
                position: 'absolute',
                top: dimension * 0.28,
                width: strokeWidth,
                height: dimension * 0.22,
                backgroundColor: iconColor,
                borderRadius: strokeWidth,
              }}
            />
            <View
              style={{
                position: 'absolute',
                bottom: dimension * 0.22,
                width: strokeWidth,
                height: strokeWidth,
                borderRadius: strokeWidth / 2,
                backgroundColor: iconColor,
              }}
            />
          </View>
        );
      }

      case 'info': {
        return (
          <View style={[styles.center, { width: dimension, height: dimension }]}>
            <View
              style={{
                width: dimension * 0.7,
                height: dimension * 0.7,
                borderRadius: dimension * 0.35,
                borderWidth: strokeWidth,
                borderColor: iconColor,
              }}
            />
            <View
              style={{
                position: 'absolute',
                top: dimension * 0.26,
                width: strokeWidth,
                height: strokeWidth,
                borderRadius: strokeWidth / 2,
                backgroundColor: iconColor,
              }}
            />
            <View
              style={{
                position: 'absolute',
                bottom: dimension * 0.28,
                width: strokeWidth,
                height: dimension * 0.24,
                backgroundColor: iconColor,
                borderRadius: strokeWidth,
              }}
            />
          </View>
        );
      }

      case 'eye': {
        return (
          <View style={[styles.center, { width: dimension, height: dimension }]}>
            <View
              style={{
                width: dimension * 0.76,
                height: dimension * 0.44,
                borderRadius: dimension * 0.38,
                borderWidth: strokeWidth,
                borderColor: iconColor,
              }}
            />
            <View
              style={{
                width: dimension * 0.22,
                height: dimension * 0.22,
                borderRadius: dimension * 0.11,
                backgroundColor: iconColor,
              }}
            />
          </View>
        );
      }

      case 'eyeOff': {
        return (
          <View style={[styles.center, { width: dimension, height: dimension }]}>
            <View
              style={{
                width: dimension * 0.76,
                height: dimension * 0.44,
                borderRadius: dimension * 0.38,
                borderWidth: strokeWidth,
                borderColor: iconColor,
              }}
            />
            <View
              style={{
                position: 'absolute',
                width: dimension * 0.78,
                height: strokeWidth,
                backgroundColor: iconColor,
                transform: [{ rotate: '-45deg' }],
                borderRadius: strokeWidth,
              }}
            />
          </View>
        );
      }

      case 'trash': {
        return (
          <View style={[styles.center, { width: dimension, height: dimension }]}>
            <View
              style={{
                position: 'absolute',
                top: dimension * 0.2,
                width: dimension * 0.65,
                height: strokeWidth,
                backgroundColor: iconColor,
                borderRadius: 1,
              }}
            />
            <View
              style={{
                position: 'absolute',
                bottom: dimension * 0.18,
                width: dimension * 0.5,
                height: dimension * 0.52,
                borderWidth: strokeWidth,
                borderTopWidth: 0,
                borderColor: iconColor,
                borderBottomLeftRadius: 3,
                borderBottomRightRadius: 3,
              }}
            />
          </View>
        );
      }

      case 'send': {
        return (
          <View style={[styles.center, { width: dimension, height: dimension }]}>
            <View
              style={{
                width: dimension * 0.5,
                height: dimension * 0.5,
                borderTopWidth: strokeWidth,
                borderRightWidth: strokeWidth,
                borderColor: iconColor,
                transform: [{ rotate: '45deg' }, { translateX: -dimension * 0.08 }],
              }}
            />
            <View
              style={{
                position: 'absolute',
                width: dimension * 0.55,
                height: strokeWidth,
                backgroundColor: iconColor,
                transform: [{ rotate: '45deg' }],
              }}
            />
          </View>
        );
      }

      default:
        return (
          <View style={[styles.center, { width: dimension, height: dimension }]}>
            <View style={{ width: dimension * 0.5, height: dimension * 0.5, backgroundColor: iconColor, borderRadius: 2 }} />
          </View>
        );
    }
  };

  return (
    <View
      style={[{ width: dimension, height: dimension }, style]}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel || `${name} icon`}
      testID={testID || `icon-${name}`}
    >
      {renderIconContent()}
    </View>
  );
};

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
