import React, { useState } from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { TopNavHeader } from '../../src/design/components/navigation/TopNavHeader.js';
import { Heading } from '../../src/design/primitives/Heading.js';
import { Text } from '../../src/design/primitives/Text.js';
import { TextInput } from '../../src/design/components/input/TextInput.js';
import { MultilineInput } from '../../src/design/components/input/MultilineInput.js';
import { ImagePickerTrigger } from '../../src/design/components/input/ImagePickerTrigger.js';
import { Button } from '../../src/design/components/button/Button.js';
import { useProfileStore } from '../../src/profile/profile-store.js';

export default function EditProfileRoute(): React.JSX.Element {
  const router = useRouter();
  const { theme } = useTheme();
  const profile = useProfileStore((state) => state.profile);

  const [bio, setBio] = useState(profile?.bio || 'Lover of morning treks, indie cinema, and authentic chai.');
  const [city, setCity] = useState(profile?.city || 'Mumbai');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      Alert.alert('Saved', 'Your profile updates have been published.');
      router.back();
    }, 400);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <TopNavHeader
        title="Edit Profile"
        onBack={() => router.back()}
        leftAction="back"
        rightAction={
          <Button
            variant="tertiary"
            size="sm"
            onPress={() => router.push('/profile/preview')}
            accessibilityLabel="Preview Profile"
          >
            Preview
          </Button>
        }
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Heading level="h3">Photos</Heading>
          <Text level="bodySmall" color="secondary">
            Drag to reorder. The first photo is what people see first in discovery.
          </Text>
          <View style={styles.photoGrid}>
            <View style={styles.photoSlot}>
              <ImagePickerTrigger
                imageUri="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500"
                onPickImage={() => {}}
                onRemoveImage={() => {}}
              />
            </View>
            <View style={styles.photoSlot}>
              <ImagePickerTrigger
                imageUri="https://images.unsplash.com/photo-1517841905240-472988babdf9?w=500"
                onPickImage={() => {}}
                onRemoveImage={() => {}}
              />
            </View>
            <View style={styles.photoSlot}>
              <ImagePickerTrigger
                onPickImage={() => {}}
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Heading level="h3">About Me</Heading>
          <MultilineInput
            label="Bio"
            value={bio}
            onChangeText={setBio}
            maxLength={300}
            helperText="Write about your daily life, quirks, and passions."
          />
        </View>

        <View style={styles.section}>
          <Heading level="h3">Location</Heading>
          <TextInput
            label="City"
            value={city}
            onChangeText={setCity}
            placeholder="e.g. Mumbai, Maharashtra"
          />
        </View>

        <View style={styles.buttonWrapper}>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            isLoading={isSaving}
            onPress={handleSave}
            accessibilityLabel="Save profile changes"
          >
            Save Changes
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    gap: 24,
    paddingBottom: 40,
  },
  section: {
    gap: 12,
  },
  photoGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  photoSlot: {
    width: 100,
    height: 130,
  },
  buttonWrapper: {
    marginTop: 8,
  },
});
