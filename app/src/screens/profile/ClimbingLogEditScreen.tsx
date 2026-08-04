/**
 * 등반일지 작성/수정 화면 — v2 신규 (2026-08-04).
 *
 * 입력 항목은 사용자의 기존 스프레드시트와 1:1:
 *   날짜 / 장소 / 루트명 / 소요장비 / 등반 소요시간 / 참석자 / 등반내용 및 특이사항
 *
 * 설계 메모:
 *  · 날짜는 텍스트(YYYY-MM-DD) 입력이다. 네이티브 date picker를 쓰려면 의존성이
 *    하나 더 늘어나는데(@react-native-community/datetimepicker), 오늘 이미
 *    image-picker를 추가했으므로 여기서는 새 의존성 없이 간다. [TBD] 필요 시 교체.
 *  · 종료일은 "2018.05.05~06"처럼 1박 이상 기록이 실제로 있어 별도 필드로 둔다.
 *  · 소요시간은 "9시~16시" 같은 기존 표기를 살리려고 자유 문자열.
 */
import React, { useState } from 'react';
import {
  StyleSheet,
  View,
} from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen } from '../../components/common/Screen';
import { Text } from '../../components/common/Text';
import { Input } from '../../components/common/Input';
import { KeyboardAwareScroll } from '../../components/common/KeyboardAwareScroll';
import { Button } from '../../components/common/Button';
import { useTheme } from '../../theme';
import { useAuthStore } from '../../stores/authStore';
import {
  createClimbingLog,
  updateClimbingLog,
} from '../../services/climbingLogService';
import type { ConceptSource } from '../../types/concept';
import type { MainStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList, 'ClimbingLogEdit'>;
type Rt = RouteProp<MainStackParamList, 'ClimbingLogEdit'>;

/** 'YYYY-MM-DD' → Date (로컬 자정). 형식이 틀리면 null. */
function parseDate(v: string): Date | null {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(v.trim());
  if (!m) {
    return null;
  }
  const [, y, mo, d] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d));
  // 2026-02-31 같은 값 걸러내기
  if (
    date.getFullYear() !== Number(y) ||
    date.getMonth() !== Number(mo) - 1 ||
    date.getDate() !== Number(d)
  ) {
    return null;
  }
  return date;
}

function todayInput(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const ClimbingLogEditScreen: React.FC = () => {
  const { spacing } = useTheme();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const uid = useAuthStore((s) => s.user?.uid);

  const initial = params?.initial;
  const isEdit = !!params?.logId;

  const [date, setDate] = useState(initial?.date || todayInput());
  const [endDate, setEndDate] = useState(initial?.endDate ?? '');
  const [place, setPlace] = useState(initial?.place ?? '');
  const [routeName, setRouteName] = useState(initial?.routeName ?? '');
  const [gear, setGear] = useState(initial?.gear ?? '');
  const [duration, setDuration] = useState(initial?.duration ?? '');
  const [partners, setPartners] = useState(initial?.partners ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSave = async () => {
    setError(null);

    const climbedAt = parseDate(date);
    if (!climbedAt) {
      setError('날짜를 YYYY-MM-DD 형식으로 입력해 주세요. (예: 2026-08-04)');
      return;
    }
    if (endDate.trim() && !parseDate(endDate)) {
      setError('종료일 형식이 올바르지 않습니다. (예: 2026-08-05)');
      return;
    }
    if (!place.trim()) {
      setError('장소를 입력해 주세요.');
      return;
    }
    if (!uid) {
      setError('로그인이 필요합니다.');
      return;
    }

    const input = {
      climbedAt,
      endedAt: endDate.trim() ? parseDate(endDate) : null,
      place,
      routeName,
      gear,
      duration,
      partners,
      notes,
      conceptId: initial?.conceptId,
      conceptSource: initial?.conceptSource as ConceptSource | '' | undefined,
    };

    setSaving(true);
    try {
      if (isEdit && params?.logId) {
        await updateClimbingLog(uid, params.logId, input);
      } else {
        await createClimbingLog(uid, input);
      }
      navigation.goBack();
    } catch (e) {
      setError(
        `저장 실패: ${e instanceof Error ? e.message : e}\n(firestore.rules 배포가 필요할 수 있습니다)`,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen padded={false}>
      <KeyboardAwareScroll contentContainerStyle={{ padding: spacing.md }}>
          <Text variant="headline" style={styles.heading}>
            {isEdit ? '등반일지 수정' : '등반일지 작성'}
          </Text>

          <Input
            label="날짜 *"
            value={date}
            onChangeText={setDate}
            placeholder="2026-08-04"
            keyboardType="numbers-and-punctuation"
          />
          <Input
            label="종료일 (여러 날이면)"
            value={endDate}
            onChangeText={setEndDate}
            placeholder="2026-08-05"
            keyboardType="numbers-and-punctuation"
          />
          <Input
            label="장소 *"
            value={place}
            onChangeText={setPlace}
            placeholder="예) 북한산 노적봉"
          />
          <Input
            label="루트명"
            value={routeName}
            onChangeText={setRouteName}
            placeholder="예) 불장난길 4피치 / 부활의 꿈길 2피치"
            multiline
          />
          <Input
            label="소요장비"
            value={gear}
            onChangeText={setGear}
            placeholder="예) 퀵드로 12개, 캠1셋트"
          />
          <Input
            label="등반 소요시간"
            value={duration}
            onChangeText={setDuration}
            placeholder="예) 9시~16시"
          />
          <Input
            label="참석자"
            value={partners}
            onChangeText={setPartners}
            placeholder="함께 등반한 사람"
          />
          <Input
            label="등반내용 및 특이사항"
            value={notes}
            onChangeText={setNotes}
            placeholder="예) 첫 멀티등반 정상등반 완료"
            multiline
          />

          {error ? (
            <Text variant="caption" color="error" style={styles.error}>
              {error}
            </Text>
          ) : null}

          <View style={styles.actions}>
            <Button
              title="취소"
              variant="ghost"
              onPress={() => navigation.goBack()}
              disabled={saving}
              style={styles.action}
            />
            <Button
              title="저장"
              onPress={onSave}
              loading={saving}
              style={styles.action}
            />
          </View>
      </KeyboardAwareScroll>
    </Screen>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  heading: { marginBottom: 16 },
  error: { marginBottom: 12 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  action: { flex: 1 },
});
