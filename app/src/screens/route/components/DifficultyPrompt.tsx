/**
 * "난이도를 알려주세요" — 난이도가 비어 있는 루트에만 뜨는 카드.
 *
 * ⚠️ 왜 이게 개념도 상세 맨 위 가까이 있어야 하나 (2026-09-07 실측):
 *    **리드 루트의 97%에 난이도가 없다.** 난이도는 클라이머가 루트를 고르는 첫 기준이고,
 *    없으면 완등 기록을 남겨도 랭킹 점수를 매길 수 없다.
 *    관리자 혼자 5천 개를 채우는 것은 불가능하므로, **본 사람이 그 자리에서 알려주게** 한다.
 *
 * ⚠️ 한 사람의 입력이 바로 정답이 되지 않는다. 같은 값이 3명 모여야 반영된다
 *    (services/difficultyService.ts · Cloud Function `applyDifficultySuggestion`).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../../components/common/Text';
import { useTheme } from '../../../theme';
import { useAuthStore } from '../../../stores/authStore';
import { useUserStore } from '../../../stores/userStore';
import { isAdminEmail } from '../../../constants/admin';
import {
  setDifficulty,
  subscribeSuggestions,
  suggestDifficulty,
  topSuggestion,
} from '../../../services/difficultyService';
import {
  DIFFICULTY_AGREE_THRESHOLD,
  gradesFor,
  type DifficultySuggestion,
} from '../../../types/difficultySuggestion';
import type { Concept } from '../../../types/concept';

interface Props {
  concept: Concept;
  /** 반영되면 화면을 다시 읽게 알린다 */
  onApplied?: () => void;
}

export const DifficultyPrompt: React.FC<Props> = ({ concept, onApplied }) => {
  const { colors, radius, spacing } = useTheme();
  const uid = useAuthStore((s) => s.user?.uid);
  const isAdmin = isAdminEmail(useAuthStore((s) => s.user?.email));
  const profile = useUserStore((s) => s.profile);

  const [list, setList] = useState<DifficultySuggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => subscribeSuggestions(concept.id, setList), [concept.id]);

  const mine = uid ? list.find((s) => s.uid === uid) : undefined;
  const top = topSuggestion(list);

  const pick = useCallback(
    async (grade: string) => {
      if (!uid) {
        Alert.alert('로그인이 필요합니다.');
        return;
      }
      setBusy(true);
      try {
        if (isAdmin) {
          // 관리자는 바로 반영한다 — 기다릴 이유가 없다
          await setDifficulty(concept, grade);
          onApplied?.();
          Alert.alert('반영했습니다', `난이도 ${grade}`);
        } else {
          await suggestDifficulty(concept, grade, {
            uid,
            nickname: profile?.nickname ?? '이름 없음',
          });
          Alert.alert(
            '고맙습니다',
            `${DIFFICULTY_AGREE_THRESHOLD}명이 같은 난이도를 알려주면 자동으로 반영됩니다.`,
          );
        }
        setOpen(false);
      } catch (e) {
        Alert.alert('실패', e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [uid, isAdmin, concept, profile, onApplied],
  );

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surfaceVariant, borderRadius: radius.md, padding: spacing.md },
      ]}
    >
      <Text variant="label">난이도가 아직 없습니다</Text>
      <Text variant="caption" color="textSecondary">
        {mine
          ? `${mine.value} 로 알려주셨습니다. ${DIFFICULTY_AGREE_THRESHOLD}명이 모이면 반영됩니다.`
          : top
            ? `지금까지 ${top.value} ${top.count}표 (${DIFFICULTY_AGREE_THRESHOLD}표면 반영)`
            : '올라본 적 있다면 알려주세요. 다음 사람이 루트를 고를 때 큰 도움이 됩니다.'}
      </Text>

      {open ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
          {gradesFor(concept.type).map((g) => (
            <Pressable
              key={g}
              disabled={busy}
              onPress={() => void pick(g)}
              style={[
                styles.chip,
                { borderColor: colors.border, borderRadius: radius.full },
              ]}
            >
              <Text variant="caption">{g}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <Pressable onPress={() => setOpen(true)} hitSlop={6} style={styles.link}>
          <Text variant="label" color="primary">
            {isAdmin ? '난이도 입력 (바로 반영)' : mine ? '다시 고르기' : '난이도 알려주기'}
          </Text>
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: { marginHorizontal: 12, marginTop: 12, rowGap: 6 },
  chips: { marginTop: 4 },
  chip: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7, marginRight: 8 },
  link: { paddingTop: 4 },
});
