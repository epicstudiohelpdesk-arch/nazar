import React from 'react';
import {
  View,
  StyleSheet,
  Switch,
  Image,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import type { SmartPhotoStatItemDto } from '@platform/api-contracts';
import { useTheme } from '../../design/theme/ThemeContext.js';
import { Heading } from '../../design/primitives/Heading.js';
import { Text } from '../../design/primitives/Text.js';
import { Icon } from '../../design/primitives/Icon.js';

export interface SmartPhotosCardProps {
  readonly enabled: boolean;
  readonly onToggle: (enabled: boolean) => void;
  readonly photos?: readonly SmartPhotoStatItemDto[];
  readonly isLoading?: boolean;
  readonly isToggling?: boolean;
}

export function SmartPhotosCard({
  enabled,
  onToggle,
  photos = [],
  isLoading = false,
  isToggling = false,
}: SmartPhotosCardProps): React.JSX.Element {
  const { theme } = useTheme();

  // Find top performer photo (highest conversionRate among photos with >= 1 impression)
  const topPerformerMediaId = React.useMemo(() => {
    const withImpressions = photos.filter((p) => p.impressions > 0);
    if (withImpressions.length < 2) return null;
    const sorted = [...withImpressions].sort((a, b) => b.conversionRate - a.conversionRate);
    return sorted[0]?.mediaId ?? null;
  }, [photos]);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: enabled ? theme.colors.accent : theme.colors.border,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.titleContainer}>
          <View style={styles.iconTitleRow}>
            <Icon name="sparkles" size={18} color={theme.colors.accent} />
            <Heading level="title" style={styles.titleText}>
              Smart Photos
            </Heading>
            <View style={[styles.badge, { backgroundColor: theme.colors.accentSoft }]}>
              <Text level="caption" style={{ color: theme.colors.accent, fontWeight: '700' }}>
                AI BANDIT
              </Text>
            </View>
          </View>
          <Text level="bodySmall" color="secondary" style={styles.description}>
            Continuously tests all your photos using a Multi-Armed Bandit algorithm (UCB1) and
            automatically puts your highest-converting photo first.
          </Text>
        </View>

        <View style={styles.switchContainer}>
          {isToggling ? (
            <ActivityIndicator size="small" color={theme.colors.accent} />
          ) : (
            <Switch
              value={enabled}
              onValueChange={onToggle}
              trackColor={{ false: theme.colors.surfaceMuted, true: theme.colors.accent }}
              thumbColor="#FFFFFF"
            />
          )}
        </View>
      </View>

      {enabled && (
        <View style={styles.bodyContainer}>
          {isLoading ? (
            <View style={styles.centerLoading}>
              <ActivityIndicator size="small" color={theme.colors.accent} />
              <Text level="caption" color="secondary" style={{ marginTop: 6 }}>
                Calculating photo performance...
              </Text>
            </View>
          ) : photos.length === 0 ? (
            <View
              style={[
                styles.emptyBanner,
                { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border },
              ]}
            >
              <Text level="bodySmall" color="secondary" style={{ textAlign: 'center' }}>
                Add at least 2 photos to enable automated bandit testing.
              </Text>
            </View>
          ) : (
            <View>
              <View style={styles.statsHeaderRow}>
                <Text level="label" color="primary" style={{ fontWeight: '600' }}>
                  Live Conversion Performance
                </Text>
                <Text level="caption" color="secondary">
                  Updated in real-time
                </Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.photosScroll}
              >
                {photos.map((item) => {
                  const isTop = item.mediaId === topPerformerMediaId;
                  const ratePercent = (item.conversionRate * 100).toFixed(1);

                  return (
                    <View
                      key={item.mediaId}
                      style={[
                        styles.photoStatCard,
                        {
                          backgroundColor: theme.colors.surfaceMuted,
                          borderColor: isTop ? theme.colors.accent : theme.colors.border,
                        },
                      ]}
                    >
                      <View style={styles.imageContainer}>
                        <Image source={{ uri: item.photoUrl }} style={styles.thumbnail} />
                        {item.isPrimary && (
                          <View
                            style={[
                              styles.primaryPill,
                              { backgroundColor: theme.colors.accent },
                            ]}
                          >
                            <Text level="caption" style={styles.pillText}>
                              1st (Active)
                            </Text>
                          </View>
                        )}
                        {isTop && (
                          <View style={styles.topPerformerPill}>
                            <Text level="caption" style={styles.topPerformerPillText}>
                              Top Pick ⭐
                            </Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.metricsBox}>
                        <View style={styles.metricRow}>
                          <Text level="caption" color="secondary">
                            Impressions
                          </Text>
                          <Text level="caption" style={{ fontWeight: '600' }}>
                            {item.impressions}
                          </Text>
                        </View>
                        <View style={styles.metricRow}>
                          <Text level="caption" color="secondary">
                            Likes
                          </Text>
                          <Text level="caption" style={{ fontWeight: '600' }}>
                            {item.likes}
                          </Text>
                        </View>
                        <View style={styles.metricRow}>
                          <Text level="caption" color="secondary">
                            Win Rate
                          </Text>
                          <Text
                            level="caption"
                            style={{
                              fontWeight: '700',
                              color: isTop ? theme.colors.accent : theme.colors.textPrimary,
                            }}
                          >
                            {ratePercent}%
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 16,
    marginVertical: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  titleContainer: {
    flex: 1,
    paddingRight: 12,
  },
  iconTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  titleText: {
    marginRight: 4,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  description: {
    marginTop: 6,
    lineHeight: 18,
  },
  switchContainer: {
    paddingTop: 4,
  },
  bodyContainer: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB22',
    paddingTop: 12,
  },
  centerLoading: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  emptyBanner: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
  },
  statsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  photosScroll: {
    gap: 12,
    paddingVertical: 4,
  },
  photoStatCard: {
    width: 120,
    borderRadius: 10,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  imageContainer: {
    width: 120,
    height: 120,
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  primaryPill: {
    position: 'absolute',
    top: 6,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pillText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 10,
  },
  topPerformerPill: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: '#059669',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  topPerformerPillText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 10,
  },
  metricsBox: {
    padding: 8,
    gap: 4,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
