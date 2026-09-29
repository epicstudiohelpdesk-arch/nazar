import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { colors, spacing } from '@platform/ui';
import type { ReportReasonCode, ReportTargetType } from '@platform/api-contracts';

export interface ReportModalProps {
  readonly visible: boolean;
  readonly targetType: ReportTargetType;
  readonly targetId: string;
  readonly targetName?: string;
  readonly onClose: () => void;
  readonly onSubmit: (data: {
    targetType: ReportTargetType;
    targetId: string;
    reasonCode: ReportReasonCode;
    notes?: string;
  }) => Promise<void>;
}

const REPORT_REASONS: Array<{ code: ReportReasonCode; label: string; description: string }> = [
  { code: 'HARASSMENT', label: 'Harassment & Bullying', description: 'Insults, bullying, or aggressive behavior' },
  { code: 'ABUSE', label: 'Abuse & Intimidation', description: 'Emotional, verbal, or abusive conduct' },
  { code: 'THREATS', label: 'Threats of Harm', description: 'Direct or indirect threats toward someone' },
  { code: 'HATE_OR_DISCRIMINATION', label: 'Hate Speech & Discrimination', description: 'Attack based on identity, race, religion, or gender' },
  { code: 'SEXUAL_CONTENT', label: 'Explicit Sexual Content', description: 'Nudity or sexually explicit imagery' },
  { code: 'UNWANTED_SEXUAL_BEHAVIOR', label: 'Unwanted Sexual Advances', description: 'Non-consensual sexual messages or requests' },
  { code: 'SCAM_OR_FRAUD', label: 'Scam & Financial Fraud', description: 'Asking for money, crypto, gifts, or investment schemes' },
  { code: 'SPAM', label: 'Spam & Bots', description: 'Automated messages, promotional links, or repetitive spam' },
  { code: 'IMPERSONATION', label: 'Impersonation', description: 'Pretending to be someone else or using someone else’s photos' },
  { code: 'FAKE_PROFILE', label: 'Fake Profile', description: 'Fraudulent profile, stolen images, or AI-generated persona' },
  { code: 'MINOR_SAFETY_CONCERN', label: 'Minor / Underage Concern', description: 'Suspected user under the age of 18 or child safety issue' },
  { code: 'SELF_HARM_CONCERN', label: 'Self-Harm / Suicide Concern', description: 'User expressing intent or depicting self-harm' },
  { code: 'VIOLENCE_OR_DANGER', label: 'Violence or Physical Danger', description: 'Physical safety threats or dangerous offline encounters' },
  { code: 'OFF_PLATFORM_PAYMENT_SCAM', label: 'Off-Platform Payment Scam', description: 'Demanding payments via external cash apps or services' },
  { code: 'INAPPROPRIATE_CONTENT', label: 'Inappropriate Content', description: 'Offensive, vulgar, or inappropriate profile or message' },
  { code: 'OTHER', label: 'Other Safety Concern', description: 'Any other safety or trust issue not listed above' },
];

export const ReportModal: React.FC<ReportModalProps> = ({
  visible,
  targetType,
  targetId,
  targetName,
  onClose,
  onSubmit,
}) => {
  const [selectedReason, setSelectedReason] = useState<ReportReasonCode | null>(null);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleReset = () => {
    setSelectedReason(null);
    setNotes('');
    setIsSubmitting(false);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!selectedReason) {
      Alert.alert('Selection Required', 'Please select a reason for reporting.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit({
        targetType,
        targetId,
        reasonCode: selectedReason,
        notes: notes.trim() || undefined,
      });
      Alert.alert('Report Received', 'Thank you for helping keep our community safe. Our trust & safety team will review this report promptly.', [
        { text: 'OK', onPress: handleClose },
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit report';
      Alert.alert('Report Error', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
      testID="report-modal"
    >
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          <View style={styles.handleBar} />

          <View style={styles.header}>
            <Text style={styles.title}>Report {targetName || targetType.toLowerCase()}</Text>
            <Text style={styles.subtitle}>
              Your report is confidential. The reported user will not know who filed this report.
            </Text>
          </View>

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            <Text style={styles.sectionLabel}>SELECT A REASON</Text>
            {REPORT_REASONS.map((reason) => {
              const isSelected = selectedReason === reason.code;
              return (
                <TouchableOpacity
                  key={reason.code}
                  style={[styles.reasonRow, isSelected && styles.reasonRowSelected]}
                  onPress={() => setSelectedReason(reason.code)}
                  activeOpacity={0.7}
                  testID={`report-reason-${reason.code}`}
                >
                  <View style={styles.reasonTextContainer}>
                    <Text style={[styles.reasonLabel, isSelected && styles.reasonLabelSelected]}>
                      {reason.label}
                    </Text>
                    <Text style={styles.reasonDescription}>{reason.description}</Text>
                  </View>
                  <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                    {isSelected && <View style={styles.radioInner} />}
                  </View>
                </TouchableOpacity>
              );
            })}

            <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>
              ADDITIONAL DETAILS (OPTIONAL)
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder="Provide any additional context to assist our review..."
              placeholderTextColor={colors.neutral[400]}
              multiline
              numberOfLines={4}
              maxLength={1000}
              value={notes}
              onChangeText={setNotes}
              testID="report-notes-input"
            />
          </ScrollView>

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleClose}
              disabled={isSubmitting}
              testID="report-cancel-btn"
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.submitButton,
                (!selectedReason || isSubmitting) && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!selectedReason || isSubmitting}
              testID="report-submit-btn"
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.submitButtonText}>Submit Report</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingBottom: spacing.lg,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: colors.neutral[200],
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.neutral[900],
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 13,
    color: colors.neutral[700],
    lineHeight: 18,
  },
  scrollArea: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.neutral[400],
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
    marginVertical: 3,
    backgroundColor: colors.neutral[50],
    borderWidth: 1,
    borderColor: 'transparent',
  },
  reasonRowSelected: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
  },
  reasonTextContainer: {
    flex: 1,
    marginRight: spacing.sm,
  },
  reasonLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[800],
  },
  reasonLabelSelected: {
    color: '#1d4ed8',
  },
  reasonDescription: {
    fontSize: 12,
    color: colors.neutral[400],
    marginTop: 2,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.neutral[400],
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: '#3b82f6',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3b82f6',
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: 10,
    padding: spacing.sm,
    fontSize: 14,
    color: colors.neutral[900],
    backgroundColor: colors.neutral[50],
    textAlignVertical: 'top',
    minHeight: 80,
    marginBottom: spacing.md,
  },
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral[100],
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.neutral[700],
  },
  submitButton: {
    flex: 2,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dc2626',
  },
  submitButtonDisabled: {
    backgroundColor: colors.neutral[200],
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
});
