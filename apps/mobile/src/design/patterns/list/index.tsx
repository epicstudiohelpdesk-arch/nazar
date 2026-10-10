import React from 'react';
import {
  View,
  FlatList,
  SectionList as RNSectionList,
  StyleSheet,
  type FlatListProps,
  type SectionListProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../../theme/index.js';
import { Heading } from '../../primitives/Heading.js';
import { EmptyState, type EmptyStateType } from '../../components/feedback/EmptyState.js';
import { ErrorState } from '../../components/feedback/ErrorState.js';
import { Spinner, PullToRefresh } from '../../components/feedback/LoadingSkeleton.js';

// --- REFRESHABLE LIST ---
export interface RefreshableListProps<T> extends Omit<FlatListProps<T>, 'refreshControl'> {
  readonly onRefresh?: () => void;
  readonly isRefreshing?: boolean;
  readonly isLoading?: boolean;
  readonly error?: string | null;
  readonly onRetry?: () => void;
  readonly emptyType?: EmptyStateType;
  readonly emptyTitle?: string;
  readonly emptyDescription?: string;
  readonly emptyActionLabel?: string;
  readonly onEmptyAction?: () => void;
}

export const RefreshableList = <T,>({
  data,
  renderItem,
  onRefresh,
  isRefreshing = false,
  isLoading = false,
  error,
  onRetry,
  emptyType = 'generic',
  emptyTitle,
  emptyDescription,
  emptyActionLabel,
  onEmptyAction,
  contentContainerStyle,
  style,
  ...rest
}: RefreshableListProps<T>): React.JSX.Element => {
  const { colors } = useTheme();

  if (isLoading && (!data || data.length === 0)) {
    return (
      <View style={styles.centerContainer}>
        <Spinner size="large" />
      </View>
    );
  }

  if (error && (!data || data.length === 0)) {
    return (
      <View style={styles.centerContainer}>
        <ErrorState type="unknown" message={error} onRetry={onRetry} />
      </View>
    );
  }

  return (
    <FlatList<T>
      data={data}
      renderItem={renderItem}
      style={[{ flex: 1, backgroundColor: colors.background }, style]}
      contentContainerStyle={[
        data && data.length === 0 ? styles.emptyContainer : undefined,
        contentContainerStyle,
      ]}
      refreshControl={
        onRefresh ? <PullToRefresh refreshing={isRefreshing} onRefresh={onRefresh} /> : undefined
      }
      ListEmptyComponent={
        <EmptyState
          type={emptyType}
          title={emptyTitle}
          description={emptyDescription}
          actionLabel={emptyActionLabel}
          onAction={onEmptyAction}
        />
      }
      {...rest}
    />
  );
};

// --- INFINITE LIST ---
export interface InfiniteListProps<T> extends RefreshableListProps<T> {
  readonly onLoadMore?: () => void;
  readonly isFetchingNextPage?: boolean;
  readonly hasNextPage?: boolean;
}

export const InfiniteList = <T,>({
  onLoadMore,
  isFetchingNextPage = false,
  hasNextPage = false,
  ListFooterComponent,
  ...rest
}: InfiniteListProps<T>): React.JSX.Element => {
  const { spacing } = useTheme();

  const handleEndReached = () => {
    if (!isFetchingNextPage && hasNextPage && onLoadMore) {
      onLoadMore();
    }
  };

  const Footer = (
    <View style={{ paddingVertical: spacing.md }}>
      {isFetchingNextPage ? (
        <Spinner size="small" />
      ) : typeof ListFooterComponent === 'function' ? (
        <ListFooterComponent />
      ) : (
        ListFooterComponent
      )}
    </View>
  );

  return (
    <RefreshableList<T>
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.4}
      ListFooterComponent={Footer}
      {...rest}
    />
  );
};

// --- SECTION LIST ---
export interface NazarSectionListProps<ItemT, SectionT = any> extends SectionListProps<
  ItemT,
  SectionT
> {
  readonly onRefresh?: () => void;
  readonly isRefreshing?: boolean;
}

export const SectionList = <ItemT, SectionT = any>({
  sections,
  renderItem,
  renderSectionHeader,
  onRefresh,
  isRefreshing = false,
  style,
  ...rest
}: NazarSectionListProps<ItemT, SectionT>): React.JSX.Element => {
  const { colors } = useTheme();

  return (
    <RNSectionList<ItemT, SectionT>
      sections={sections}
      renderItem={renderItem}
      renderSectionHeader={renderSectionHeader}
      style={[{ flex: 1, backgroundColor: colors.background }, style]}
      refreshControl={
        onRefresh ? <PullToRefresh refreshing={isRefreshing} onRefresh={onRefresh} /> : undefined
      }
      stickySectionHeadersEnabled={true}
      {...rest}
    />
  );
};

// --- LIST SCREEN WRAPPER ---
export interface ListScreenProps {
  readonly title?: string;
  readonly headerSlot?: React.ReactNode;
  readonly children: React.ReactNode;
  readonly style?: StyleProp<ViewStyle>;
}

export const ListScreen: React.FC<ListScreenProps> = ({ title, headerSlot, children, style }) => {
  const { colors, spacing } = useTheme();

  return (
    <View style={[styles.screenContainer, { backgroundColor: colors.background }, style]}>
      {title && (
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md }}>
          <Heading level="h1">{title}</Heading>
        </View>
      )}
      {headerSlot}
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  screenContainer: {
    flex: 1,
  },
});
