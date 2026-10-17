import React, { useState } from 'react';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { ThemeProvider } from '../src/design/theme/ThemeContext.js';
import { LocalizationProvider } from '../src/design/localization/LocalizationContext.js';
import { haptics } from '../src/design/haptics/index.js';

// Silence raw hardware buzzer vibrations app-wide for smooth, quiet interaction
haptics.setEnabled(false);

export default function RootLayout(): React.JSX.Element {
  // Preload brand fonts globally for entire application
  useFonts({
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Folkra: require('../assets/fonts/folkra.ttf'),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Ethnocentric: require('../assets/fonts/Ethnocentric-Regular.otf'),
  });

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            staleTime: 1000 * 60 * 5, // 5 minutes
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider initialMode="dark">
        <LocalizationProvider initialLocale="en">
          <Stack
            screenOptions={{
              headerShown: false,
              gestureEnabled: false,
              animationMatchesGesture: false,
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false, gestureEnabled: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false, gestureEnabled: false }} />
            <Stack.Screen
              name="(onboarding)"
              options={{ headerShown: false, gestureEnabled: false }}
            />
            <Stack.Screen
              name="modal/filters"
              options={{ presentation: 'modal', headerShown: false, gestureEnabled: false }}
            />
            <Stack.Screen
              name="modal/report"
              options={{ presentation: 'modal', headerShown: false, gestureEnabled: false }}
            />
            <Stack.Screen
              name="modal/block"
              options={{
                presentation: 'transparentModal',
                headerShown: false,
                gestureEnabled: false,
              }}
            />
            <Stack.Screen
              name="modal/celebration"
              options={{
                presentation: 'transparentModal',
                headerShown: false,
                gestureEnabled: false,
              }}
            />
          </Stack>
        </LocalizationProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
