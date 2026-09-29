import React, { useState } from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/design/theme/ThemeContext.js';
import { TopNavHeader } from '../../src/design/components/navigation/TopNavHeader.js';
import { Heading } from '../../src/design/primitives/Heading.js';
import { Text } from '../../src/design/primitives/Text.js';
import { Slider } from '../../src/design/components/input/Slider.js';
import { Select } from '../../src/design/components/input/Select.js';
import { Button } from '../../src/design/components/button/Button.js';
import { SurfaceCard } from '../../src/design/primitives/SurfaceCard.js';

export default function FiltersModalRoute(): React.JSX.Element {
  const router = useRouter();
  const { theme } = useTheme();

  const [distanceKm, setDistanceKm] = useState(25);
  const [minAge, setMinAge] = useState(22);
  const [maxAge, setMaxAge] = useState(32);
  const [genderPref, setGenderPref] = useState('ALL');
  const [intentPref, setIntentPref] = useState('LONG_TERM');

  const handleApply = () => {
    router.back();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <TopNavHeader
        title="Discovery Preferences"
        onBack={() => router.back()}
        leftAction="close"
        rightAction={
          <Button
            variant="tertiary"
            size="sm"
            onPress={() => {
              setDistanceKm(25);
              setMinAge(21);
              setMaxAge(35);
            }}
            accessibilityLabel="Reset filters"
          >
            Reset
          </Button>
        }
      />
      <ScrollView contentContainerStyle={styles.content}>
        <SurfaceCard elevation="sm" style={styles.card}>
          <Heading level="h3">Maximum Distance</Heading>
          <Text level="title" color="accent">{distanceKm} km</Text>
          <Slider
            label=""
            value={distanceKm}
            minimumValue={1}
            maximumValue={100}
            step={1}
            onValueChange={setDistanceKm}
          />
        </SurfaceCard>

        <SurfaceCard elevation="sm" style={styles.card}>
          <Heading level="h3">Age Range</Heading>
          <Text level="title" color="accent">{minAge} – {maxAge} years</Text>
          <Slider
            label="Min Age"
            value={minAge}
            minimumValue={18}
            maximumValue={50}
            step={1}
            onValueChange={setMinAge}
          />
          <Slider
            label="Max Age"
            value={maxAge}
            minimumValue={minAge}
            maximumValue={65}
            step={1}
            onValueChange={setMaxAge}
          />
        </SurfaceCard>

        <SurfaceCard elevation="sm" style={styles.card}>
          <Heading level="h3">Interested In</Heading>
          <Select
            label=""
            value={genderPref}
            options={[
              { label: 'Everyone', value: 'ALL' },
              { label: 'Women', value: 'WOMEN' },
              { label: 'Men', value: 'MEN' },
            ]}
            onSelectOption={setGenderPref}
          />
        </SurfaceCard>

        <SurfaceCard elevation="sm" style={styles.card}>
          <Heading level="h3">Relationship Intent</Heading>
          <Select
            label=""
            value={intentPref}
            options={[
              { label: 'Long-term / Marriage', value: 'LONG_TERM' },
              { label: 'Dating with intention', value: 'INTENTIONAL' },
              { label: 'Open to possibilities', value: 'OPEN' },
            ]}
            onSelectOption={setIntentPref}
          />
        </SurfaceCard>

        <View style={styles.buttonWrapper}>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onPress={handleApply}
            accessibilityLabel="Apply discovery filters"
          >
            Apply Preferences
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
    gap: 16,
    paddingBottom: 40,
  },
  card: {
    padding: 16,
    gap: 8,
  },
  buttonWrapper: {
    marginTop: 8,
  },
});
