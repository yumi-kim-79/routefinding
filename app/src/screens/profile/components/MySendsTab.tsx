/**
 * 내 완등 탭 — 마이페이지. v2.2.0 신규 (2026-09-07).
 *
 * ⚠️ 등반일지 탭과 다르다. 일지는 **하루** 단위, 완등은 **루트** 단위다
 *    (types/send.ts 머리말). 둘 다 있어야 한다 — 합치면 통계를 못 만든다.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Text } from '../../../components/common/Text';
import { useTheme } from '../../../theme';
import { useAuthStore } from '../../../stores/authStore';
import { subscribeMySends } from '../../../services/sendService';
import { STYLE_LABEL, type Send } from '../../../types/send';
import type { MainStackParamList } from '../../../navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

function dateLabel(ts?: { toDate: () => Date }): string {
  if (!ts?.toDate) {
    return '';
  }
  const d = ts.toDate();
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * 난이도 정렬용 점수.
 * ⚠️ 랭킹 점수(6순위)와는 다르다. 여기서는 **최고 난이도를 고르기 위한 비교**에만 쓴다.
 */
function gradeRank(g: string): number {
  const lead = /^5\.(\d+)([a-d])?/.exec(g);
  if (lead) {
    return Number(lead[1]) * 4 + (lead[2] ? lead[2].charCodeAt(0) - 96 : 0);
  }
  const v = /^V(\d+)/.exec(g);
  return v ? 100 + Number(v[1]) : -1;
}

export const MySendsTab: React.FC = () => {
  const { colors, radius } = useTheme();
  const navigation = useNavigation<Nav>();
  const uid = useAuthStore((s) => s.user?.uid);

  const [list, setList] = useState<Send[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!uid) {
      setList([]);
      return;
    }
    return subscribeMySends(uid, setList, setError);
  }, [uid]);

  const best = useMemo(() => {
    let top = '';
    (list ?? []).forEach((s) => {
      if (s.difficulty && gradeRank(s.difficulty) > gradeRank(top)) {
        top = s.difficulty;
      }
    });
    return top;
  }, [list]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text variant="body" color="error" style={styles.centerText}>
          완등 기록을 불러오지 못했습니다.{'\n'}
          {error}
        </Text>
        <Text variant="caption" color="disabled" style={styles.centerText}>
          ⚠️ 복합 색인(uid + climbedAt)이 배포되지 않았을 수 있습니다.
        </Text>
      </View>
    );
  }

  if (list === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <FlatList
      data={list}
      keyExtractor={(s) => s.id}
      contentContainerStyle={styles.pad}
      ListHeaderComponent={
        <View style={[styles.stats, { borderColor: colors.border, borderRadius: radius.md }]}>
          <View style={styles.stat}>
            <Text variant="title">{list.length}</Text>
            <Text variant="caption" color="textSecondary">
              완등
            </Text>
          </View>
          <View style={styles.stat}>
            <Text variant="title">{best || '-'}</Text>
            <Text variant="caption" color="textSecondary">
              최고 난이도
            </Text>
          </View>
          <View style={styles.stat}>
            <Text variant="title">
              {new Set(list.map((s) => s.mountain).filter(Boolean)).size}
            </Text>
            <Text variant="caption" color="textSecondary">
              다녀온 등반지
            </Text>
          </View>
        </View>
      }
      ListEmptyComponent={
        <Text variant="body" color="textSecondary" style={styles.centerText}>
          아직 완등 기록이 없습니다.{'\n'}개념도에서 '완등 기록하기'를 눌러 남겨 보세요.
        </Text>
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() =>
            navigation.navigate('ConceptDetail', {
              conceptId: item.conceptId,
              source: item.conceptSource,
            })
          }
          style={[styles.row, { borderBottomColor: colors.divider }]}
        >
          <View style={styles.body}>
            <Text variant="body" numberOfLines={1}>
              {item.routeName || '이름 없음'}
              {item.difficulty ? ` · ${item.difficulty}` : ''}
            </Text>
            <Text variant="caption" color="textSecondary">
              {[item.mountain, item.zone].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <View style={styles.meta}>
            <Text variant="caption" color="primary">
              {STYLE_LABEL[item.style]}
            </Text>
            <Text variant="caption" color="disabled">
              {dateLabel(item.climbedAt)}
            </Text>
          </View>
        </Pressable>
      )}
    />
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, rowGap: 8 },
  centerText: { textAlign: 'center', padding: 16 },
  pad: { paddingBottom: 24 },
  stats: { flexDirection: 'row', borderWidth: 1, margin: 16, paddingVertical: 14 },
  stat: { flex: 1, alignItems: 'center', rowGap: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  body: { flex: 1, rowGap: 2 },
  meta: { alignItems: 'flex-end', rowGap: 2 },
});
