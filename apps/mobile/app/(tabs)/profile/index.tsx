import React from 'react';
import { View, StyleSheet, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { ProfileOverviewScreen } from '../../../src/profile/ProfileOverviewScreen.js';
import { TopNavHeader } from '../../../src/design/components/navigation/TopNavHeader.js';
import { IconButton } from '../../../src/design/components/button/IconButton.js';
import { useTheme } from '../../../src/design/theme/ThemeContext.js';

export default function ProfileTabRoute(): React.JSX.Element {
  const router = useRouter();
  const { theme } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <TopNavHeader
        title="My Profile"
        rightAction={
          <View style={styles.headerActions}>
            <IconButton
              icon="sparkles"
              size="sm"
              variant="secondary"
              accessibilityLabel="View Subscription"
              onPress={() => router.push('/billing')}
            />
            <IconButton
              icon="settings"
              size="sm"
              variant="secondary"
              accessibilityLabel="Open Settings"
              onPress={() => router.push('/settings')}
            />
          </View>
        }
      />
      <ProfileOverviewScreen
        onEditPress={() => router.push('/profile/edit')}
        onUploadPhotoPress={() => router.push('/profile/edit')}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
});
