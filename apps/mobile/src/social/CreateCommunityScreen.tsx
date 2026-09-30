import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import type { CommunityDto, CommunityPrivacy } from '@platform/api-contracts';
import { useTheme } from '../design/theme/index.js';
import { Text } from '../design/primitives/Text.js';
import { Icon } from '../design/primitives/Icon.js';
import { Button } from '../design/components/button/Button.js';
import { TopNavHeader } from '../design/components/navigation/TopNavHeader.js';
import { type SocialApiClient } from './social-api.js';
import { invalidateCommunityLists } from './social-cache.js';
import {
  getMutationErrorMessage,
  getSocialFieldErrors,
  SocialApiError,
  socialRoutes,
} from './social-state.js';
import { trackOnboardingEvent } from '../analytics/onboarding-analytics.js';

export interface CreateCommunityScreenProps {
  readonly client: SocialApiClient;
  readonly onCreated?: (community: CommunityDto) => void;
  readonly onCancel?: () => void;
  /**
   * When set, the form edits this community instead of creating one. The API
   * allows exactly the same fields for `PATCH /v1/communities/:id` and authorises
   * the same OWNER/ADMIN roles, so creation and editing share one form, one set
   * of validation rules, and one error surface.
   */
  readonly editing?: CommunityDto | null;
}

const NAME_MIN = 2;
const NAME_MAX = 100;
const DESCRIPTION_MIN = 2;
const DESCRIPTION_MAX = 1000;
const RULE_MAX_LENGTH = 500;
const MAX_RULES = 10;
const FREE_TIER_COMMUNITY_LIMIT = 3;

const PRIVACY_OPTIONS: readonly {
  key: CommunityPrivacy;
  label: string;
  hint: string;
  icon: 'eye' | 'lock' | 'eyeOff';
}[] = [
  {
    key: 'PUBLIC',
    label: 'Public',
    hint: 'Anyone can find this community and join immediately.',
    icon: 'eye',
  },
  {
    key: 'HIDDEN',
    label: 'Unlisted',
    hint: 'Not shown in discovery, but anyone with a link can join immediately.',
    icon: 'eyeOff',
  },
  {
    key: 'PRIVATE',
    label: 'Approval required',
    hint: 'Hidden from discovery. Members must be approved before they can join.',
    icon: 'lock',
  },
];

/**
 * Community creation and editing form.
 *
 * The API allows up to 3 communities per account before requiring a `PREMIUM`
 * entitlement. That limit is enforced server-side and surfaces as
 * `ENTITLEMENT_REQUIRED`; the form explains it inline instead of guessing the
 * user's remaining quota. The limit applies to creation only, so the entitlement
 * path is not shown while editing.
 */
export const CreateCommunityScreen: React.FC<CreateCommunityScreenProps> = ({
  client,
  onCreated,
  onCancel,
  editing = null,
}) => {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { colors, radii, spacing } = useTheme();

  const isEditing = editing !== null;
  const communityId = editing?.id ?? null;

  const [name, setName] = useState(editing?.name ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [privacy, setPrivacy] = useState<CommunityPrivacy>(editing?.privacy ?? 'PUBLIC');
  const [rules, setRules] = useState<string[]>([...(editing?.rules ?? [])]);
  const [ruleDraft, setRuleDraft] = useState('');

  const createMutation = useMutation({
    mutationFn: () => {
      if (communityId) {
        return client.updateCommunity(communityId, {
          name: name.trim(),
          description: description.trim(),
          privacy,
          // `null` clears the rules; omitting the key would leave them untouched.
          rules: rules.length > 0 ? rules : null,
        });
      }
      trackOnboardingEvent('community_creation_attempted', { privacy });
      return client.createCommunity({
        name: name.trim(),
        description: description.trim(),
        privacy,
        rules: rules.length > 0 ? rules : undefined,
      });
    },
    onSuccess: (community) => {
      invalidateCommunityLists(queryClient, community.id);
      if (communityId) {
        trackOnboardingEvent('community_updated', { communityId: community.id });
      } else {
        // The creator is inserted as the first `ACTIVE` member with the `OWNER`
        // role by the API, so creation is also a join.
        trackOnboardingEvent('community_created', {
          communityId: community.id,
          privacy: community.privacy,
        });
        trackOnboardingEvent('community_joined', {
          communityId: community.id,
          via: 'created',
        });
      }
      onCreated?.(community);
    },
  });

  const fieldErrors = getSocialFieldErrors(createMutation.error);
  // The community limit only applies to creating a new one.
  const premiumRequired =
    !communityId &&
    createMutation.error instanceof SocialApiError &&
    createMutation.error.code === 'ENTITLEMENT_REQUIRED';

  const nameTooShort = name.trim().length > 0 && name.trim().length < NAME_MIN;
  const descriptionTooShort =
    description.trim().length > 0 && description.trim().length < DESCRIPTION_MIN;

  const canSubmit =
    name.trim().length >= NAME_MIN &&
    name.trim().length <= NAME_MAX &&
    description.trim().length >= DESCRIPTION_MIN &&
    description.trim().length <= DESCRIPTION_MAX &&
    !createMutation.isPending;

  const addRule = () => {
    const value = ruleDraft.trim();
    if (!value || rules.length >= MAX_RULES) return;
    setRules((prev) => [...prev, value]);
    setRuleDraft('');
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      testID="create-community-screen"
    >
      <TopNavHeader
        title={isEditing ? 'Edit community' : 'New community'}
        onBack={onCancel}
        rightAction={
          <Button
            label={
              createMutation.isPending
                ? isEditing
                  ? 'Saving'
                  : 'Creating'
                : isEditing
                  ? 'Save'
                  : 'Create'
            }
            size="sm"
            disabled={!canSubmit}
            loading={createMutation.isPending}
            onPress={() => createMutation.mutate()}
            accessibilityHint={
              isEditing
                ? 'Saves your changes to this community'
                : 'Creates this community and makes you its owner'
            }
            testID="create-community-submit"
          />
        }
      />

      <ScrollView
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl * 2 }}
        keyboardShouldPersistTaps="handled"
      >
        <Field
          label="NAME"
          value={name}
          onChangeText={setName}
          placeholder="Book lovers, Trail runners..."
          maxLength={NAME_MAX}
          error={
            fieldErrors.name?.message ??
            (nameTooShort ? `Use at least ${NAME_MIN} characters.` : undefined)
          }
          testID="create-community-name"
        />

        <Field
          label="DESCRIPTION"
          value={description}
          onChangeText={setDescription}
          placeholder="What is this community about?"
          maxLength={DESCRIPTION_MAX}
          multiline
          error={
            fieldErrors.description?.message ??
            (descriptionTooShort ? `Use at least ${DESCRIPTION_MIN} characters.` : undefined)
          }
          testID="create-community-description"
        />

        <View style={{ marginTop: spacing.md }}>
          <Text variant="caption" weight="semibold" color="secondary">
            WHO CAN JOIN
          </Text>
          <View style={{ marginTop: 6, gap: 8 }}>
            {PRIVACY_OPTIONS.map((option) => {
              const isSelected = privacy === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.privacyOption,
                    {
                      borderColor: isSelected ? colors.accent : colors.border,
                      backgroundColor: isSelected ? colors.accentSoft : colors.surface,
                      borderRadius: radii.radiusMD,
                      padding: spacing.md,
                    },
                  ]}
                  onPress={() => setPrivacy(option.key)}
                  activeOpacity={0.7}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={option.label}
                  accessibilityHint={option.hint}
                  testID={`create-community-privacy-${option.key.toLowerCase()}`}
                >
                  <View style={styles.privacyRow}>
                    <Icon
                      name={option.icon}
                      size="sm"
                      color={isSelected ? colors.accentStrong : colors.textSecondary}
                    />
                    <Text
                      variant="bodySmall"
                      weight="semibold"
                      color={isSelected ? 'accent' : 'primary'}
                      style={{ marginLeft: spacing.sm, flex: 1 }}
                    >
                      {option.label}
                    </Text>
                    {isSelected ? (
                      <Icon name="checkCircle" size="sm" color={colors.accent} />
                    ) : null}
                  </View>
                  <Text variant="caption" color="secondary" style={{ marginTop: 2 }}>
                    {option.hint}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={{ marginTop: spacing.lg }}>
          <View style={styles.rulesHeader}>
            <Text variant="caption" weight="semibold" color="secondary">
              RULES (OPTIONAL)
            </Text>
            <Text variant="caption" color="tertiary">
              {rules.length}/{MAX_RULES}
            </Text>
          </View>

          {rules.map((rule, index) => (
            <View
              key={`${index}-${rule.slice(0, 12)}`}
              style={[
                styles.ruleRow,
                {
                  backgroundColor: colors.surfaceMuted,
                  borderRadius: radii.radiusSM,
                  padding: spacing.sm,
                },
              ]}
            >
              <Text variant="bodySmall" style={{ flex: 1 }}>
                {index + 1}. {rule}
              </Text>
              <Button
                label="Remove"
                variant="tertiary"
                size="sm"
                onPress={() => setRules((prev) => prev.filter((_, i) => i !== index))}
                accessibilityLabel={`Remove rule ${index + 1}`}
                testID={`create-community-remove-rule-${index}`}
              />
            </View>
          ))}

          {rules.length < MAX_RULES ? (
            <View style={styles.ruleComposer}>
              <TextInput
                style={[
                  styles.ruleInput,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: radii.radiusMD,
                    color: colors.textPrimary,
                    padding: spacing.sm,
                  },
                ]}
                value={ruleDraft}
                onChangeText={setRuleDraft}
                placeholder="Add a rule"
                placeholderTextColor={colors.textTertiary}
                maxLength={RULE_MAX_LENGTH}
                onSubmitEditing={addRule}
                returnKeyType="done"
                accessibilityLabel="New community rule"
                testID="create-community-rule-input"
              />
              <Button
                label="Add"
                variant="secondary"
                size="sm"
                disabled={!ruleDraft.trim()}
                onPress={addRule}
                accessibilityLabel="Add this rule"
                testID="create-community-add-rule"
              />
            </View>
          ) : null}
        </View>

        {createMutation.isError ? (
          <View
            style={[
              styles.errorBanner,
              {
                backgroundColor: colors.errorSoft,
                borderRadius: radii.radiusSM,
                padding: spacing.md,
                marginTop: spacing.lg,
              },
            ]}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            testID="create-community-error"
          >
            <View style={styles.errorRow}>
              <Icon name="alertCircle" size="sm" color={colors.error} />
              <Text variant="caption" color="error" style={{ marginLeft: 6, flex: 1 }}>
                {getMutationErrorMessage(createMutation.error)}
              </Text>
            </View>
            {premiumRequired ? (
              <>
                <Text
                  variant="caption"
                  color="secondary"
                  style={{ marginTop: spacing.sm }}
                  testID="create-community-limit-note"
                >
                  {`Free accounts can create up to ${FREE_TIER_COMMUNITY_LIMIT} communities.`}
                </Text>
                <Button
                  label="See plans"
                  variant="secondary"
                  size="sm"
                  style={{ marginTop: spacing.sm }}
                  onPress={() => router.push('/billing')}
                  accessibilityHint="Opens plans and billing"
                  testID="create-community-upgrade"
                />
              </>
            ) : null}
          </View>
        ) : null}

        <Button
          label="Cancel"
          variant="tertiary"
          size="sm"
          fullWidth
          style={{ marginTop: spacing.lg }}
          onPress={() => onCancel?.()}
          testID="create-community-cancel"
        />

        <Text variant="caption" color="tertiary" align="center" style={{ marginTop: spacing.md }}>
          {`You will be the owner of ${socialRoutes.communities()}`}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

interface FieldProps {
  readonly label: string;
  readonly value: string;
  readonly onChangeText: (value: string) => void;
  readonly placeholder: string;
  readonly maxLength: number;
  readonly error?: string;
  readonly multiline?: boolean;
  readonly testID?: string;
}

const Field: React.FC<FieldProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  maxLength,
  error,
  multiline,
  testID,
}) => {
  const { colors, radii, spacing } = useTheme();
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text variant="caption" weight="semibold" color="secondary">
        {label}
      </Text>
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: colors.surface,
            borderColor: error ? colors.error : colors.border,
            borderRadius: radii.radiusMD,
            color: colors.textPrimary,
            padding: spacing.md,
            minHeight: multiline ? 96 : 48,
          },
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        maxLength={maxLength}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        accessibilityLabel={label}
        accessibilityState={{ disabled: false }}
        testID={testID}
      />
      <View style={styles.fieldFooter}>
        {error ? (
          <Text variant="caption" color="error" accessibilityRole="alert" style={{ flex: 1 }}>
            {error}
          </Text>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        <Text variant="caption" color="tertiary">
          {value.length}/{maxLength}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  input: {
    marginTop: 6,
    fontSize: 15,
    borderWidth: 1,
  },
  fieldFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  privacyOption: {
    borderWidth: 1,
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rulesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  ruleComposer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  ruleInput: {
    flex: 1,
    fontSize: 14,
    borderWidth: 1,
  },
  errorBanner: {
    borderWidth: 1,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
});
