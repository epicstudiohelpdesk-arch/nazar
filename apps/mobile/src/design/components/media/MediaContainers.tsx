import React, { useState } from 'react';
import {
  View,
  Image,
  TouchableOpacity,
  Modal,
  ScrollView,
  Dimensions,
  StyleSheet,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/index.js';
import { Text } from '../../primitives/Text.js';
import { Icon } from '../../primitives/Icon.js';
import { MediaView } from './MediaView.js';

export const Media = MediaView;

// --- MEDIA THUMBNAIL ---
export interface MediaThumbnailProps {
  readonly uri: string;
  readonly size?: number;
  readonly rounded?: boolean;
  readonly onPress?: () => void;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
}

export const MediaThumbnail: React.FC<MediaThumbnailProps> = ({
  uri,
  size = 64,
  rounded = true,
  onPress,
  style,
  testID,
}) => {
  const { radii, colors } = useTheme();

  return (
    <TouchableOpacity
      style={[
        styles.thumbnail,
        {
          width: size,
          height: size,
          borderRadius: rounded ? radii.radiusMD : 0,
          backgroundColor: colors.surfaceMuted,
          borderColor: colors.border,
          borderWidth: 1,
        },
        style,
      ]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.8}
      testID={testID}
      accessibilityRole={onPress ? 'button' : 'image'}
      accessibilityLabel="Media thumbnail"
    >
      <Image
        source={{ uri }}
        style={{ width: '100%', height: '100%', borderRadius: rounded ? radii.radiusMD : 0 }}
        resizeMode="cover"
      />
    </TouchableOpacity>
  );
};

// --- MEDIA GRID ---
export interface MediaGridGalleryProps {
  readonly images: readonly string[];
  readonly columns?: 2 | 3;
  readonly onImagePress?: (index: number) => void;
  readonly maxDisplay?: number;
  readonly style?: StyleProp<ViewStyle>;
}

export const MediaGridGallery: React.FC<MediaGridGalleryProps> = ({
  images,
  columns = 2,
  onImagePress,
  maxDisplay = 6,
  style,
}) => {
  const { radii, spacing } = useTheme();
  const displayImages = images.slice(0, maxDisplay);
  const remaining = images.length - maxDisplay;

  return (
    <View style={[styles.grid, { gap: spacing.xs }, style]}>
      {displayImages.map((uri, index) => {
        const isLastAndHasMore = index === maxDisplay - 1 && remaining > 0;
        const widthPercent = columns === 2 ? '48.5%' : '31.5%';

        return (
          <TouchableOpacity
            key={index}
            style={[
              styles.gridItem,
              {
                width: widthPercent,
                borderRadius: radii.radiusMD,
                aspectRatio: 1,
              },
            ]}
            onPress={() => onImagePress?.(index)}
            disabled={!onImagePress}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`View photo ${index + 1}`}
          >
            <Image
              source={{ uri }}
              style={[styles.fullSize, { borderRadius: radii.radiusMD }]}
              resizeMode="cover"
            />
            {isLastAndHasMore && (
              <View style={[styles.scrimOverlay, { borderRadius: radii.radiusMD }]}>
                <Text variant="title" weight="bold" style={{ color: '#FFFFFF' }}>
                  +{remaining}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

export const MediaGrid = MediaGridGallery;

// --- MEDIA CAROUSEL ---
export interface MediaCarouselProps {
  readonly images: readonly string[];
  readonly height?: number;
  readonly onImagePress?: (index: number) => void;
  readonly style?: StyleProp<ViewStyle>;
}

export const MediaCarousel: React.FC<MediaCarouselProps> = ({
  images,
  height = 360,
  onImagePress,
  style,
}) => {
  const { colors, radii } = useTheme();
  const [activeIndex, setActiveIndex] = useState(0);
  const screenWidth = Dimensions.get('window').width;

  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / screenWidth);
    setActiveIndex(index);
  };

  return (
    <View style={[{ height, width: '100%', position: 'relative' }, style]}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {images.map((uri, idx) => (
          <TouchableOpacity
            key={idx}
            style={{ width: screenWidth, height }}
            onPress={() => onImagePress?.(idx)}
            activeOpacity={onImagePress ? 0.9 : 1}
            disabled={!onImagePress}
          >
            <Image source={{ uri }} style={styles.fullSize} resizeMode="cover" />
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Pagination Dots */}
      {images.length > 1 && (
        <View style={styles.dotsContainer}>
          {images.map((_, idx) => (
            <View
              key={idx}
              style={[
                styles.dot,
                {
                  borderRadius: radii.radiusFull,
                  backgroundColor:
                    idx === activeIndex ? colors.accent : 'rgba(255,255,255,0.6)',
                  width: idx === activeIndex ? 16 : 6,
                },
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
};

// --- FULLSCREEN MEDIA VIEWER ---
export interface FullScreenMediaViewerProps {
  readonly visible: boolean;
  readonly images: readonly string[];
  readonly initialIndex?: number;
  readonly onClose: () => void;
}

export const FullScreenMediaViewer: React.FC<FullScreenMediaViewerProps> = ({
  visible,
  images,
  initialIndex = 0,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const screenWidth = Dimensions.get('window').width;
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / screenWidth);
    setCurrentIndex(index);
  };

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.lightboxContainer}>
        {/* Lightbox Header Bar */}
        <View
          style={[
            styles.lightboxHeader,
            { paddingTop: Math.max(insets.top, 16) },
          ]}
        >
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Close image viewer"
          >
            <Icon name="close" size="md" color="#FFFFFF" />
          </TouchableOpacity>

          <Text variant="body" weight="semibold" style={{ color: '#FFFFFF' }}>
            {currentIndex + 1} / {images.length}
          </Text>

          <View style={{ width: 44 }} />
        </View>

        {/* Scrollable Lightbox Image Strip */}
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          style={{ flex: 1 }}
        >
          {images.map((uri, idx) => (
            <View key={idx} style={[styles.lightboxSlide, { width: screenWidth }]}>
              <Image source={{ uri }} style={styles.lightboxImage} resizeMode="contain" />
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  thumbnail: {
    overflow: 'hidden',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
  },
  gridItem: {
    overflow: 'hidden',
    position: 'relative',
  },
  fullSize: {
    width: '100%',
    height: '100%',
  },
  scrimOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    height: 6,
  },
  lightboxContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  lightboxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    zIndex: 10,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightboxSlide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightboxImage: {
    width: '100%',
    height: '100%',
  },
});
