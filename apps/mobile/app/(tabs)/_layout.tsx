import React, { useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { Icon, type IconName } from '../../src/design/primitives/Icon.js';
import { haptics } from '../../src/design/haptics/index.js';

interface TabConfig {
  icon: IconName;
  label: string;
  badge?: number;
}

const TAB_CONFIGS: Record<string, TabConfig> = {
  'discovery/index': { icon: 'flame', label: 'Swipe' },
  'explore/index': { icon: 'compass', label: 'Explore' },
  'matches/index': { icon: 'heart', label: 'Likes', badge: 3 },
  'messages/index': { icon: 'message', label: 'Chat' },
  'profile/index': { icon: 'user', label: 'Profile' },
};

interface TabButtonProps {
  readonly routeName: string;
  readonly isFocused: boolean;
  readonly onPress: () => void;
  readonly onLongPress: () => void;
  readonly accessibilityLabel?: string;
  readonly testID?: string;
}

const TabButton: React.FC<TabButtonProps> = ({
  routeName,
  isFocused,
  onPress,
  onLongPress,
  accessibilityLabel,
  testID,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.88,
      tension: 100,
      friction: 6,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 60,
      friction: 5,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = () => {
    haptics.selection();
    onPress();
  };

  const config = TAB_CONFIGS[routeName] || { icon: 'sparkles' as IconName, label: 'Nazar' };

  const iconColor = isFocused
    ? routeName === 'discovery/index' || routeName === 'matches/index'
      ? '#DC0C24'
      : '#FFFFFF'
    : '#8E8E93';

  const renderIcon = () => {
    if (routeName === 'discovery/index') {
      return (
        <Icon
          name="flame"
          size={21}
          color={isFocused ? '#DC0C24' : '#8E8E93'}
          fill={isFocused ? '#DC0C24' : undefined}
          strokeWidth={isFocused ? 2.2 : 1.9}
        />
      );
    }

    if (routeName === 'matches/index') {
      return (
        <View style={styles.iconWithBadgeWrapper}>
          <Icon
            name="heart"
            size={21}
            color={isFocused ? '#DC0C24' : '#8E8E93'}
            fill={isFocused ? '#DC0C24' : undefined}
            strokeWidth={isFocused ? 2.2 : 1.9}
          />
          {config.badge !== undefined && (
            <View style={styles.tabBadgePill}>
              <Animated.Text style={styles.tabBadgeText}>{config.badge}</Animated.Text>
            </View>
          )}
        </View>
      );
    }

    if (routeName === 'messages/index') {
      return (
        <Icon name="message" size={21} color={iconColor} strokeWidth={isFocused ? 2.2 : 1.9} />
      );
    }

    if (routeName === 'explore/index') {
      return (
        <Icon name="compass" size={21} color={iconColor} strokeWidth={isFocused ? 2.2 : 1.9} />
      );
    }

    return <Icon name="user" size={21} color={iconColor} strokeWidth={isFocused ? 2.2 : 1.9} />;
  };

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={handlePress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.tabItemTouchable}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      <Animated.View
        style={[
          styles.tabCapsule,
          isFocused && styles.tabCapsuleActive,
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        {renderIcon()}
        <Animated.Text
          style={[styles.tabLabel, isFocused ? styles.tabLabelActive : styles.tabLabelInactive]}
          numberOfLines={1}
        >
          {config.label}
        </Animated.Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

type CustomBottomTabBarProps = Parameters<
  NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>
>[0];

const CustomBottomTabBar: React.FC<CustomBottomTabBarProps> = ({
  state,
  descriptors,
  navigation,
}) => {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomInset = insets?.bottom || 0;

  return (
    <View
      style={[
        styles.floatingDock,
        {
          bottom: Math.max(bottomInset, 14),
          backgroundColor: isDark ? 'rgba(18, 15, 23, 0.95)' : 'rgba(255, 255, 255, 0.96)',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(0, 0, 0, 0.08)',
          shadowOpacity: isDark ? 0.55 : 0.16,
        },
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.tabsRow}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const descriptor = descriptors[route.key];
          const options = descriptor?.options as
            { tabBarAccessibilityLabel?: string; title?: string } | undefined;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          const label = options?.tabBarAccessibilityLabel || options?.title || route.name;
          const baseName = route.name.split('/')[0];
          const testID = baseName === 'discovery' ? 'tab-discover' : `tab-${baseName}`;

          return (
            <TabButton
              key={route.key}
              routeName={route.name}
              isFocused={isFocused}
              onPress={onPress}
              onLongPress={onLongPress}
              accessibilityLabel={label}
              testID={testID}
            />
          );
        })}
      </View>
    </View>
  );
};

export default function TabsLayout(): React.JSX.Element {
  return (
    <Tabs
      tabBar={(props) => <CustomBottomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="discovery/index"
        options={{
          title: 'Discover',
          tabBarLabel: 'Swipe',
          tabBarAccessibilityLabel: 'Swipe tab, browse recommendations',
        }}
      />
      <Tabs.Screen
        name="explore/index"
        options={{
          title: 'Explore',
          tabBarLabel: 'Explore',
          tabBarAccessibilityLabel: 'Explore tab, social communities and events',
        }}
      />
      <Tabs.Screen
        name="matches/index"
        options={{
          title: 'Matches',
          tabBarLabel: 'Likes',
          tabBarAccessibilityLabel: 'Likes tab, your mutual connections and admirers',
        }}
      />
      <Tabs.Screen
        name="messages/index"
        options={{
          title: 'Messages',
          tabBarLabel: 'Chat',
          tabBarAccessibilityLabel: 'Chat tab, active conversations',
        }}
      />
      <Tabs.Screen
        name="profile/index"
        options={{
          title: 'Profile',
          tabBarLabel: 'Profile',
          tabBarAccessibilityLabel: 'Profile tab, your profile, settings, and subscription',
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  floatingDock: {
    position: 'absolute',
    left: 16,
    right: 16,
    maxWidth: 420,
    alignSelf: 'center',
    height: 68,
    borderRadius: 34,
    borderWidth: 1,
    elevation: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 24,
    justifyContent: 'center',
    zIndex: 100,
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: '100%',
    paddingHorizontal: 6,
  },
  tabItemTouchable: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabCapsule: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 22,
    minWidth: 62,
  },
  tabCapsuleActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  tabLabel: {
    fontSize: 10.5,
    marginTop: 3,
    letterSpacing: 0.1,
  },
  tabLabelActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  tabLabelInactive: {
    color: '#8E8E93',
    fontWeight: '600',
  },
  iconWithBadgeWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgePill: {
    position: 'absolute',
    top: -5,
    right: -10,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#DC0C24',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#120F17',
  },
  tabBadgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 11,
  },
});
