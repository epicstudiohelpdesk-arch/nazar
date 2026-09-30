import React from 'react';
import {
  View,
  Image,
  TouchableOpacity,
  StyleSheet,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import { useTheme } from '../../theme/index.js';
import { Text } from '../../primitives/Text.js';
import { Icon } from '../../primitives/Icon.js';
import { MultilineInput } from '../../components/input/MultilineInput.js';
import { ChipSelector, type ChipItem } from '../../components/input/ChipSelector.js';
import { ProfileCard, type ProfileCardData } from '../../components/card/ProfileCard.js';

// --- PHOTO EDITOR ---
export interface PhotoEditorItem {
  readonly id: string;
  readonly url: string;
  readonly isPrimary?: boolean;
}

export interface PhotoEditorProps {
  readonly photos: readonly PhotoEditorItem[];
  readonly maxPhotos?: number;
  readonly onAddPhoto: () => void;
  readonly onDeletePhoto: (id: string) => void;
  readonly onSetPrimary?: (id: string) => void;
  readonly style?: StyleProp<ViewStyle>;
}

export const PhotoEditor: React.FC<PhotoEditorProps> = ({
  photos,
  maxPhotos = 6,
  onAddPhoto,
  onDeletePhoto,
  onSetPrimary,
  style,
}) => {
  const { colors, radii, spacing } = useTheme();
  const slots = Array.from({ length: maxPhotos }, (_, i) => photos[i] || null);

  return (
    <View style={[styles.photoGrid, { gap: spacing.sm }, style]}>
      {slots.map((slot, index) => {
        const isPrimary = slot?.isPrimary || index === 0;

        if (slot) {
          return (
            <TouchableOpacity
              key={slot.id}
              onPress={() => onSetPrimary?.(slot.id)}
              disabled={isPrimary || !onSetPrimary}
              style={[
                styles.photoSlot,
                {
                  borderRadius: radii.radiusMD,
                  borderColor: isPrimary ? colors.accent : colors.border,
                  borderWidth: isPrimary ? 2 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={isPrimary ? 'Primary photo' : 'Set as primary photo'}
            >
              <Image source={{ uri: slot.url }} style={styles.photoImg} resizeMode="cover" />

              {/* Primary Star Badge */}
              {isPrimary && (
                <View style={[styles.primaryBadge, { backgroundColor: colors.accent, borderRadius: radii.radiusFull }]}>
                  <Text variant="caption" weight="bold" style={{ color: '#FFFFFF', fontSize: 10 }}>
                    Main
                  </Text>
                </View>
              )}

              {/* Delete Button */}
              <TouchableOpacity
                onPress={() => onDeletePhoto(slot.id)}
                style={[styles.deleteBtn, { backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: radii.radiusFull }]}
                accessibilityRole="button"
                accessibilityLabel="Delete photo"
              >
                <Icon name="close" size="tiny" color="#FFFFFF" />
              </TouchableOpacity>
            </TouchableOpacity>
          );
        }

        return (
          <TouchableOpacity
            key={`empty-${index}`}
            onPress={onAddPhoto}
            style={[
              styles.photoSlot,
              styles.emptySlot,
              {
                borderRadius: radii.radiusMD,
                borderColor: colors.border,
                backgroundColor: colors.surfaceMuted,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Add photo slot ${index + 1}`}
          >
            <Icon name="plus" size="md" color={colors.accent} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// --- PROMPT EDITOR ---
export interface PromptEditorProps {
  readonly question: string;
  readonly answer: string;
  readonly onChangeAnswer: (answer: string) => void;
  readonly onSelectQuestion?: () => void;
  readonly maxChars?: number;
  readonly placeholder?: string;
  readonly style?: StyleProp<ViewStyle>;
}

export const PromptEditor: React.FC<PromptEditorProps> = ({
  question,
  answer,
  onChangeAnswer,
  onSelectQuestion,
  maxChars = 200,
  placeholder = 'Write your response...',
  style,
}) => {
  const { colors, radii, spacing } = useTheme();

  return (
    <View
      style={[
        styles.promptContainer,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radii.radiusLG,
          padding: spacing.md,
        },
        style,
      ]}
    >
      <TouchableOpacity
        onPress={onSelectQuestion}
        disabled={!onSelectQuestion}
        style={styles.questionHeader}
        accessibilityRole={onSelectQuestion ? 'button' : 'none'}
        accessibilityLabel="Change prompt question"
      >
        <Text variant="bodySmall" weight="bold" style={{ color: colors.accent, flex: 1 }}>
          {question}
        </Text>
        {onSelectQuestion && (
          <Icon name="chevron" direction="right" size="tiny" color={colors.textTertiary} />
        )}
      </TouchableOpacity>

      <MultilineInput
        value={answer}
        onChangeText={onChangeAnswer}
        maxLength={maxChars}
        placeholder={placeholder}
        style={{ marginTop: spacing.xs, minHeight: 72 }}
      />
    </View>
  );
};

// --- INTEREST SELECTOR ---
export interface InterestSelectorProps {
  readonly options: readonly ChipItem[];
  readonly selectedIds: readonly string[];
  readonly onToggle: (id: string) => void;
  readonly maxSelection?: number;
  readonly label?: string;
  readonly style?: StyleProp<ViewStyle>;
}

export const InterestSelector: React.FC<InterestSelectorProps> = ({
  options,
  selectedIds,
  onToggle,
  maxSelection = 5,
  label = 'Select your interests',
  style,
}) => {
  return (
    <ChipSelector
      label={label}
      items={options}
      selectedIds={selectedIds}
      onToggle={onToggle}
      maxSelection={maxSelection}
      style={style as any}
    />
  );
};

// --- PROFILE FIELD ---
export interface ProfileFieldProps {
  readonly label: string;
  readonly value?: string;
  readonly placeholder?: string;
  readonly onPress?: () => void;
  readonly style?: StyleProp<ViewStyle>;
}

export const ProfileField: React.FC<ProfileFieldProps> = ({
  label,
  value,
  placeholder = 'Add',
  onPress,
  style,
}) => {
  const { colors, spacing } = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      style={[
        styles.fieldRow,
        {
          paddingVertical: spacing.sm,
          borderBottomColor: colors.border,
          borderBottomWidth: 1,
        },
        style,
      ]}
      accessibilityRole={onPress ? 'button' : 'none'}
      accessibilityLabel={`${label}: ${value || placeholder}`}
    >
      <Text variant="body" weight="medium" style={{ color: colors.textPrimary }}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text
          variant="body"
          style={{
            color: value ? colors.textSecondary : colors.accent,
            marginRight: onPress ? spacing.xs : 0,
          }}
        >
          {value || placeholder}
        </Text>
        {onPress && <Icon name="chevron" direction="right" size="tiny" color={colors.textTertiary} />}
      </View>
    </TouchableOpacity>
  );
};

// --- PROFILE PREVIEW ---
export interface ProfilePreviewProps {
  readonly profile: ProfileCardData;
  readonly style?: StyleProp<ViewStyle>;
}

export const ProfilePreview: React.FC<ProfilePreviewProps> = ({ profile, style }) => {
  return <ProfileCard profile={profile} context="profilePreview" style={style as any} />;
};

const styles = StyleSheet.create({
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
  },
  photoSlot: {
    width: '31%',
    aspectRatio: 3 / 4,
    overflow: 'hidden',
    position: 'relative',
  },
  emptySlot: {
    borderStyle: 'dashed',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoImg: {
    width: '100%',
    height: '100%',
  },
  primaryBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  deleteBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptContainer: {
    width: '100%',
    borderWidth: 1,
    marginVertical: 4,
  },
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
});
