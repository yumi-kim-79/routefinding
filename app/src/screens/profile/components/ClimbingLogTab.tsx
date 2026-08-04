/**
 * 등반일지 탭 — v2 신규 (2026-08-04).
 *
 * MY ROUTE 탭을 대체한다(사용자 결정). 즐겨찾기(★, my_routes) 자체는 개념도에 남아 있고,
 * 여기서는 **다녀온 기록**을 날짜별로 쌓는다.
 *
 * 데이터: users/{uid}/climbing_logs 실시간 구독 (climbedAt desc)
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Text } from '../../../components/common/Text';
import { Button } from '../../../components/common/Button';
import { useTheme } from '../../../theme';
import { useMyPage } from '../hooks/useMyPage';
import {
  deleteClimbingLog,
  subscribeClimbingLogs,
} from '../../../services/climbingLogService';
import {
  logSearchIndex,
  type ClimbingLog,
} from '../../../types/climbingLog';
import type { MainStackParamList } from '../../../navigation/types';
import { ClimbingLogCard } from './ClimbingLogCard';

type Nav = NativeStackNavigationProp<MainStackParamList>;

/** Timestamp → 'YYYY-MM-DD' (수정 화면 초기값용) */
function tsToInput(ts?: { toDate: () => Date } | null): string {
  if (!ts) {
    return '';
  }
  const d = ts.toDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const ClimbingLogTab: React.FC = () => {
  const { colors, radius, spacing } = useTheme();
  const navigation = useNavigation<Nav>();
  const { uid } = useMyPage();

  const [logs, setLogs] = useState<ClimbingLog[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  /**
   * 재구독 트리거. Firestore 리스너는 permission-denied로 한 번 끊기면
   * **자동 재시도하지 않는다** (규칙 배포 전에 구독이 걸린 경우 등).
   * → [다시 불러오기]로 명시적으로 되살린다.
   */
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!uid) {
      return;
    }
    setError(null);
    setLogs(null);
    return subscribeClimbingLogs(
      uid,
      (rows) => {
        setLogs(rows);
        setError(null);
      },
      (msg) => {
        setError(msg);
        setLogs([]);
      },
    );
  }, [uid, reloadKey]);

  const filtered = useMemo<ClimbingLog[]>(() => {
    if (!logs) {
      return [];
    }
    const q = keyword.trim().toLowerCase();
    if (!q) {
      return logs;
    }
    return logs.filter((l) => logSearchIndex(l).includes(q));
  }, [logs, keyword]);

  const onEdit = (log: ClimbingLog) => {
    navigation.navigate('ClimbingLogEdit', {
      logId: log.id,
      initial: {
        date: tsToInput(log.climbedAt),
        endDate: tsToInput(log.endedAt),
        place: log.place,
        routeName: log.routeName,
        gear: log.gear,
        duration: log.duration,
        partners: log.partners,
        notes: log.notes,
      },
    });
  };

  const onDelete = async (log: ClimbingLog) => {
    if (!uid) {
      return;
    }
    try {
      await deleteClimbingLog(uid, log.id);
    } catch (e) {
      Alert.alert('오류', `삭제 실패: ${e instanceof Error ? e.message : e}`);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={[styles.toolbar, { paddingHorizontal: spacing.md }]}>
        <TextInput
          value={keyword}
          onChangeText={setKeyword}
          placeholder="장소 · 루트명 · 내용 검색"
          placeholderTextColor={colors.disabled}
          style={[
            styles.search,
            {
              color: colors.textPrimary,
              borderColor: colors.border,
              borderRadius: radius.md,
              backgroundColor: colors.surface,
            },
          ]}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
        <Button
          title="+ 작성"
          size="sm"
          onPress={() => navigation.navigate('ClimbingLogEdit', {})}
        />
      </View>

      {error ? (
        <View style={styles.center}>
          <Text variant="body" color="error" style={styles.centerText}>
            등반일지를 불러오지 못했습니다.
          </Text>
          <Text variant="caption" color="textSecondary" style={styles.centerText}>
            {error}
          </Text>
          <Text variant="caption" color="textSecondary" style={styles.centerText}>
            (firestore.rules 배포가 필요할 수 있습니다)
          </Text>
          <Button
            title="다시 불러오기"
            variant="ghost"
            size="sm"
            onPress={() => setReloadKey((k) => k + 1)}
            style={styles.retry}
          />
        </View>
      ) : logs === null ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(l) => l.id}
          contentContainerStyle={
            filtered.length === 0
              ? styles.emptyContent
              : { padding: spacing.md }
          }
          renderItem={({ item }) => (
            <ClimbingLogCard log={item} onEdit={onEdit} onDelete={onDelete} />
          )}
          ListHeaderComponent={
            filtered.length > 0 ? (
              <Text variant="caption" color="textSecondary" style={styles.count}>
                총 {filtered.length}건
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text variant="body" color="textSecondary" style={styles.centerText}>
                {keyword.trim()
                  ? '검색 결과가 없습니다.'
                  : '아직 등반일지가 없습니다.\n[+ 작성]으로 기록을 남겨보세요.'}
              </Text>
            </View>
          }
          keyboardShouldPersistTaps="handled"
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 8,
    paddingBottom: 4,
  },
  search: {
    flex: 1,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
  },
  count: { marginBottom: 8 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  centerText: { textAlign: 'center' },
  retry: { marginTop: 12 },
  emptyContent: { flexGrow: 1 },
});
