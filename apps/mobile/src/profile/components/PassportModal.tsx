import React, { useState, useEffect } from 'react';
import { Modal, View, StyleSheet, TouchableOpacity, ScrollView, Switch } from 'react-native';
import type { PassportLocationResponseDto } from '@platform/api-contracts';
import { useTheme } from '../../design/theme/ThemeContext.js';
import { Heading } from '../../design/primitives/Heading.js';
import { Text } from '../../design/primitives/Text.js';
import { Icon } from '../../design/primitives/Icon.js';
import { Button } from '../../design/components/button/Button.js';
import { TextInput } from '../../design/components/input/TextInput.js';

export interface GlobalHubPreset {
  readonly id: string;
  readonly name: string;
  readonly country: string;
  readonly flag: string;
  readonly latitude: number;
  readonly longitude: number;
}

export const POPULAR_TRAVEL_HUBS: readonly GlobalHubPreset[] = [
  {
    id: 'mumbai',
    name: 'Mumbai',
    country: 'India',
    flag: '🇮🇳',
    latitude: 19.076,
    longitude: 72.8777,
  },
  {
    id: 'delhi',
    name: 'Delhi',
    country: 'India',
    flag: '🇮🇳',
    latitude: 28.6139,
    longitude: 77.209,
  },
  {
    id: 'bengaluru',
    name: 'Bengaluru',
    country: 'India',
    flag: '🇮🇳',
    latitude: 12.9716,
    longitude: 77.5946,
  },
  {
    id: 'london',
    name: 'London',
    country: 'UK',
    flag: '🇬🇧',
    latitude: 51.5074,
    longitude: -0.1278,
  },
  {
    id: 'newyork',
    name: 'New York',
    country: 'USA',
    flag: '🇺🇸',
    latitude: 40.7128,
    longitude: -74.006,
  },
  { id: 'dubai', name: 'Dubai', country: 'UAE', flag: '🇦🇪', latitude: 25.2048, longitude: 55.2708 },
  {
    id: 'tokyo',
    name: 'Tokyo',
    country: 'Japan',
    flag: '🇯🇵',
    latitude: 35.6762,
    longitude: 139.6503,
  },
  {
    id: 'paris',
    name: 'Paris',
    country: 'France',
    flag: '🇫🇷',
    latitude: 48.8566,
    longitude: 2.3522,
  },
  {
    id: 'singapore',
    name: 'Singapore',
    country: 'Singapore',
    flag: '🇸🇬',
    latitude: 1.3521,
    longitude: 103.8198,
  },
  {
    id: 'sydney',
    name: 'Sydney',
    country: 'Australia',
    flag: '🇦🇺',
    latitude: -33.8688,
    longitude: 151.2093,
  },
  {
    id: 'toronto',
    name: 'Toronto',
    country: 'Canada',
    flag: '🇨🇦',
    latitude: 43.6532,
    longitude: -79.3832,
  },
  {
    id: 'amsterdam',
    name: 'Amsterdam',
    country: 'Netherlands',
    flag: '🇳🇱',
    latitude: 52.3676,
    longitude: 4.9041,
  },
];

export interface PassportModalProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly currentPassport?: PassportLocationResponseDto | null;
  readonly onSavePassport: (payload: {
    enabled: boolean;
    latitude?: number | null;
    longitude?: number | null;
    city?: string | null;
    country?: string | null;
  }) => Promise<void>;
  readonly isSaving?: boolean;
}

export function PassportModal({
  visible,
  onClose,
  currentPassport,
  onSavePassport,
  isSaving = false,
}: PassportModalProps): React.JSX.Element {
  const { theme } = useTheme();

  const [enabled, setEnabled] = useState(false);
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  // Sync state when currentPassport changes
  useEffect(() => {
    if (currentPassport) {
      setEnabled(currentPassport.enabled ?? false);
      setSelectedCity(currentPassport.city || '');
      setSelectedCountry(currentPassport.country || '');
      setLatitude(currentPassport.latitude ?? null);
      setLongitude(currentPassport.longitude ?? null);
    }
  }, [currentPassport, visible]);

  const handleSelectHub = (hub: GlobalHubPreset) => {
    setEnabled(true);
    setSelectedCity(hub.name);
    setSelectedCountry(hub.country);
    setLatitude(hub.latitude);
    setLongitude(hub.longitude);
  };

  const handleSave = async () => {
    await onSavePassport({
      enabled,
      latitude: enabled ? latitude : null,
      longitude: enabled ? longitude : null,
      city: enabled ? selectedCity.trim() || null : null,
      country: enabled ? selectedCountry.trim() || null : null,
    });
    onClose();
  };

  const handleDisable = async () => {
    setEnabled(false);
    await onSavePassport({
      enabled: false,
      latitude: null,
      longitude: null,
      city: null,
      country: null,
    });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { backgroundColor: theme.colors.surface }]}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleGroup}>
              <Icon name="compass" size={22} color={theme.colors.accent} />
              <Heading level="h3" style={{ marginLeft: 8 }}>
                Passport & Travel
              </Heading>
            </View>
            <TouchableOpacity
              onPress={onClose}
              accessibilityLabel="Close passport modal"
              style={styles.closeBtn}
            >
              <Icon name="close" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            {/* Status Card */}
            <View
              style={[
                styles.statusBanner,
                {
                  backgroundColor: enabled ? theme.colors.accentSoft : theme.colors.surfaceMuted,
                  borderColor: enabled ? theme.colors.accent : theme.colors.border,
                },
              ]}
            >
              <View style={styles.statusLeft}>
                <Text
                  level="caption"
                  style={{
                    fontWeight: '700',
                    color: enabled ? theme.colors.accent : theme.colors.textSecondary,
                  }}
                >
                  {enabled ? '✈️ PASSPORT ACTIVE' : '📍 REAL GPS LOCATION'}
                </Text>
                <Text level="body" style={{ fontWeight: '600', marginTop: 2 }}>
                  {enabled && selectedCity
                    ? `Swiping in ${selectedCity}${selectedCountry ? `, ${selectedCountry}` : ''}`
                    : 'Discovering members near your current device location'}
                </Text>
              </View>

              <Switch
                value={enabled}
                onValueChange={(val) => {
                  setEnabled(val);
                  if (val && !selectedCity && POPULAR_TRAVEL_HUBS[0]) {
                    handleSelectHub(POPULAR_TRAVEL_HUBS[0]);
                  }
                }}
                trackColor={{ false: theme.colors.surfaceMuted, true: theme.colors.accent }}
                thumbColor="#FFFFFF"
              />
            </View>

            <Text level="bodySmall" color="secondary" style={styles.subtext}>
              Match with locals and other travelers anywhere in the world before you arrive. Your
              profile will show a discreet "Visiting {selectedCity || 'City'}" badge.
            </Text>

            {/* Popular Global Hubs */}
            <View style={styles.section}>
              <Text level="label" color="primary" style={{ fontWeight: '700', marginBottom: 8 }}>
                Popular Destinations
              </Text>
              <View style={styles.hubGrid}>
                {POPULAR_TRAVEL_HUBS.map((hub) => {
                  const isSelected =
                    enabled && selectedCity.toLowerCase() === hub.name.toLowerCase();
                  return (
                    <TouchableOpacity
                      key={hub.id}
                      style={[
                        styles.hubCard,
                        {
                          backgroundColor: isSelected
                            ? theme.colors.accentSoft
                            : theme.colors.surfaceMuted,
                          borderColor: isSelected ? theme.colors.accent : theme.colors.border,
                        },
                      ]}
                      onPress={() => handleSelectHub(hub)}
                    >
                      <Text level="title" style={{ fontSize: 20 }}>
                        {hub.flag}
                      </Text>
                      <Text
                        level="caption"
                        style={{
                          fontWeight: '700',
                          marginTop: 4,
                          color: isSelected ? theme.colors.accent : theme.colors.textPrimary,
                        }}
                      >
                        {hub.name}
                      </Text>
                      <Text level="caption" color="secondary" style={{ fontSize: 10 }}>
                        {hub.country}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Custom Location Input */}
            <View style={styles.section}>
              <Text level="label" color="primary" style={{ fontWeight: '700', marginBottom: 8 }}>
                Custom Destination
              </Text>
              <TextInput
                label="City Name"
                value={selectedCity}
                onChangeText={(text) => {
                  setSelectedCity(text);
                  if (text.trim().length > 0) setEnabled(true);
                }}
                placeholder="e.g. Barcelona, Rome, Austin"
              />
              <TextInput
                label="Country / State"
                value={selectedCountry}
                onChangeText={setSelectedCountry}
                placeholder="e.g. Spain, Italy, Texas"
              />
            </View>
          </ScrollView>

          {/* Action Footer */}
          <View style={styles.footerRow}>
            {enabled ? (
              <Button
                variant="destructive"
                size="md"
                label="Clear & Return Home"
                onPress={handleDisable}
                disabled={isSaving}
                style={{ flex: 1, marginRight: 8 }}
              />
            ) : null}

            <Button
              variant="primary"
              size="md"
              label={isSaving ? 'Updating...' : enabled ? 'Apply Passport' : 'Save'}
              onPress={handleSave}
              disabled={isSaving}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
  },
  scrollArea: {
    maxHeight: 460,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  statusLeft: {
    flex: 1,
    paddingRight: 10,
  },
  subtext: {
    marginTop: 10,
    lineHeight: 18,
  },
  section: {
    marginTop: 18,
  },
  hubGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  hubCard: {
    width: '31%',
    borderRadius: 10,
    borderWidth: 1.5,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  footerRow: {
    flexDirection: 'row',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB22',
  },
});
