import React, { useState, useEffect, useCallback } from 'react';
import { View, FlatList, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import type { PaymentTransactionResponseDto } from '@platform/api-contracts';
import { useTheme } from '../design/theme/index.js';
import { Text } from '../design/primitives/Text.js';
import { SurfaceCard } from '../design/primitives/SurfaceCard.js';
import { TopNavHeader } from '../design/components/navigation/TopNavHeader.js';
import { EmptyState } from '../design/components/feedback/EmptyState.js';
import { useResponsiveLayout } from '../design/responsive/index.js';
import type { BillingApiClient } from './billing-api.js';

export interface BillingHistoryScreenProps {
  readonly client: BillingApiClient;
}

export function BillingHistoryScreen({ client }: BillingHistoryScreenProps): React.JSX.Element {
  const router = useRouter();
  const { colors } = useTheme();
  const { maxContentWidth } = useResponsiveLayout();

  const [transactions, setTransactions] = useState<PaymentTransactionResponseDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);

  const loadTransactions = useCallback(
    async (refresh: boolean = false) => {
      try {
        if (refresh) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }

        const cursor = refresh ? undefined : nextCursor || undefined;
        const res = await client.listTransactions(20, cursor);

        if (refresh) {
          setTransactions([...res.transactions]);
        } else {
          setTransactions((prev) => [...prev, ...res.transactions]);
        }

        setNextCursor(res.nextCursor);
        setHasMore(res.hasMore);
      } catch (err: unknown) {
        console.error('Failed to load transaction history:', err);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [client, nextCursor]
  );

  useEffect(() => {
    void loadTransactions(true);
  }, [client]);

  const renderItem = ({ item }: { item: PaymentTransactionResponseDto }) => {
    const formattedAmount =
      item.currency === 'INR'
        ? `₹${(item.amountMinor / 100).toFixed(0)}`
        : `${(item.amountMinor / 100).toFixed(2)} ${item.currency}`;

    const dateStr = new Date(item.createdAt).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    const isSuccess = item.status === 'SUCCEEDED';
    const isRefund = item.status === 'REFUNDED';

    const getProductName = (code: string): string => {
      switch (code) {
        case 'PREMIUM_ANNUAL':
          return 'Nazar Premium Annual';
        case 'PREMIUM_MONTHLY':
          return 'Nazar Premium Monthly';
        case 'BOOST_ONE_TIME':
          return 'Profile Boost (24h)';
        default:
          return code;
      }
    };

    return (
      <SurfaceCard
        elevation="sm"
        style={[
          styles.transactionCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
        testID={`transaction-item-${item.id}`}
      >
        <View style={styles.cardHeader}>
          <Text level="title" weight="bold" color="primary">
            {getProductName(item.productCode)}
          </Text>
          <Text level="title" weight="bold" color="primary">
            {formattedAmount}
          </Text>
        </View>

        <View style={styles.cardFooter}>
          <Text level="bodySmall" color="secondary">
            {dateStr}
          </Text>
          <View
            style={[
              styles.statusBadge,
              isSuccess ? styles.successBadge : isRefund ? styles.refundBadge : styles.failedBadge,
            ]}
          >
            <Text
              level="caption"
              weight="bold"
              style={[
                styles.statusText,
                isSuccess ? styles.successText : isRefund ? styles.refundText : styles.failedText,
              ]}
            >
              {item.status}
            </Text>
          </View>
        </View>
      </SurfaceCard>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TopNavHeader
        title="Billing History"
        leftAction="back"
        onBack={() => router.back()}
        testID="billing-history-header"
      />

      {isLoading && transactions.length === 0 ? (
        <View style={styles.centerContainer} testID="history-loading">
          <ActivityIndicator size="large" color={colors.accent || '#E11D48'} />
        </View>
      ) : (
        <FlatList
          data={transactions}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            { maxWidth: maxContentWidth, width: '100%', alignSelf: 'center' },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => void loadTransactions(true)}
              tintColor={colors.accent || '#E11D48'}
            />
          }
          onEndReached={() => {
            if (hasMore && !isLoading && !isRefreshing) {
              void loadTransactions(false);
            }
          }}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <EmptyState
              title="No Transactions Yet"
              description="Purchases and membership renewals will appear here."
              testID="history-empty"
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  transactionCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  successBadge: {
    backgroundColor: '#DCFCE7',
  },
  refundBadge: {
    backgroundColor: '#FEF3C7',
  },
  failedBadge: {
    backgroundColor: '#FEE2E2',
  },
  statusText: {
    fontSize: 10,
    letterSpacing: 0.5,
  },
  successText: {
    color: '#15803D',
  },
  refundText: {
    color: '#B45309',
  },
  failedText: {
    color: '#B91C1C',
  },
});
