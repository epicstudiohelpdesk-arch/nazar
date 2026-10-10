import React from 'react';
import { View, TouchableOpacity, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { useTheme } from '../../theme/index.js';
import { Text } from '../../primitives/Text.js';
import { Icon, type IconName } from '../../primitives/Icon.js';
import { BottomSheet } from '../../components/modal/BottomSheet.js';
import { DestructiveDialog } from '../../components/modal/Dialog.js';
import { RadioRow } from '../../components/input/SelectionRows.js';
import { SurfaceCard } from '../../primitives/SurfaceCard.js';

// --- REPORT REASON LIST ---
export interface ReportReasonItem {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
}

export interface ReportReasonListProps {
  readonly reasons: readonly ReportReasonItem[];
  readonly selectedId?: string;
  readonly onSelect: (id: string) => void;
  readonly style?: StyleProp<ViewStyle>;
}

export const ReportReasonList: React.FC<ReportReasonListProps> = ({
  reasons,
  selectedId,
  onSelect,
  style,
}) => {
  return (
    <View style={style}>
      {reasons.map((r) => (
        <RadioRow
          key={r.id}
          label={r.label}
          description={r.description}
          isSelected={selectedId === r.id}
          onSelect={() => onSelect(r.id)}
        />
      ))}
    </View>
  );
};

// --- BLOCK CONFIRMATION ---
export interface BlockConfirmationProps {
  readonly visible: boolean;
  readonly targetName: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  readonly isSubmitting?: boolean;
}

export const BlockConfirmation: React.FC<BlockConfirmationProps> = ({
  visible,
  targetName,
  onConfirm,
  onCancel,
  isSubmitting = false,
}) => {
  return (
    <DestructiveDialog
      visible={visible}
      title={`Block ${targetName}?`}
      message="They will not be able to message you, view your profile, or find you on Nazar. This action is immediate and confidential."
      confirmLabel="Block Member"
      cancelLabel="Cancel"
      onConfirm={onConfirm}
      onCancel={onCancel}
      isSubmitting={isSubmitting}
    />
  );
};

// --- SAFETY ACTION SHEET ---
export interface SafetyActionSheetProps {
  readonly visible: boolean;
  readonly targetName: string;
  readonly onClose: () => void;
  readonly onReport: () => void;
  readonly onBlock: () => void;
  readonly onSafetyGuide?: () => void;
}

export const SafetyActionSheet: React.FC<SafetyActionSheetProps> = ({
  visible,
  targetName,
  onClose,
  onReport,
  onBlock,
  onSafetyGuide,
}) => {
  const { colors, spacing } = useTheme();

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Safety & Trust">
      <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.xs }}>
        <TouchableOpacity
          onPress={() => {
            onClose();
            onReport();
          }}
          style={styles.sheetItem}
          accessibilityRole="button"
          accessibilityLabel={`Report ${targetName}`}
        >
          <Icon name="flag" size="sm" color={colors.error} style={{ marginRight: spacing.md }} />
          <View style={{ flex: 1 }}>
            <Text variant="body" weight="semibold" style={{ color: colors.error }}>
              Report {targetName}
            </Text>
            <Text variant="caption" style={{ color: colors.textSecondary }}>
              Confidential report reviewed by our trust team
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            onClose();
            onBlock();
          }}
          style={styles.sheetItem}
          accessibilityRole="button"
          accessibilityLabel={`Block ${targetName}`}
        >
          <Icon
            name="shield"
            size="sm"
            color={colors.textPrimary}
            style={{ marginRight: spacing.md }}
          />
          <View style={{ flex: 1 }}>
            <Text variant="body" weight="semibold" style={{ color: colors.textPrimary }}>
              Block {targetName}
            </Text>
            <Text variant="caption" style={{ color: colors.textSecondary }}>
              Sever connection and prevent future interactions
            </Text>
          </View>
        </TouchableOpacity>

        {onSafetyGuide && (
          <TouchableOpacity
            onPress={() => {
              onClose();
              onSafetyGuide();
            }}
            style={styles.sheetItem}
            accessibilityRole="button"
            accessibilityLabel="View dating safety guide"
          >
            <Icon name="info" size="sm" color={colors.accent} style={{ marginRight: spacing.md }} />
            <View style={{ flex: 1 }}>
              <Text variant="body" weight="semibold" style={{ color: colors.textPrimary }}>
                Dating Safety Guidelines
              </Text>
              <Text variant="caption" style={{ color: colors.textSecondary }}>
                Best practices for online conversations and meeting in person
              </Text>
            </View>
          </TouchableOpacity>
        )}
      </View>
    </BottomSheet>
  );
};

// --- SAFETY NOTICE ---
export interface SafetyNoticeProps {
  readonly title?: string;
  readonly message: string;
  readonly style?: StyleProp<ViewStyle>;
}

export const SafetyNotice: React.FC<SafetyNoticeProps> = ({
  title = 'Your Privacy & Safety Matter',
  message,
  style,
}) => {
  const { colors, spacing } = useTheme();

  return (
    <SurfaceCard p="md" radius="radiusLG" style={style}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <Icon
          name="shield"
          size="md"
          color={colors.info}
          style={{ marginRight: spacing.sm, marginTop: 2 }}
        />
        <View style={{ flex: 1 }}>
          <Text variant="title" weight="semibold" style={{ color: colors.textPrimary }}>
            {title}
          </Text>
          <Text
            variant="bodySmall"
            style={{ color: colors.textSecondary, marginTop: 2, lineHeight: 20 }}
          >
            {message}
          </Text>
        </View>
      </View>
    </SurfaceCard>
  );
};

// --- MODERATION STATE ---
export interface ModerationStateProps {
  readonly status: 'pending_review' | 'flagged' | 'verified';
  readonly explanation?: string;
  readonly style?: StyleProp<ViewStyle>;
}

export const ModerationState: React.FC<ModerationStateProps> = ({ status, explanation, style }) => {
  const { colors, radii, spacing } = useTheme();

  const getConfig = () => {
    switch (status) {
      case 'flagged':
        return {
          title: 'Account Under Review',
          desc:
            explanation ||
            'Our trust and safety team is reviewing your profile photos or reported content.',
          icon: 'warning' as IconName,
          color: colors.warning,
          bg: colors.warningSoft,
        };
      case 'verified':
        return {
          title: 'Identity Verified',
          desc: explanation || 'Your profile has passed biometric and photo authenticity checks.',
          icon: 'check' as IconName,
          color: colors.success,
          bg: colors.successSoft,
        };
      case 'pending_review':
      default:
        return {
          title: 'Verification In Progress',
          desc: explanation || 'New photos are being reviewed for community guideline compliance.',
          icon: 'refresh' as IconName,
          color: colors.info,
          bg: colors.infoSoft,
        };
    }
  };

  const cfg = getConfig();

  return (
    <View
      style={[
        styles.moderationContainer,
        {
          backgroundColor: cfg.bg,
          borderColor: cfg.color,
          borderRadius: radii.radiusMD,
          padding: spacing.md,
        },
        style,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <Icon name={cfg.icon} size="md" color={cfg.color} style={{ marginRight: spacing.sm }} />
        <View style={{ flex: 1 }}>
          <Text variant="title" weight="bold" style={{ color: cfg.color }}>
            {cfg.title}
          </Text>
          <Text variant="bodySmall" style={{ color: colors.textPrimary, marginTop: 2 }}>
            {cfg.desc}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  moderationContainer: {
    width: '100%',
    borderWidth: 1,
    marginVertical: 4,
  },
});
