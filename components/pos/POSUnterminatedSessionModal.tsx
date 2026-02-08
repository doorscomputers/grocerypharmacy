import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { IconButton } from 'react-native-paper';

interface UnterminatedSession {
  date: string;
  transaction_count: number;
  total_sales: number;
}

interface POSUnterminatedSessionModalProps {
  visible: boolean;
  sessions: UnterminatedSession[];
  onDoXReading: () => void;
  onDoZReading: () => void;
}

export default function POSUnterminatedSessionModal({
  visible,
  sessions,
  onDoXReading,
  onDoZReading,
}: POSUnterminatedSessionModalProps) {
  const formatCurrency = (value: number) => {
    return `₱${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-PH', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Get the earliest unterminated date for display
  const earliestDate = sessions.length > 0 ? sessions[0].date : '';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {}}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerIcon}>⚠️</Text>
            <Text style={styles.headerTitle}>Session Not Closed</Text>
          </View>

          {/* Content */}
          <View style={styles.content}>
            <Text style={styles.warningText}>
              You have unterminated sales from previous day(s). Please complete the Z-Reading to close these sessions before starting new sales today.
            </Text>

            {/* Sessions List */}
            <View style={styles.sessionsContainer}>
              <Text style={styles.sessionsTitle}>Pending Sessions:</Text>
              <ScrollView style={styles.sessionsList} nestedScrollEnabled>
                {sessions.map((session, index) => (
                  <View key={session.date} style={styles.sessionItem}>
                    <View style={styles.sessionDateRow}>
                      <Text style={styles.sessionDate}>{formatDate(session.date)}</Text>
                      {index === 0 && (
                        <View style={styles.oldestBadge}>
                          <Text style={styles.oldestBadgeText}>Oldest</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.sessionDetails}>
                      <Text style={styles.sessionDetailText}>
                        {session.transaction_count} transaction{session.transaction_count !== 1 ? 's' : ''}
                      </Text>
                      <Text style={styles.sessionDetailAmount}>
                        {formatCurrency(session.total_sales)}
                      </Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>

            {/* Info Box */}
            <View style={styles.infoBox}>
              <Text style={styles.infoIcon}>ℹ️</Text>
              <Text style={styles.infoText}>
                BIR requires Z-Reading to be generated at the end of each business day.
                This ensures accurate cashier count vs system count.
              </Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.xReadingBtn}
              onPress={onDoXReading}
              activeOpacity={0.7}
            >
              <Text style={styles.xReadingBtnIcon}>📊</Text>
              <View>
                <Text style={styles.xReadingBtnText}>X-Reading</Text>
                <Text style={styles.xReadingBtnSubtext}>(View Only)</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.zReadingBtn}
              onPress={onDoZReading}
              activeOpacity={0.7}
            >
              <Text style={styles.zReadingBtnIcon}>✅</Text>
              <View>
                <Text style={styles.zReadingBtnText}>Z-Reading</Text>
                <Text style={styles.zReadingBtnSubtext}>(Close Day)</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Footer Note */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              You must complete Z-Reading for {formatDate(earliestDate)} to continue.
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#FFF3E0',
    borderBottomWidth: 1,
    borderBottomColor: '#FFE0B2',
  },
  headerIcon: {
    fontSize: 28,
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#E65100',
  },
  content: {
    padding: 20,
  },
  warningText: {
    fontSize: 14,
    color: '#424242',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 16,
  },
  sessionsContainer: {
    backgroundColor: '#FFF8E1',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  sessionsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F57C00',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sessionsList: {
    maxHeight: 150,
  },
  sessionItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FFCC80',
  },
  sessionDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sessionDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E65100',
  },
  oldestBadge: {
    backgroundColor: '#FF5722',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  oldestBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sessionDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sessionDetailText: {
    fontSize: 13,
    color: '#757575',
  },
  sessionDetailAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E7D32',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    alignItems: 'flex-start',
  },
  infoIcon: {
    fontSize: 14,
    marginRight: 8,
    marginTop: 1,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#1565C0',
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    padding: 16,
    paddingTop: 0,
    gap: 12,
  },
  xReadingBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  xReadingBtnIcon: {
    fontSize: 22,
    marginRight: 8,
  },
  xReadingBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#616161',
  },
  xReadingBtnSubtext: {
    fontSize: 11,
    color: '#9E9E9E',
  },
  zReadingBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#FF9800',
    borderWidth: 1,
    borderColor: '#F57C00',
  },
  zReadingBtnIcon: {
    fontSize: 22,
    marginRight: 8,
  },
  zReadingBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  zReadingBtnSubtext: {
    fontSize: 11,
    color: '#FFF3E0',
  },
  footer: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#FFEBEE',
    borderTopWidth: 1,
    borderTopColor: '#FFCDD2',
  },
  footerText: {
    fontSize: 12,
    color: '#C62828',
    textAlign: 'center',
    fontWeight: '500',
  },
});
