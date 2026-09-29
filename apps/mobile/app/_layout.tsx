import React, { useState } from 'react';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../src/design/theme/ThemeContext.js';
import { LocalizationProvider } from '../src/design/localization/LocalizationContext.js';

export default function RootLayout(): React.JSX.Element {
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
      <ThemeProvider initialMode="system">
        <LocalizationProvider initialLocale="en">
          <Stack
            screenOptions={{
              headerShown: false,
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
            <Stack.Screen
              name="modal/filters"
              options={{ presentation: 'modal', headerShown: false }}
            />
            <Stack.Screen
              name="modal/report"
              options={{ presentation: 'modal', headerShown: false }}
            />
            <Stack.Screen
              name="modal/block"
              options={{ presentation: 'transparentModal', headerShown: false }}
            />
            <Stack.Screen
              name="modal/celebration"
              options={{ presentation: 'transparentModal', headerShown: false }}
            />
          </Stack>
        </LocalizationProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
