import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SHADOW } from '@/constants/theme';
import { useTranslation } from '@/hooks/useTranslation';
import { Kadan } from '@/types';
import { formatCurrency, formatDate, buildWhatsAppURL } from '@/lib/utils';

interface KadanCardProps {
  kadan: Kadan;
  onMarkPaid: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (kadan: Kadan) => void;
}

export function KadanCard({ kadan, onMarkPaid, onDelete, onEdit }: KadanCardProps) {
  const { t, language } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const handleWhatsApp = () => {
    
    const message = t('kadan.whatsapp_message', {
      name: kadan.customer_name,
      amount: kadan.amount.toString(),
      due_date: formatDate(kadan.due_date, language),
    });
    const url = buildWhatsAppURL(kadan.mobile_number, message);
    Linking.openURL(url).catch(() =>
      Alert.alert('WhatsApp not installed', 'Please install WhatsApp to send reminders.')
    );
  };

  const handleMarkPaid = () => {
    
    onMarkPaid(kadan.id);
  };

  const handleDelete = () => {
    
    Alert.alert(
      t('common.delete'),
      t('kadan.confirm_delete'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: () => onDelete(kadan.id) },
      ]
    );
  };

  const statusColor = {
    pending: '#F59E0B',
    paid: '#22C55E',
    overdue: '#EF4444',
  }[kadan.status];

  return (
    <View style={[styles.card, SHADOW.sm]}>
      <TouchableOpacity
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.8}
        style={styles.header}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {kadan.customer_name.charAt(0).toUpperCase()}
          </Text>
        </View>

        <View style={styles.info}>
          <Text style={styles.name}>{kadan.customer_name}</Text>
          <View style={styles.subInfoRow}>
            <Ionicons name="call-outline" size={12} color="#64748B" />
            <Text style={styles.subInfoText}>{kadan.mobile_number}</Text>
          </View>
          <View style={styles.subInfoRow}>
            <Ionicons name="calendar-outline" size={12} color="#64748B" />
            <Text style={styles.subInfoText}>{formatDate(kadan.due_date, language)}</Text>
          </View>
        </View>

        <View style={styles.right}>
          <Text style={styles.amount}>
            {formatCurrency(kadan.amount)}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '15' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{t(`kadan.status.${kadan.status}`)}</Text>
          </View>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.expandedContent}>
          {kadan.notes ? (
            <View style={styles.notesBox}>
              <Ionicons name="document-text-outline" size={14} color="#64748B" />
              <Text style={styles.notesText}>{kadan.notes}</Text>
            </View>
          ) : null}

          <View style={styles.actions}>
            {kadan.status !== 'paid' && (
              <TouchableOpacity style={styles.actionBtn} onPress={handleMarkPaid}>
                <Ionicons name="checkmark-circle-outline" size={16} color="#22C55E" />
                <Text style={[styles.actionText, { color: '#22C55E' }]}>
                  {t('kadan.mark_paid')}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.actionBtn} onPress={handleWhatsApp}>
              <Ionicons name="logo-whatsapp" size={16} color="#22C55E" />
              <Text style={[styles.actionText, { color: '#22C55E' }]}>WhatsApp</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={16} color="#EF4444" />
              <Text style={[styles.actionText, { color: '#EF4444' }]}>
                {t('common.delete')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  info: { flex: 1, gap: 4 },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  subInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  subInfoText: { 
    fontSize: 12,
    color: '#64748B',
  },
  right: {
    alignItems: 'flex-end',
    gap: 8,
  },
  amount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  expandedContent: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    padding: 16,
    gap: 12,
  },
  notesBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 12,
  },
  notesText: {
    fontSize: 13,
    color: '#475569',
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  actionText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
