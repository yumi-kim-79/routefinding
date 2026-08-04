/**
 * 등반일지 카드 (목록 1건).
 * 날짜 · 장소 / 루트명 / 장비·시간·참석자 / 내용.
 */
import React from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../../components/common/Text';
import { useTheme } from '../../../theme';
import { logDateLabel, type ClimbingLog } from '../../../types/climbingLog';

interface ClimbingLogCardProps {
  log: ClimbingLog;
  onEdit: (log: ClimbingLog) => void;
  onDelete: (log: ClimbingLog) => void;
}

export const ClimbingLogCard: React.FC<ClimbingLogCardProps> = ({
  log,
  onEdit,
  onDelete,
}) => {
  const { colors, radius, spacing } = useTheme();

  const meta = [
    log.duration ? `⏱ ${log.duration}` : null,
    log.gear ? `🎒 ${log.gear}` : null,
    log.partners ? `👥 ${log.partners}` : null,
  ].filter(Boolean) as string[];

  const confirmDelete = () => {
    Alert.alert('삭제 확인', '이 등반일지를 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => onDelete(log) },
    ]);
  };

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onEdit(log)}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.divider,
          borderRadius: radius.md,
          padding: spacing.md,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.head}>
        <Text variant="label" color="primary">
          {logDateLabel(log)}
        </Text>
        <Text variant="title" numberOfLines={1} style={styles.place}>
          {log.place}
        </Text>
        <Pressable onPress={confirmDelete} hitSlop={8}>
          <Text variant="label" color="error">
            삭제
          </Text>
        </Pressable>
      </View>

      {log.routeName ? (
        <Text variant="body" style={styles.route}>
          {log.routeName}
        </Text>
      ) : null}

      {meta.length > 0 ? (
        <Text variant="caption" color="textSecondary" style={styles.meta}>
          {meta.join('   ')}
        </Text>
      ) : null}

      {log.notes ? (
        <Text
          variant="caption"
          color="textSecondary"
          style={[styles.notes, { borderTopColor: colors.divider }]}
        >
          {log.notes}
        </Text>
      ) : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: { borderWidth: 1, marginBottom: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  place: { flex: 1 },
  route: { marginTop: 6 },
  meta: { marginTop: 6 },
  notes: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, lineHeight: 18 },
});
