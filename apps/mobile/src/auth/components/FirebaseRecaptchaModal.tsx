import React from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { X, ShieldCheck } from 'lucide-react-native';
import { Text } from '../../design/primitives/Text.js';
import { useTheme } from '../../design/theme/ThemeContext.js';

export interface FirebaseRecaptchaModalProps {
  visible: boolean;
  onClose: () => void;
  onVerify: (recaptchaToken: string) => void;
  siteKey?: string;
  baseUrl?: string;
}

const RECAPTCHA_SITE_KEY = '6LcMZR0UAAAAALgPMcgHwga7gY5p8QMg1Hj-bmUv';
const FIREBASE_BASE_URL = 'https://nazar-85664.firebaseapp.com';

export const FirebaseRecaptchaModal: React.FC<FirebaseRecaptchaModalProps> = ({
  visible,
  onClose,
  onVerify,
  siteKey = RECAPTCHA_SITE_KEY,
  baseUrl = FIREBASE_BASE_URL,
}) => {
  const { theme } = useTheme();

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <script src="https://www.google.com/recaptcha/api.js" async defer></script>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            background-color: #1C1917;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            height: 100vh;
            overflow: hidden;
          }
          .captcha-container {
            display: flex;
            justify-content: center;
            align-items: center;
          }
        </style>
        <script>
          function onCaptchaSuccess(token) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'success', token: token }));
          }
          function onCaptchaExpired() {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'expired' }));
          }
          function onCaptchaError() {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error' }));
          }
        </script>
      </head>
      <body>
        <div class="captcha-container">
          <div
            class="g-recaptcha"
            data-sitekey="${siteKey}"
            data-theme="dark"
            data-callback="onCaptchaSuccess"
            data-expired-callback="onCaptchaExpired"
            data-error-callback="onCaptchaError">
          </div>
        </div>
      </body>
    </html>
  `;

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'success' && data.token) {
        onVerify(data.token);
      }
    } catch {
      // Ignore non-json messages
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.safeContainer}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
          >
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.headerTitleRow}>
                <ShieldCheck size={20} color={theme.colors.accent} style={{ marginRight: 8 }} />
                <Text level="body" style={{ fontWeight: '700', color: theme.colors.textPrimary }}>
                  Security Verification
                </Text>
              </View>

              <TouchableOpacity
                onPress={onClose}
                style={styles.closeButton}
                accessibilityRole="button"
                accessibilityLabel="Close security verification"
              >
                <X size={18} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text level="caption" color="secondary" style={styles.instructionText}>
              Please check the box below to dispatch your verification SMS.
            </Text>

            {/* ReCAPTCHA Webview */}
            <View style={styles.webviewWrapper}>
              <WebView
                originWhitelist={['*']}
                source={{ html: htmlContent, baseUrl }}
                onMessage={handleMessage}
                style={styles.webview}
                javaScriptEnabled
                domStorageEnabled
                startInLoadingState
                renderLoading={() => (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={theme.colors.accent} />
                  </View>
                )}
                testID="recaptcha-webview"
              />
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  safeContainer: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  closeButton: {
    padding: 6,
    borderRadius: 999,
  },
  instructionText: {
    marginBottom: 12,
    lineHeight: 18,
  },
  webviewWrapper: {
    height: 460,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#1C1917',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1C1917',
  },
});
