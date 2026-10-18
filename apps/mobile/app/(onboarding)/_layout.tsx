import React from 'react';
import { Stack } from 'expo-router';

export default function OnboardingLayout(): React.JSX.Element {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: false,
        animationMatchesGesture: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="intro" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="profile-setup" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="photos" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="interests" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="lifestyle" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="prompts" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="preferences" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="permissions" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="preview" options={{ headerShown: false, gestureEnabled: false }} />
    </Stack>
  );
}
