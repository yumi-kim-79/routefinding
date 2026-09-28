/**
 * 완등 기록 입력 시트.
 *
 * ⚠️ 스타일은 **한 줄 칩**이다. 드롭다운으로 만들면 한 번 더 눌러야 해서
 *    기록률이 눈에 띄게 떨어진다 — 이 화면은 "빨리 남기는 것"이 전부다.
 *
 * ⚠️ 난이도가 비어 있는 루트면 **여기서 같이 묻는다.** 등반한 사람이 답하는 것이라
 *    신뢰도가 가장 높다 (개발 계획 0순위 (b)).
 */
import React, { useCallback, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Text } from '../../../components/common/Text';
import { Button } from '../../../components/common/Button';
import { AppIcon } from '../../../components/common/AppIcon';
import { useTheme } from '../../../theme';
import { useKeyboardSpace } from '../../../hooks/useKeyboardSpace';
import { useAuthStore } from '../../../stores/authStore';
import { useUserStore } from '../../../stores/userStore';
import { addSend } from '../../../services/sendService';
import { suggestDifficulty } from '../../../services/difficultyService';
import { clearProjectOnSend } from '../../../services/projectService';
import { conceptDifficulty, type Concept } from '../../../types/concept';
import { gradesFor } from '../../../types/difficultySuggestion';
import {
  SEND_STYLES,
  STYLE_HINT,
  STYLE_LABEL,
  type SendStyle,
} from '../../../types/send';

interface Props {
  visible: boolean;
  concept: Concept;
  onClose: () => void;
  onSaved: () => void;
}

/** 'YYYY-MM-DD' */
function today(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function parseDate(v: string): Date | null {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(v.trim());
  if (!m) {
    return null;
  }
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getFullYear() === Number(m[1]) && d.getDate() === Number(m[3]) ? d : null;
}

export const SendSheet: React.FC<Props> = ({ visible, concept, onClose, onSaved }) => {
  const { colors, radius, spacing } = useTheme();
  const { space: bottomSpace } = useKeyboardSpace();
  const uid = useAuthStore((s) => s.user?.uid);
  const profile = useUserStore((s) => s.profile);

  const [style, setStyle] = useState<SendStyle>('redpoint');
  const [rating, setRating] = useState(0);
  const [date, setDate] = useState(today());
  const [attempts, setAttempts] = useState('');
  const [shoes, setShoes] = useState('');
  const [memo, setMemo] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [grade, setGrade] = useState('');
  const [busy, setBusy] = useState(false);

  const needGrade = conceptDifficulty(concept) === undefined;

  const save = useCallback(async () => {
    if (!uid) {
      Alert.alert('로그인이 필요합니다.');
      return;
    }
    if (!profile) {
      Alert.alert('잠시만요', '프로필을 불러오는 중입니다. 잠시 후 다시 눌러 주세요.');
      return;
    }
    const climbedAt = parseDate(date);
    if (!climbedAt) {
      Alert.alert('날짜를 YYYY-MM-DD 형식으로 입력해 주세요.');
      return;
    }
    setBusy(true);
    try {
      await addSend(
        concept,
        {
          style,
          rating: rating > 0 ? rating : undefined,
          attempts: attempts.trim() ? Number(attempts) : undefined,
          shoes,
          memo,
          climbedAt,
          isPublic,
          difficultySuggestion: grade || undefined,
        },
        { uid, nickname: profile.nickname, photoUrl: profile.photoUrl },
      );

      /*
       * 난이도를 같이 받았으면 제안으로도 남긴다.
       * ⚠️ 여기서 개념도에 바로 쓰지 않는다 — 3명이 모여야 반영된다
       *    (services/difficultyService.ts 머리말).
       */
      if (needGrade && grade) {
        await suggestDifficulty(concept, grade, { uid, nickname: profile.nickname }).catch(
          () => undefined,
        );
      }

      /*
       * 완등했으면 '도전 중'에서 뺀다.
       * ⚠️ 이게 프로젝트 기능의 핵심 쾌감이다 (services/projectService.ts 머리말).
       *    실패해도 완등 기록은 이미 남았으므로 조용히 넘어간다.
       */
      void clearProjectOnSend(uid, concept.id);

      onSaved();
      onClose();
    } catch (e) {
      Alert.alert('기록 실패', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [uid, profile, date, concept, style, rating, attempts, shoes, memo, isPublic, grade, needGrade, onSaved, onClose]);

  const field = {
    borderColor: colors.divider,
    borderRadius: radius.sm,
    color: colors.textPrimary,
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderTopLeftRadius: radius.lg,
              borderTopRightRadius: radius.lg,
              paddingBottom: bottomSpace + spacing.md,
            },
          ]}
        >
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
            <Text variant="title">완등 기록</Text>
            <Text variant="caption" color="textSecondary">
              {concept.routeName}
              {conceptDifficulty(concept) ? ` · ${conceptDifficulty(concept)}` : ''}
            </Text>

            <Text variant="label" style={styles.label}>
              등반일
            </Text>
            <TextInput
              value={date}
              onChangeText={setDate}
              placeholder="2026-09-07"
              placeholderTextColor={colors.disabled}
              keyboardType="numbers-and-punctuation"
              style={[styles.input, field]}
            />

            <Text variant="label" style={styles.label}>
              스타일
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {SEND_STYLES.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => setStyle(s)}
                  style={[
                    styles.chip,
                    {
                      borderRadius: radius.full,
                      borderColor: style === s ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text variant="caption" color={style === s ? 'primary' : 'textSecondary'}>
                    {STYLE_LABEL[s]}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text variant="caption" color="disabled">
              {STYLE_HINT[style]}
            </Text>

            {/* 난이도가 없는 루트에서만 (0순위 (b)) */}
            {needGrade ? (
              <>
                <Text variant="label" style={styles.label}>
                  이 루트 난이도는? (선택)
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {gradesFor(concept.type).map((g) => (
                    <Pressable
                      key={g}
                      onPress={() => setGrade(grade === g ? '' : g)}
                      style={[
                        styles.chip,
                        {
                          borderRadius: radius.full,
                          borderColor: grade === g ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text variant="caption" color={grade === g ? 'primary' : 'textSecondary'}>
                        {g}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            ) : null}

            <Text variant="label" style={styles.label}>
              별점 (선택)
            </Text>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} onPress={() => setRating(rating === n ? 0 : n)} hitSlop={4}>
                  <AppIcon
                    name="star"
                    size={30}
                    filled={n <= rating}
                    color={n <= rating ? colors.primary : colors.disabled}
                  />
                </Pressable>
              ))}
            </View>

            <View style={styles.row}>
              <View style={styles.half}>
                <Text variant="label" style={styles.label}>
                  시도 횟수
                </Text>
                <TextInput
                  value={attempts}
                  onChangeText={setAttempts}
                  placeholder="예) 3"
                  placeholderTextColor={colors.disabled}
                  keyboardType="number-pad"
                  style={[styles.input, field]}
                />
              </View>
              <View style={styles.half}>
                <Text variant="label" style={styles.label}>
                  암벽화
                </Text>
                <TextInput
                  value={shoes}
                  onChangeText={setShoes}
                  placeholder="예) 스카르파 드라고"
                  placeholderTextColor={colors.disabled}
                  style={[styles.input, field]}
                />
              </View>
            </View>

            <Text variant="label" style={styles.label}>
              메모 (선택)
            </Text>
            <TextInput
              value={memo}
              onChangeText={setMemo}
              placeholder="다음 사람에게 도움이 될 한 줄"
              placeholderTextColor={colors.disabled}
              maxLength={300}
              multiline
              style={[styles.input, styles.memo, field]}
            />

            {/* 기본은 공개다. 공개돼야 "이 루트 완등 N명"이 만들어진다 */}
            <Pressable onPress={() => setIsPublic((v) => !v)} style={styles.check} hitSlop={6}>
              <AppIcon
                name="check"
                size={16}
                color={isPublic ? colors.disabled : colors.primary}
              />
              <Text variant="caption" color={isPublic ? 'disabled' : 'textPrimary'}>
                나만 보기 {isPublic ? '(지금은 공개)' : ''}
              </Text>
            </Pressable>

            <View style={styles.actions}>
              <Button title="취소" variant="ghost" onPress={onClose} style={styles.action} />
              <Button
                title="기록하기"
                onPress={() => void save()}
                loading={busy}
                style={styles.action}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '90%' },
  body: { padding: 16, rowGap: 6 },
  label: { marginTop: 10 },
  input: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  memo: { minHeight: 70, textAlignVertical: 'top' },
  chip: { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 7, marginRight: 8 },
  stars: { flexDirection: 'row', columnGap: 6, marginTop: 2 },
  row: { flexDirection: 'row', columnGap: 12 },
  half: { flex: 1 },
  check: { flexDirection: 'row', alignItems: 'center', columnGap: 6, marginTop: 14 },
  actions: { flexDirection: 'row', columnGap: 8, marginTop: 18 },
  action: { flex: 1 },
});
