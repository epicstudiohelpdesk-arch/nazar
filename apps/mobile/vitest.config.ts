import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
  },
  define: {
    __DEV__: true,
  },
  resolve: {
    alias: {
      'react-native': path.resolve(__dirname, 'tests/mocks/react-native.ts'),
      'expo-router': path.resolve(__dirname, 'tests/mocks/expo-router.ts'),
      'react-native-safe-area-context': path.resolve(
        __dirname,
        'tests/mocks/react-native-safe-area-context.ts'
      ),
      'expo-notifications': path.resolve(__dirname, 'tests/mocks/expo-notifications.ts'),
      'expo-device': path.resolve(__dirname, 'tests/mocks/expo-device.ts'),
      'expo-linear-gradient': path.resolve(__dirname, 'tests/mocks/expo-linear-gradient.ts'),
      'react-native-svg': path.resolve(__dirname, 'tests/mocks/react-native-svg.ts'),
      'lucide-react-native': path.resolve(__dirname, 'tests/mocks/lucide-react-native.ts'),
      'react-native-webview': path.resolve(__dirname, 'tests/mocks/react-native-webview.ts'),
      'expo-font': path.resolve(__dirname, 'tests/mocks/expo-font.ts'),
      'expo-web-browser': path.resolve(__dirname, 'tests/mocks/expo-web-browser.ts'),
      'expo-auth-session': path.resolve(__dirname, 'tests/mocks/expo-auth-session.ts'),
      'expo-constants': path.resolve(__dirname, 'tests/mocks/expo-constants.ts'),
      'expo-local-authentication': path.resolve(
        __dirname,
        'tests/mocks/expo-local-authentication.ts'
      ),
      'expo-crypto': path.resolve(__dirname, 'tests/mocks/expo-crypto.ts'),
    },
  },
});
