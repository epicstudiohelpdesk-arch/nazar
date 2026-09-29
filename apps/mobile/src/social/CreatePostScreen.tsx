import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import type { PostDto, PostVisibility } from '@platform/api-contracts';
import type { SocialApiClient } from './social-api.js';

export interface CreatePostScreenProps {
  readonly client: SocialApiClient;
  readonly communityId?: string;
  readonly onPostCreated?: (post: PostDto) => void;
  readonly onCancel?: () => void;
}

export function CreatePostScreen({
  client,
  communityId,
  onPostCreated,
  onCancel,
}: CreatePostScreenProps) {
  const [content, setContent] = useState<string>('');
  const [visibility, setVisibility] = useState<PostVisibility>('PUBLIC');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handlePublish = async () => {
    if (!content.trim()) {
      Alert.alert('Validation Error', 'Post content cannot be empty');
      return;
    }

    try {
      setIsSubmitting(true);
      const post = await client.createPost({
        content: content.trim(),
        communityId: communityId || null,
        visibility,
      });
      onPostCreated?.(post);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to publish post';
      Alert.alert('Publish Error', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel} disabled={isSubmitting}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Post</Text>
        <TouchableOpacity
          style={[styles.publishButton, !content.trim() && styles.disabledButton]}
          onPress={handlePublish}
          disabled={isSubmitting || !content.trim()}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.publishText}>Post</Text>
          )}
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.input}
        placeholder="What's on your mind?"
        placeholderTextColor="#8E8E93"
        multiline
        autoFocus
        value={content}
        onChangeText={setContent}
        maxLength={2000}
      />

      <View style={styles.visibilityRow}>
        <Text style={styles.visibilityLabel}>Visibility:</Text>
        {(['PUBLIC', 'COMMUNITY', 'FOLLOWERS'] as const).map((vis) => (
          <TouchableOpacity
            key={vis}
            style={[styles.visButton, visibility === vis && styles.visButtonSelected]}
            onPress={() => setVisibility(vis)}
          >
            <Text
              style={[styles.visButtonText, visibility === vis && styles.visButtonTextSelected]}
            >
              {vis}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: 'bold',
  },
  cancelText: {
    color: '#8E8E93',
    fontSize: 16,
  },
  publishButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  disabledButton: {
    opacity: 0.5,
  },
  publishText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  input: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    color: '#1C1C1E',
    textAlignVertical: 'top',
  },
  visibilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
  },
  visibilityLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginRight: 8,
  },
  visButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    marginRight: 6,
  },
  visButtonSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  visButtonText: {
    fontSize: 12,
    color: '#8E8E93',
  },
  visButtonTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
