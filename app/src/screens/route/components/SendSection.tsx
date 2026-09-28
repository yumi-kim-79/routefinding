/**
 * 개념도 상세의 **완등** 영역 — 요약(별점·완등 수) + 기록 버튼 + 완등한 사람 목록.
 *
 * ⚠️ 완등 버튼을 기존 2×2 '빠른 작업'에 끼워 넣지 않았다.
 *    이 화면에서 **가장 중요한 행동**이 되어야 하므로 사진 바로 아래 큰 버튼으로 뺀다
 *    (개발 계획 §1-2(a)).
 *
 * ⚠️ 평균 별점은 저장된 값이 아니라 `ratingSum / ratingCount` 로 계산한다
 *    (types/send.ts `averageRating` — 동시성 때문에 평균을 저장하지 않는다).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../../components/common/Text';
import { Button } from '../../../components/common/Button';
import { Avatar } from '../../../components/common/Avatar';
import { AppIcon } from '../../../components/common/AppIcon';
import { useTheme } from '../../../theme';
import { useAuthStore } from '../../../stores/authStore';
import { isAdminEmail } from '../../../constants/admin';
import { deleteSend, subscribeSendsOfConcept } from '../../../services/sendService';
import { subscribeProjectIds, toggleProject } from '../../../services/projectService';
import { SendSheet } from './SendSheet';
import { averageRating, STYLE_LABEL, type Send } from '../../../types/send';
import type { Concept } from '../../../types/concept';

interface Props {
  concept: Concept;
  /** 카운터가 바뀌면 상세를 다시 읽는다 */
  onChanged: () => void;
}

function dateLabel(ts?: { toDate: () => Date }): string {
  if (!ts?.toDate) {
    return '';
  }
  const d = ts.toDate();
  return `${String(d.getFullYear()).slice(2)}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

export const SendSection: React.FC<Props> = ({ concept, onChanged }) => {
  const { colors, radius, spacing } = useTheme();
  const uid = useAuthStore((s) => s.user?.uid);
  const isAdmin = isAdminEmail(useAuthStore((s) => s.user?.email));

  const [sends, setSends] = useState<Send[]>([]);
  /*
   * 프로젝트(도전 중) 담기.
   * ⚠️ 즐겨찾기와 다르다 — **붙었는데 아직 못 깬 루트**다.
   *    완등을 기록하면 자동으로 빠진다 (SendSheet).
   */
  const [projectIds, setProjectIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!uid) {
      return;
    }
    return subscribeProjectIds(uid, setProjectIds);
  }, [uid]);
  const [sheet, setSheet] = useState(false);
  const [error, setError] = useState('');

  useEffect(
    () => subscribeSendsOfConcept(concept.id, setSends, setError),
    [concept.id],
  );

  const mine = uid ? sends.find((s) => s.uid === uid) : undefined;
  const avg = averageRating(concept.ratingSum, concept.ratingCount);
  const count = concept.sendCount ?? sends.length;

  const remove = useCallback(
    (s: Send) => {
      Alert.alert('완등 기록 삭제', '이 기록을 지울까요?', [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => {
            void deleteSend(s.id)
              .then(onChanged)
              .catch((e: unknown) =>
                Alert.alert('삭제 실패', e instanceof Error ? e.message : String(e)),
              );
          },
        },
      ]);
    },
    [onChanged],
  );

  return (
    <View style={[styles.wrap, { borderTopColor: colors.divider }]}>
      <View style={styles.summary}>
        {avg !== undefined ? (
          <View style={styles.inline}>
            <AppIcon name="star" size={16} filled color={colors.primary} />
            <Text variant="label">{avg}</Text>
            <Text variant="caption" color="textSecondary">
              ({concept.ratingCount})
            </Text>
          </View>
        ) : null}
        <Text variant="label" color="textSecondary">
          완등 {count}
        </Text>
      </View>

      <View style={[styles.buttons, { marginHorizontal: spacing.md }]}>
        <Button
          title={mine ? '완등 기록 추가' : '완등 기록하기'}
          onPress={() => {
            if (!uid) {
              Alert.alert('로그인이 필요합니다.');
              return;
            }
            setSheet(true);
          }}
          style={styles.grow}
        />
        <Button
          title={projectIds.has(concept.id) ? '도전 중 ✓' : '도전 중 담기'}
          variant="secondary"
          onPress={() => {
            if (!uid) {
              Alert.alert('로그인이 필요합니다.');
              return;
            }
            void toggleProject(uid, concept, projectIds.has(concept.id)).catch((e: unknown) =>
              Alert.alert('실패', e instanceof Error ? e.message : String(e)),
            );
          }}
          style={styles.grow}
        />
      </View>

      {error ? (
        <Text variant="caption" color="error" style={styles.pad}>
          완등 목록을 불러오지 못했습니다.{'\n'}
          {error}
        </Text>
      ) : null}

      {sends.map((s) => (
        <View key={s.id} style={[styles.row, { borderBottomColor: colors.divider }]}>
          <Avatar photoUrl={s.photoUrl} nickname={s.nickname} radius={14} />
          <View style={styles.body}>
            <Text variant="caption" color="textSecondary">
              {s.nickname} · {STYLE_LABEL[s.style]}
              {s.attempts ? ` · ${s.attempts}회 시도` : ''} · {dateLabel(s.climbedAt)}
            </Text>
            {s.memo ? <Text variant="body">{s.memo}</Text> : null}
            {s.shoes ? (
              <Text variant="caption" color="disabled">
                {s.shoes}
              </Text>
            ) : null}
          </View>
          {s.rating ? (
            <View style={[styles.rate, { borderRadius: radius.full, borderColor: colors.border }]}>
              <Text variant="caption" color="primary">
                ★{s.rating}
              </Text>
            </View>
          ) : null}
          {(!!uid && s.uid === uid) || isAdmin ? (
            <Pressable onPress={() => remove(s)} hitSlop={8}>
              <AppIcon name="x" size={14} color={colors.textSecondary} />
            </Pressable>
          ) : null}
        </View>
      ))}

      {sends.length === 0 && !error ? (
        <Text variant="caption" color="disabled" style={styles.pad}>
          아직 완등 기록이 없습니다. 첫 기록을 남겨 보세요.
        </Text>
      ) : null}

      <SendSheet
        visible={sheet}
        concept={concept}
        onClose={() => setSheet(false)}
        onSaved={onChanged}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginTop: 20, paddingTop: 16, borderTopWidth: 1, rowGap: 10 },
  summary: { flexDirection: 'row', alignItems: 'center', columnGap: 14, paddingHorizontal: 16 },
  buttons: { flexDirection: 'row', columnGap: 8 },
  grow: { flex: 1 },
  inline: { flexDirection: 'row', alignItems: 'center', columnGap: 4 },
  pad: { paddingHorizontal: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    columnGap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  body: { flex: 1, rowGap: 2 },
  rate: { borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2 },
});
