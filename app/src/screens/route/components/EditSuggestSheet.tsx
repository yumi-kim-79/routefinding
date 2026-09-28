/**
 * 정보 수정 제안 시트 — "이 정보가 틀렸어요".
 *
 * ⚠️ **본인이 올린 제보면 제안이 아니라 바로 반영된다** (services/editSuggestionService.ts).
 * ⚠️ 바꾸지 않은 칸은 보내지 않는다. 전부 보내면 관리자가 뭘 바꿨는지 알 수 없다.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Text } from '../../../components/common/Text';
import { Button } from '../../../components/common/Button';
import { useTheme } from '../../../theme';
import { useKeyboardSpace } from '../../../hooks/useKeyboardSpace';
import { useAuthStore } from '../../../stores/authStore';
import { useUserStore } from '../../../stores/userStore';
import { applyDirect, submitSuggestion } from '../../../services/editSuggestionService';
import { EDITABLE_FIELDS, type EditableField } from '../../../types/editSuggestion';
import { conceptDifficulty, type Concept } from '../../../types/concept';

interface Props {
  visible: boolean;
  concept: Concept;
  onClose: () => void;
  onApplied: () => void;
}

function currentValue(c: Concept, key: EditableField): string {
  switch (key) {
    case 'difficulty':
      return conceptDifficulty(c) ?? '';
    case 'climbType':
      return c.climbType ?? '';
    default:
      return (c[key] as string | undefined) ?? '';
  }
}

export const EditSuggestSheet: React.FC<Props> = ({ visible, concept, onClose, onApplied }) => {
  const { colors, radius, spacing } = useTheme();
  const { space: bottomSpace } = useKeyboardSpace();
  const uid = useAuthStore((s) => s.user?.uid);
  const profile = useUserStore((s) => s.profile);

  const initial = useMemo(() => {
    const o: Record<string, string> = {};
    EDITABLE_FIELDS.forEach((f) => {
      o[f.key] = currentValue(concept, f.key);
    });
    return o;
  }, [concept]);

  const [form, setForm] = useState<Record<string, string>>(initial);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const mine = !!uid && concept.authorUid === uid;

  const submit = useCallback(async () => {
    if (!uid) {
      Alert.alert('로그인이 필요합니다.');
      return;
    }
    if (!profile) {
      Alert.alert('잠시만요', '프로필을 불러오는 중입니다. 잠시 후 다시 눌러 주세요.');
      return;
    }
    // 바꾼 칸만 추린다 (위 머리말)
    const patch: Partial<Record<EditableField, string>> = {};
    const before: Partial<Record<EditableField, string>> = {};
    EDITABLE_FIELDS.forEach((f) => {
      const next = (form[f.key] ?? '').trim();
      const prev = (initial[f.key] ?? '').trim();
      if (next !== prev) {
        patch[f.key] = next;
        before[f.key] = prev;
      }
    });

    if (Object.keys(patch).length === 0) {
      Alert.alert('바꾼 내용이 없습니다.');
      return;
    }

    setBusy(true);
    try {
      if (mine) {
        await applyDirect(concept, patch);
        Alert.alert('반영했습니다', '내가 올린 제보라 바로 반영됩니다.');
        onApplied();
      } else {
        await submitSuggestion(concept, patch, before, reason, {
          uid,
          nickname: profile.nickname,
        });
        Alert.alert('제안했습니다', '확인 후 반영됩니다. 고맙습니다.');
      }
      onClose();
    } catch (e) {
      Alert.alert('실패', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [uid, profile, form, initial, mine, concept, reason, onApplied, onClose]);

  const input = {
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
            <Text variant="title">정보 수정 {mine ? '' : '제안'}</Text>
            <Text variant="caption" color="textSecondary">
              {mine
                ? '내가 올린 제보라 바로 반영됩니다.'
                : '확인 후 반영됩니다. 바꾼 칸만 전달됩니다.'}
            </Text>

            {EDITABLE_FIELDS.map((f) => (
              <View key={f.key}>
                <Text variant="label" style={styles.label}>
                  {f.label}
                </Text>
                <TextInput
                  value={form[f.key] ?? ''}
                  onChangeText={(v) => setForm((o) => ({ ...o, [f.key]: v }))}
                  placeholder={initial[f.key] || '비어 있음'}
                  placeholderTextColor={colors.disabled}
                  style={[styles.input, input]}
                />
              </View>
            ))}

            {!mine ? (
              <>
                <Text variant="label" style={styles.label}>
                  왜 바꾸나요? (선택)
                </Text>
                <TextInput
                  value={reason}
                  onChangeText={setReason}
                  placeholder="예) 현장 볼트 수가 12개입니다"
                  placeholderTextColor={colors.disabled}
                  maxLength={200}
                  style={[styles.input, input]}
                />
              </>
            ) : null}

            <View style={styles.actions}>
              <Button title="취소" variant="ghost" onPress={onClose} style={styles.action} />
              <Button
                title={mine ? '반영하기' : '제안 보내기'}
                onPress={() => void submit()}
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
  body: { padding: 16, rowGap: 4 },
  label: { marginTop: 10 },
  input: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  actions: { flexDirection: 'row', columnGap: 8, marginTop: 20 },
  action: { flex: 1 },
});
