import React from 'react';
import { Tabs } from 'expo-router';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { Icon } from '../../src/design/primitives/Icon.js';

export default function TabsLayout(): React.JSX.Element {
  const { theme } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="discovery/index"
        options={{
          title: 'Discover',
          tabBarLabel: 'Discover',
          tabBarIcon: ({ color, size }) => (
            <Icon name="sparkles" size={size || 22} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="matches/index"
        options={{
          title: 'Matches',
          tabBarLabel: 'Matches',
          tabBarIcon: ({ color, size }) => (
            <Icon name="heart" size={size || 22} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages/index"
        options={{
          title: 'Messages',
          tabBarLabel: 'Messages',
          tabBarIcon: ({ color, size }) => (
            <Icon name="message" size={size || 22} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore/index"
        options={{
          title: 'Explore',
          tabBarLabel: 'Explore',
          tabBarIcon: ({ color, size }) => (
            <Icon name="search" size={size || 22} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile/index"
        options={{
          title: 'Profile',
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Icon name="user" size={size || 22} color={color as string} />
          ),
        }}
      />
    </Tabs>
  );
}
