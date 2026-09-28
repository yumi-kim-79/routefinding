/**
 * 신고 관리 탭 (관리자 전용) — 마이페이지 ▸ 신고 관리. v2.1.0 신규 (2026-09-07).
 *
 * ⚠️ 이 화면은 **있어야만 하는 화면**이다. Apple 심사지침 1.2 는 UGC 앱에
 *    "신고된 콘텐츠를 24시간 안에 처리하고 게시자를 제재할 수단"을 요구한다.
 *    신고 버튼만 만들고 처리 창구가 없으면 반려된다.
 *
 * ⚠️ 탭 노출은 관리자에게만이지만, 실제 차단은 firestore.rules 가 한다
 *    (`abuse_reports` 의 list 는 isAdmin() 만 통과 — UserMessagesTab 과 같은 구조).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Text } from '../../../components/common/Text';
import { useTheme } from '../../../theme';
import {
  removeReported,
  resolveReport,
  subscribeReports,
  type AbuseReport,
} from '../../../services/moderationService';
import type { MainStackParamList } from '../../../navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;
type Filter = 'todo' | 'all';

function when(ts?: { toDate: () => Date }): string {
  if (!ts?.toDate) {
    return '';
  }
  const d = ts.toDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const TARGET_LABEL: Record<AbuseReport['targetType'], string> = {
  post: '글',
  comment: '댓글',
  user: '사용자',
};

export const AbuseReportsTab: React.FC = () => {
  const { colors, radius } = useTheme();
  const navigation = useNavigation<Nav>();

  const [list, setList] = useState<AbuseReport[] | null>(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('todo');

  useEffect(() => subscribeReports(setList, setError), []);

  const shown = useMemo(
    () => (list ?? []).filter((r) => (filter === 'todo' ? r.status === 'open' : true)),
    [list, filter],
  );

  const openCount = useMemo(
    () => (list ?? []).filter((r) => r.status === 'open').length,
    [list],
  );

  const act = useCallback((r: AbuseReport) => {
    Alert.alert(
      `${TARGET_LABEL[r.targetType]} 신고 처리`,
      `사유: ${r.reason}${r.detail ? `\n${r.detail}` : ''}`,
      [
        {
          text: '콘텐츠 삭제',
          style: 'destructive',
          onPress: () => {
            void removeReported(r).catch((e: unknown) =>
              Alert.alert('삭제 실패', e instanceof Error ? e.message : String(e)),
            );
          },
        },
        {
          text: '문제 없음',
          onPress: () => {
            void resolveReport(r.id, 'ignored').catch(() => undefined);
          },
        },
        { text: '취소', style: 'cancel' },
      ],
    );
  }, []);

  if (error) {
    return (
      <View style={styles.center}>
        <Text variant="body" color="error" style={styles.centerText}>
          신고 목록을 불러오지 못했습니다.{'\n'}
          {error}
        </Text>
      </View>
    );
  }

  if (!list) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <View style={styles.filterRow}>
        {(['todo', 'all'] as Filter[]).map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            style={[
              styles.chip,
              {
                borderRadius: radius.full,
                borderColor: filter === f ? colors.primary : colors.border,
              },
            ]}
          >
            <Text variant="caption" color={filter === f ? 'primary' : 'textSecondary'}>
              {f === 'todo' ? `처리 대기 ${openCount}` : '전체'}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={shown}
        keyExtractor={(r) => r.id}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text variant="body" color="textSecondary">
              {filter === 'todo' ? '처리할 신고가 없습니다.' : '신고가 없습니다.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, { borderColor: colors.border, borderRadius: radius.md }]}>
            <Text variant="caption" color="textSecondary">
              {TARGET_LABEL[item.targetType]} · {when(item.createdAt)}
              {item.status !== 'open'
                ? ` · ${item.status === 'removed' ? '삭제함' : '문제 없음'}`
                : ''}
            </Text>
            <Text variant="label">{item.reason}</Text>
            {item.detail ? <Text variant="body">{item.detail}</Text> : null}

            <View style={styles.btnRow}>
              {/* 신고된 글을 직접 보고 판단할 수 있어야 한다 */}
              {item.targetType !== 'user' ? (
                <Pressable
                  onPress={() =>
                    navigation.navigate('PostDetail', {
                      postId: item.targetType === 'post' ? item.targetId : (item.postId ?? ''),
                    })
                  }
                  hitSlop={6}
                >
                  <Text variant="label" color="primary">
                    내용 보기
                  </Text>
                </Pressable>
              ) : null}
              {item.status === 'open' ? (
                <Pressable onPress={() => act(item)} hitSlop={6}>
                  <Text variant="label" color="error">
                    처리
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        )}
        contentContainerStyle={styles.listPad}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  centerText: { textAlign: 'center' },
  filterRow: { flexDirection: 'row', columnGap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  chip: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  listPad: { paddingHorizontal: 16, paddingBottom: 24, rowGap: 10 },
  card: { borderWidth: 1, padding: 12, rowGap: 4 },
  btnRow: { flexDirection: 'row', columnGap: 16, marginTop: 6 },
});
