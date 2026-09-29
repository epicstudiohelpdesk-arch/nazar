import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import type { PaymentTransactionResponseDto } from '@platform/api-contracts';
import type { BillingApiClient } from './billing-api.js';

export interface BillingHistoryScreenProps {
  readonly client: BillingApiClient;
}

export function BillingHistoryScreen({ client }: BillingHistoryScreenProps) {
  const router = useRouter();
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
    loadTransactions(true);
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

    return (
      <View style={styles.transactionCard} testID={`transaction-item-${item.id}`}>
        <View style={styles.cardHeader}>
          <Text style={styles.productCode}>{item.productCode}</Text>
          <Text style={styles.amount}>{formattedAmount}</Text>
        </View>
        <View style={styles.cardFooter}>
          <Text style={styles.date}>{dateStr}</Text>
          <View
            style={[
              styles.statusBadge,
              isSuccess ? styles.successBadge : isRefund ? styles.refundBadge : styles.failedBadge,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                isSuccess ? styles.successText : isRefund ? styles.refundText : styles.failedText,
              ]}
            >
              {item.status}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Billing History</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      {isLoading && transactions.length === 0 ? (
        <View style={styles.centerContainer} testID="history-loading">
          <ActivityIndicator size="large" color="#E11D48" />
        </View>
      ) : (
        <FlatList
          data={transactions}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => loadTransactions(true)}
              tintColor="#E11D48"
            />
          }
          onEndReached={() => {
            if (hasMore && !isLoading && !isRefreshing) {
              loadTransactions(false);
            }
          }}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <View style={styles.emptyContainer} testID="history-empty">
              <Text style={styles.emptyTitle}>No Transactions Yet</Text>
              <Text style={styles.emptySubtitle}>
                Purchases and membership renewals will appear here.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  backButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  backButtonText: {
    color: '#38BDF8',
    fontSize: 15,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  headerPlaceholder: {
    width: 48,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  transactionCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  productCode: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F1F5F9',
  },
  amount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  date: {
    fontSize: 13,
    color: '#94A3B8',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  successBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  successText: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '700',
  },
  refundBadge: {
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
  },
  refundText: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '700',
  },
  failedBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  failedText: {
    color: '#F87171',
    fontSize: 11,
    fontWeight: '700',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },
});
