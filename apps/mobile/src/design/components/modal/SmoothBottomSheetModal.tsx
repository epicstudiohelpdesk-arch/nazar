import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Keyboard,
  Animated,
  Easing,
  Platform,
  Dimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/index.js';

export interface SmoothBottomSheetModalProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly onDismiss?: () => void;
  readonly children: React.ReactNode;
  readonly sheetStyle?: StyleProp<ViewStyle>;
  readonly testID?: string;
  readonly height?: number | `${number}%`;
  readonly maxHeight?: number | `${number}%`;
  readonly blurIntensity?: number;
  readonly showHandle?: boolean;
  readonly disableKeyboardAvoiding?: boolean;
}

export const SmoothBottomSheetModal: React.FC<SmoothBottomSheetModalProps> = ({
  visible,
  onClose,
  onDismiss,
  children,
  sheetStyle,
  testID,
  height,
  maxHeight,
  blurIntensity = Platform.OS === 'ios' ? 2 : 1,
  showHandle = true,
  disableKeyboardAvoiding = false,
}) => {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const windowHeight = Dimensions.get('window').height;
  const exitOffset = Math.max(Math.round(windowHeight * 0.85), 650);

  const [isRendered, setIsRendered] = useState(visible);
  const backdropAnim = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const sheetTranslateY = useRef(new Animated.Value(visible ? 0 : exitOffset)).current;

  useEffect(() => {
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

    if (visible) {
      setIsRendered(true);
      Animated.parallel([
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(sheetTranslateY, {
          toValue: 0,
          duration: 320,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          useNativeDriver: true,
        }),
      ]).start();
    } else if (isRendered) {
      Keyboard.dismiss();
      Animated.parallel([
        Animated.timing(sheetTranslateY, {
          toValue: exitOffset,
          duration: 460,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(() => {
        setIsRendered(false);
        onDismiss?.();
      });

      fallbackTimer = setTimeout(() => {
        setIsRendered(false);
        onDismiss?.();
      }, 550);
    }

    return () => {
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
      }
    };
  }, [visible, isRendered, exitOffset, backdropAnim, sheetTranslateY]);

  if (!isRendered) {
    return null;
  }

  return (
    <Modal
      visible={isRendered}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
      onDismiss={onDismiss}
      statusBarTranslucent={true}
      testID={testID}
    >
      <View style={StyleSheet.absoluteFill}>
        {/* Soft Stationary Dark & Blurry Backdrop (Fades in/out in place without vertical sliding) */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: backdropAnim,
            },
          ]}
        >
          <BlurView
            intensity={blurIntensity}
            tint={isDark ? 'dark' : 'default'}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: isDark ? 'rgba(0, 0, 0, 0.24)' : 'rgba(0, 0, 0, 0.12)',
              },
            ]}
          />
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Dismiss modal"
          />
        </Animated.View>

        {/* Bottom Sheet Container */}
        <KeyboardAvoidingView
          behavior={
            disableKeyboardAvoiding ? undefined : Platform.OS === 'ios' ? 'padding' : undefined
          }
          style={styles.sheetWrapper}
          pointerEvents="box-none"
        >
          <Animated.View
            onStartShouldSetResponder={() => true}
            style={[
              styles.sheetSurface,
              {
                backgroundColor: isDark ? '#121215' : '#FCFCFD',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.10)' : '#E4E4E7',
                paddingBottom: Math.max(insets.bottom + 12, Platform.OS === 'ios' ? 36 : 24),
                transform: [{ translateY: sheetTranslateY }],
              },
              height != null ? { height } : null,
              maxHeight != null ? { maxHeight } : null,
              sheetStyle,
            ]}
          >
            {showHandle && (
              <View
                style={[
                  styles.handlePill,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.14)',
                  },
                ]}
              />
            )}
            {children}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  sheetWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetSurface: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 20,
  },
  handlePill: {
    width: 38,
    height: 4.5,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 14,
  },
});
