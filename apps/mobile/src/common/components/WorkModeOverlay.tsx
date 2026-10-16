import React from 'react';
import {
  Modal,
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Text } from '../../design/primitives/Text.js';
import { Icon } from '../../design/primitives/Icon.js';

export interface WorkModeOverlayProps {
  readonly visible: boolean;
  readonly onClose: () => void;
}

interface SpreadsheetRow {
  readonly id: string;
  readonly code: string;
  readonly initiative: string;
  readonly owner: string;
  readonly target: string;
  readonly actual: string;
  readonly status: 'On Track' | 'In Review' | 'Complete' | 'Delayed';
}

const ROWS: readonly SpreadsheetRow[] = [
  {
    id: '1',
    code: 'INF-102',
    initiative: 'Global Edge Cache & Latency Optimization',
    owner: 'Infra Core',
    target: '< 45ms',
    actual: '38ms',
    status: 'Complete',
  },
  {
    id: '2',
    code: 'SEC-204',
    initiative: 'SOC-2 Type II Annual Recertification',
    owner: 'Trust & Sec',
    target: '100%',
    actual: '94%',
    status: 'In Review',
  },
  {
    id: '3',
    code: 'DAT-308',
    initiative: 'Cross-Region Replication Failover Drills',
    owner: 'Platform Eng',
    target: '99.99%',
    actual: '99.99%',
    status: 'On Track',
  },
  {
    id: '4',
    code: 'BI-412',
    initiative: 'Cohort Retention & LTV Attribution v4',
    owner: 'Growth Ops',
    target: '+18.5%',
    actual: '+19.2%',
    status: 'Complete',
  },
  {
    id: '5',
    code: 'API-519',
    initiative: 'Zero-Copy Serialization Benchmark Suite',
    owner: 'Backend Team',
    target: 'p99 < 12ms',
    actual: '14.1ms',
    status: 'On Track',
  },
  {
    id: '6',
    code: 'FIN-601',
    initiative: 'Q4 Budget Variance vs Realized EBITDA',
    owner: 'FP&A',
    target: '< 2.5%',
    actual: '1.8%',
    status: 'Complete',
  },
];

export const WorkModeOverlay: React.FC<WorkModeOverlayProps> = ({ visible, onClose }) => {
  return (
    <Modal visible={visible} animationType="fade" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        {/* Disguise Corporate Toolbar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Exit Work Mode"
          >
            <Icon name="close" size={18} color="#475569" />
          </TouchableOpacity>
          <View style={styles.fileMeta}>
            <Text level="title" style={styles.fileName}>
              FY26_Operational_Review_Master.xlsx
            </Text>
            <Text level="caption" style={styles.syncStatus}>
              Cloud Synced • Auto-Save On • Read-Only Mode
            </Text>
          </View>
        </View>

        {/* Menu Bar Disguise */}
        <View style={styles.menuBar}>
          {['File', 'Edit', 'View', 'Insert', 'Format', 'Data', 'Tools', 'Extensions'].map((tab) => (
            <Text key={tab} level="caption" style={styles.menuItem}>
              {tab}
            </Text>
          ))}
        </View>

        {/* Formula Bar */}
        <View style={styles.formulaBar}>
          <Text level="caption" style={styles.fxLabel}>
            fx
          </Text>
          <Text level="caption" style={styles.formulaText}>
            =SUMIFS(E2:E7, G2:G7, &quot;Complete&quot;, F2:F7, &quot;&gt;90%&quot;)
          </Text>
        </View>

        {/* Spreadsheet Data Grid */}
        <ScrollView style={styles.gridScroll} horizontal showsHorizontalScrollIndicator>
          <View>
            {/* Header Row */}
            <View style={styles.gridHeaderRow}>
              <View style={[styles.cell, styles.headerCell, { width: 44 }]}>
                <Text level="caption" style={styles.headerCellText}>#</Text>
              </View>
              <View style={[styles.cell, styles.headerCell, { width: 80 }]}>
                <Text level="caption" style={styles.headerCellText}>Code</Text>
              </View>
              <View style={[styles.cell, styles.headerCell, { width: 220 }]}>
                <Text level="caption" style={styles.headerCellText}>Strategic Objective</Text>
              </View>
              <View style={[styles.cell, styles.headerCell, { width: 100 }]}>
                <Text level="caption" style={styles.headerCellText}>Owner</Text>
              </View>
              <View style={[styles.cell, styles.headerCell, { width: 85 }]}>
                <Text level="caption" style={styles.headerCellText}>Target</Text>
              </View>
              <View style={[styles.cell, styles.headerCell, { width: 85 }]}>
                <Text level="caption" style={styles.headerCellText}>Actual</Text>
              </View>
              <View style={[styles.cell, styles.headerCell, { width: 95 }]}>
                <Text level="caption" style={styles.headerCellText}>Status</Text>
              </View>
            </View>

            {/* Rows */}
            {ROWS.map((row, idx) => (
              <View key={row.id} style={[styles.gridRow, idx % 2 === 1 && styles.gridRowAlt]}>
                <View style={[styles.cell, { width: 44, backgroundColor: '#F8FAFC' }]}>
                  <Text level="caption" style={styles.rowNumberText}>{idx + 1}</Text>
                </View>
                <View style={[styles.cell, { width: 80 }]}>
                  <Text level="caption" style={{ fontWeight: '600', color: '#1E293B' }}>{row.code}</Text>
                </View>
                <View style={[styles.cell, { width: 220 }]}>
                  <Text level="caption" numberOfLines={1} style={{ color: '#334155' }}>
                    {row.initiative}
                  </Text>
                </View>
                <View style={[styles.cell, { width: 100 }]}>
                  <Text level="caption" style={{ color: '#475569' }}>{row.owner}</Text>
                </View>
                <View style={[styles.cell, { width: 85 }]}>
                  <Text level="caption" style={{ color: '#475569' }}>{row.target}</Text>
                </View>
                <View style={[styles.cell, { width: 85 }]}>
                  <Text level="caption" style={{ fontWeight: '600', color: '#0F172A' }}>{row.actual}</Text>
                </View>
                <View style={[styles.cell, { width: 95 }]}>
                  <View
                    style={[
                      styles.statusPill,
                      row.status === 'Complete' && styles.statusComplete,
                      row.status === 'On Track' && styles.statusOnTrack,
                      row.status === 'In Review' && styles.statusInReview,
                    ]}
                  >
                    <Text level="caption" style={styles.statusText}>{row.status}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Footer Sheet tabs */}
        <View style={styles.sheetBar}>
          <View style={styles.sheetTabActive}>
            <Text level="caption" style={styles.sheetTabTextActive}>Q4_Actuals</Text>
          </View>
          <View style={styles.sheetTab}>
            <Text level="caption" style={styles.sheetTabText}>P&L_Forecast</Text>
          </View>
          <View style={styles.sheetTab}>
            <Text level="caption" style={styles.sheetTabText}>Team_Capacity</Text>
          </View>
          <TouchableOpacity style={styles.unmaskBtn} onPress={onClose}>
            <Text level="caption" style={{ color: '#94A3B8', fontSize: 11 }}>Tap to exit disguise</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  backButton: {
    padding: 6,
    marginRight: 8,
  },
  fileMeta: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  syncStatus: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  menuBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F1F5F9',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  menuItem: {
    fontSize: 12,
    color: '#475569',
  },
  formulaBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#CBD5E1',
    gap: 8,
  },
  fxLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#64748B',
    fontStyle: 'italic',
  },
  formulaText: {
    fontSize: 12,
    fontFamily: 'Courier',
    color: '#1E293B',
  },
  gridScroll: {
    flex: 1,
  },
  gridHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderBottomWidth: 1,
    borderBottomColor: '#CBD5E1',
  },
  gridRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  gridRowAlt: {
    backgroundColor: '#F8FAFC',
  },
  cell: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
  },
  headerCell: {
    borderRightColor: '#CBD5E1',
    paddingVertical: 6,
  },
  headerCellText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  rowNumberText: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
  },
  statusPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  statusComplete: {
    backgroundColor: '#DCFCE7',
  },
  statusOnTrack: {
    backgroundColor: '#E0F2FE',
  },
  statusInReview: {
    backgroundColor: '#FEF3C7',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0F172A',
  },
  sheetBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#F1F5F9',
    borderTopWidth: 1,
    borderTopColor: '#CBD5E1',
    gap: 6,
  },
  sheetTabActive: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    borderBottomWidth: 2,
    borderBottomColor: '#2563EB',
  },
  sheetTabTextActive: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E293B',
  },
  sheetTab: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sheetTabText: {
    fontSize: 11,
    color: '#64748B',
  },
  unmaskBtn: {
    marginLeft: 'auto',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
});
