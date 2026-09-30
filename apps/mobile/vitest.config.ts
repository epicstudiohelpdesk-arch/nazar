import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
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
    },
  },
});
