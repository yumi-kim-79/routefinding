/**
 * 폐쇄 설정 — 관리자만 보인다.
 *
 * ⚠️ 루트 단위와 구역 단위를 **한 화면에서 고르게** 한다.
 *    "이 루트만" 인지 "이 구역 전체" 인지는 같은 순간에 내리는 판단이다.
 *    화면을 나누면 구역 폐쇄를 걸려고 암장 정보까지 찾아 들어가야 한다.
 *
 * ⚠️ 구역 전체를 닫는 것은 영향 범위가 크다(도솔암이면 107개 루트).
 *    그래서 저장 전에 **한 번 더 확인**한다.
 */
import React, { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Text } from '../../../components/common/Text';
import { Button } from '../../../components/common/Button';
import { useTheme } from '../../../theme';
import { setCragClosure, setRouteClosure } from '../../../services/closureService';
import { cragDisplayName } from '../../../types/crag';
import type { Closure } from '../../../types/closure';
import type { Concept } from '../../../types/concept';

type Scope = 'route' | 'crag';

interface Props {
  visible: boolean;
  onClose: () => void;
  concept: Concept;
  /** 지금 걸려 있는 값 — 열 때 폼을 채운다 */
  routeClosure?: Closure;
  cragClosure?: Closure;
  uid: string;
}

export const ClosureAdminSheet: React.FC<Props> = ({
  visible,
  onClose,
  concept,
  routeClosure,
  cragClosure,
  uid,
}) => {
  const { colors, radius, spacing } = useTheme();
  const [scope, setScope] = useState<Scope>('route');
  const [closed, setClosed] = useState(false);
  const [reason, setReason] = useState('');
  const [since, setSince] = useState('');
  const [until, setUntil] = useState('');
  const [saving, setSaving] = useState(false);

  const cragName = cragDisplayName(concept.mountain, concept.zone);

  /** 열 때 / 범위를 바꿀 때 그 범위의 현재 값으로 폼을 채운다 */
  useEffect(() => {
    if (!visible) {
      return;
    }
    const src = scope === 'route' ? routeClosure : cragClosure;
    setClosed(src?.closed === true);
    setReason(src?.reason ?? '');
    setSince(src?.since ?? '');
    setUntil(src?.until ?? '');
  }, [visible, scope, routeClosure, cragClosure]);

  const save = () => {
    const run = () => {
      setSaving(true);
      const input = { closed, reason, since, until };
      const task =
        scope === 'route'
          ? setRouteClosure(concept.source, concept.id, input, uid)
          : setCragClosure(concept.mountain ?? '', concept.zone, input, uid);
      void task
        .then(() => {
          onClose();
        })
        .catch((e: unknown) =>
          Alert.alert('저장 실패', e instanceof Error ? e.message : String(e)),
        )
        .finally(() => setSaving(false));
    };

    // 구역 전체를 **닫을 때만** 한 번 더 묻는다. 해제는 되돌리기 쉬우므로 묻지 않는다.
    if (scope === 'crag' && closed) {
      Alert.alert(
        '구역 전체 폐쇄',
        `"${cragName}" 의 모든 루트에 폐쇄 안내가 표시됩니다.\n계속할까요?`,
        [
          { text: '취소', style: 'cancel' },
          { text: '폐쇄', style: 'destructive', onPress: run },
        ],
      );
      return;
    }
    run();
  };

  const field = {
    color: colors.textPrimary,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: colors.background, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg }]}>
          <ScrollView contentContainerStyle={{ padding: spacing.md }}>
            <Text variant="title">폐쇄 설정</Text>

            {/* 범위 */}
            <Text variant="label" style={styles.label}>
              어디를 닫나요
            </Text>
            <View style={styles.row}>
              {([
                ['route', `이 루트만 (${concept.routeName || '이름 없음'})`],
                ['crag', `구역 전체 (${cragName || '구역 없음'})`],
              ] as const).map(([v, label]) => {
                const active = scope === v;
                return (
                  <Pressable
                    key={v}
                    accessibilityRole="button"
                    onPress={() => setScope(v)}
                    style={[
                      styles.chip,
                      {
                        borderRadius: radius.full,
                        backgroundColor: active ? colors.primary : colors.surfaceVariant,
                      },
                    ]}
                  >
                    <Text variant="label" style={{ color: active ? colors.onPrimary : colors.textSecondary }}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* 켜고 끄기 */}
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: closed }}
              onPress={() => setClosed((v) => !v)}
              style={[styles.toggle, { borderColor: colors.border, borderRadius: radius.md }]}
            >
              <Text variant="body">{closed ? '☑' : '☐'}  지금 폐쇄 상태로 둔다</Text>
            </Pressable>
            <Text variant="caption" color="textSecondary" style={styles.hint}>
              체크를 풀면 안내가 사라집니다. 개념도와 사진은 폐쇄 중에도 그대로 보이고,
              제보·수정·완등 기록도 막지 않습니다.
            </Text>

            <Text variant="label" style={styles.label}>
              안내문
            </Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="예) 사유지 분쟁으로 등반이 금지되었습니다. 진입하지 마세요."
              placeholderTextColor={colors.disabled}
              multiline
              style={[styles.input, styles.multiline, field]}
            />

            <View style={styles.row}>
              <View style={styles.half}>
                <Text variant="label" style={styles.label}>
                  시작일 (선택)
                </Text>
                <TextInput
                  value={since}
                  onChangeText={setSince}
                  placeholder="2026-09-15"
                  placeholderTextColor={colors.disabled}
                  style={[styles.input, field]}
                />
              </View>
              <View style={styles.half}>
                <Text variant="label" style={styles.label}>
                  종료일 (선택)
                </Text>
                <TextInput
                  value={until}
                  onChangeText={setUntil}
                  placeholder="비우면 해제 시까지"
                  placeholderTextColor={colors.disabled}
                  style={[styles.input, field]}
                />
              </View>
            </View>

            <Button
              title={saving ? '저장 중…' : '저장'}
              onPress={save}
              loading={saving}
              disabled={saving}
              size="lg"
              style={{ marginTop: spacing.lg }}
            />
            <Button title="취소" variant="secondary" onPress={onClose} style={{ marginTop: 8 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '88%' },
  label: { marginTop: 16, marginBottom: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 8 },
  half: { flex: 1, minWidth: 120 },
  chip: { paddingHorizontal: 12, paddingVertical: 8 },
  toggle: { borderWidth: 1, padding: 12, marginTop: 16 },
  hint: { marginTop: 6, lineHeight: 18 },
  input: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
});
