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
    },
  },
});
