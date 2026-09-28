import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, ActivityIndicator } from 'react-native';
import type { MediaItemResponse } from '@platform/api-contracts';
import { useProfileStore } from '../profile-store.js';

interface MediaGridProps {
  media: MediaItemResponse[];
  onUploadPress?: () => void;
  onSetPrimary?: (mediaId: string) => void;
  onDeleteMedia?: (mediaId: string) => void;
  maxPhotos?: number;
}

export const MediaGrid: React.FC<MediaGridProps> = ({
  media,
  onUploadPress,
  onSetPrimary,
  onDeleteMedia,
  maxPhotos = 6,
}) => {
  const uploadProgress = useProfileStore((state) => state.uploadProgress);
  const slots = Array.from({ length: maxPhotos });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Photos ({media.length}/{maxPhotos})
      </Text>
      <Text style={styles.subtitle}>Add at least 1 photo to activate your profile.</Text>

      <View style={styles.grid}>
        {slots.map((_, index) => {
          const item = media[index];
          const isUploading =
            uploadProgress.phase === 'UPLOADING' ||
            uploadProgress.phase === 'REQUESTING_URL' ||
            uploadProgress.phase === 'COMPLETING';

          if (item) {
            return (
              <View key={item.id} style={styles.slot}>
                <Image source={{ uri: item.url }} style={styles.image} />
                {item.isPrimary && (
                  <View style={styles.primaryBadge}>
                    <Text style={styles.primaryBadgeText}>PRIMARY</Text>
                  </View>
                )}
                {!item.isPrimary && onSetPrimary && (
                  <TouchableOpacity
                    style={styles.makePrimaryButton}
                    onPress={() => onSetPrimary(item.id)}
                  >
                    <Text style={styles.buttonText}>Set Primary</Text>
                  </TouchableOpacity>
                )}
                {onDeleteMedia && (
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => onDeleteMedia(item.id)}
                  >
                    <Text style={styles.deleteButtonText}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          }

          // Slot is empty
          const isFirstEmpty = index === media.length;
          return (
            <TouchableOpacity
              key={`empty-${index}`}
              style={[styles.slot, styles.emptySlot]}
              onPress={isFirstEmpty ? onUploadPress : undefined}
              disabled={!isFirstEmpty || isUploading}
            >
              {isFirstEmpty && isUploading ? (
                <View style={styles.uploadingContainer}>
                  <ActivityIndicator color="#E11D48" />
                  <Text style={styles.uploadingText}>{uploadProgress.progress}%</Text>
                </View>
              ) : isFirstEmpty ? (
                <View style={styles.addPhotoContainer}>
                  <Text style={styles.plusText}>+</Text>
                  <Text style={styles.addPhotoText}>Add</Text>
                </View>
              ) : (
                <Text style={styles.placeholderNumber}>{index + 1}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slot: {
    width: '31%',
    aspectRatio: 0.75,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#F3F4F6',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  emptySlot: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: '#E11D48',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  primaryBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  makePrimaryButton: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    right: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingVertical: 3,
    borderRadius: 4,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  deleteButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  addPhotoContainer: {
    alignItems: 'center',
  },
  plusText: {
    fontSize: 24,
    color: '#E11D48',
    fontWeight: '600',
  },
  addPhotoText: {
    fontSize: 11,
    color: '#E11D48',
    fontWeight: '600',
  },
  placeholderNumber: {
    fontSize: 16,
    color: '#D1D5DB',
    fontWeight: '700',
  },
  uploadingContainer: {
    alignItems: 'center',
  },
  uploadingText: {
    fontSize: 11,
    color: '#E11D48',
    marginTop: 4,
    fontWeight: '700',
  },
});
