/**
 * 문의 탭 (사용자) — 마이페이지 ▸ 문의. v2 신규 (2026-08-17 사용자 요청).
 *
 * 문자·카카오톡으로 받던 기능개선·수정요청을 **앱 안에서** 받는다.
 * 보낸 사람은 여기서 자기 문의와 관리자 답변을 다시 볼 수 있다.
 *
 * 데이터: 최상위 `user_messages` 중 authorUid == 나 (실시간 구독)
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Text } from '../../../components/common/Text';
import { Button } from '../../../components/common/Button';
import { useTheme } from '../../../theme';
import { useKeyboardSpace } from '../../../hooks/useKeyboardSpace';
import { useMyPage } from '../hooks/useMyPage';
import {
  deleteMessage,
  sendMessage,
  subscribeMyMessages,
} from '../../../services/userMessageService';
import {
  MESSAGE_CATEGORIES,
  categoryLabel,
  statusLabel,
  type MessageCategory,
  type UserMessage,
} from '../../../types/userMessage';

const MAX_BODY = 1000;

export const InquiryTab: React.FC = () => {
  const { colors, radius, spacing } = useTheme();
  // ⚠️ edge-to-edge 라 키보드가 떠도 창이 안 줄어든다 (hooks/useKeyboardSpace.ts)
  const { space: bottomSpace } = useKeyboardSpace();
  const { uid, profile } = useMyPage();

  const [list, setList] = useState<UserMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<MessageCategory>('improve');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  /**
   * 재구독 트리거. Firestore 리스너는 permission-denied 로 한 번 끊기면
   * **자동 재시도하지 않는다**(규칙 배포 전에 구독이 걸린 경우 등).
   */
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!uid) {
      return;
    }
    setError(null);
    const unsub = subscribeMyMessages(
      uid,
      (rows) => {
        setList(rows);
        setError(null);
      },
      (msg) => {
        setList([]);
        setError(msg);
      },
    );
    return unsub;
  }, [uid, reloadKey]);

  const onSend = useCallback(() => {
    const text = body.trim();
    if (text.length < 5) {
      Alert.alert('문의', '내용을 5자 이상 적어주세요.');
      return;
    }
    if (!uid) {
      Alert.alert('문의', '로그인이 필요합니다.');
      return;
    }
    setSending(true);
    sendMessage(uid, profile?.nickname ?? '', { category, body: text })
      .then(() => {
        setBody('');
        // 규칙 배포 전에 구독이 죽어 있었다면 여기서 되살린다
        setReloadKey((k) => k + 1);
        Alert.alert('문의', '보냈습니다. 답변이 등록되면 이 화면에 표시됩니다.');
      })
      .catch((e: unknown) =>
        Alert.alert(
          '문의',
          `보내지 못했습니다.\n${e instanceof Error ? e.message : String(e)}`,
        ),
      )
      .finally(() => setSending(false));
  }, [body, category, profile?.nickname, uid]);

  const onDelete = useCallback((id: string) => {
    Alert.alert('문의 삭제', '이 문의를 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => {
          deleteMessage(id).catch((e: unknown) =>
            Alert.alert('오류', e instanceof Error ? e.message : String(e)),
          );
        },
      },
    ]);
  }, []);

  const header = (
    <View style={{ padding: spacing.md }}>
      {/* 무엇을 하는 곳인지 — 사용자 요청으로 간략한 설명을 넣었다 */}
      <View
        style={[
          styles.intro,
          { backgroundColor: colors.surfaceVariant, borderRadius: radius.md },
        ]}
      >
        <Text variant="label">개선할 점이 있으면 알려주세요</Text>
        <Text variant="caption" color="textSecondary" style={styles.introText}>
          앱을 쓰다가 불편했던 점, 잘못된 루트 정보, 오류를 적어 보내주시면
          운영자가 확인하고 답변을 남깁니다. 답변은 이 화면 아래 목록에 표시됩니다.
          {'\n'}긴급한 안전 문제는 앱 문의보다 현장 판단을 우선해 주세요.
        </Text>
      </View>

      <Text variant="label" style={styles.sectionLabel}>
        분류
      </Text>
      <View style={styles.chips}>
        {MESSAGE_CATEGORIES.map((c) => {
          const active = c.value === category;
          return (
            <Pressable
              key={c.value}
              accessibilityRole="button"
              onPress={() => setCategory(c.value)}
              style={[
                styles.chip,
                {
                  borderRadius: radius.full,
                  borderColor: active ? colors.primary : colors.divider,
                  backgroundColor: active ? colors.primary : 'transparent',
                },
              ]}
            >
              <Text
                variant="caption"
                color={active ? 'onPrimary' : 'textSecondary'}
              >
                {c.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text variant="caption" color="textSecondary">
        {MESSAGE_CATEGORIES.find((c) => c.value === category)?.hint}
      </Text>

      <TextInput
        value={body}
        onChangeText={setBody}
        placeholder="어떤 점이 불편하셨나요? 구체적으로 적어주시면 빠르게 확인할 수 있습니다."
        placeholderTextColor={colors.textSecondary}
        multiline
        maxLength={MAX_BODY}
        style={[
          styles.input,
          {
            color: colors.textPrimary,
            borderColor: colors.divider,
            borderRadius: radius.md,
            backgroundColor: colors.surface,
          },
        ]}
      />
      <Text variant="caption" color="textSecondary" style={styles.count}>
        {body.length} / {MAX_BODY}
      </Text>

      <Button
        title="문의 보내기"
        onPress={onSend}
        loading={sending}
        disabled={sending}
      />

      {error ? (
        <View style={styles.errorBox}>
          <Text variant="caption" color="error">
            문의 내역을 불러오지 못했습니다. {error}
          </Text>
          <Button
            title="다시 불러오기"
            variant="ghost"
            size="sm"
            onPress={() => setReloadKey((k) => k + 1)}
          />
        </View>
      ) : null}

      <Text variant="label" style={styles.sectionLabel}>
        보낸 문의 {list ? `(${list.length})` : ''}
      </Text>
    </View>
  );

  if (list === null && !error) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={{ paddingBottom: bottomSpace }}
      data={list ?? []}
      keyExtractor={(m) => m.id}
      ListHeaderComponent={header}
      keyboardShouldPersistTaps="handled"
      ListEmptyComponent={
        <Text
          variant="caption"
          color="textSecondary"
          style={[styles.empty, { paddingHorizontal: spacing.md }]}
        >
          아직 보낸 문의가 없습니다.
        </Text>
      }
      renderItem={({ item }) => (
        <View
          style={[
            styles.card,
            {
              marginHorizontal: spacing.md,
              borderColor: colors.divider,
              borderRadius: radius.md,
              backgroundColor: colors.surface,
            },
          ]}
        >
          <View style={styles.cardHead}>
            <Text variant="caption" color="primary">
              {categoryLabel(item.category)}
            </Text>
            <Text variant="caption" color="textSecondary">
              {statusLabel(item.status)}
            </Text>
          </View>

          <Text style={styles.body}>{item.body}</Text>

          {item.reply ? (
            <View
              style={[
                styles.reply,
                {
                  backgroundColor: colors.surfaceVariant,
                  borderRadius: radius.sm,
                },
              ]}
            >
              <Text variant="caption" color="primary">
                운영자 답변
              </Text>
              <Text variant="caption" style={styles.replyText}>
                {item.reply}
              </Text>
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            onPress={() => onDelete(item.id)}
            hitSlop={8}
            style={styles.deleteBtn}
          >
            <Text variant="caption" color="textSecondary">
              삭제
            </Text>
          </Pressable>
        </View>
      )}
    />
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  intro: { padding: 14 },
  introText: { marginTop: 6, lineHeight: 19 },
  sectionLabel: { marginTop: 18, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1 },
  input: {
    minHeight: 120,
    borderWidth: 1,
    padding: 12,
    marginTop: 12,
    textAlignVertical: 'top',
  },
  count: { textAlign: 'right', marginTop: 4, marginBottom: 10 },
  errorBox: { marginTop: 12, gap: 6 },
  empty: { paddingVertical: 24 },
  card: { borderWidth: 1, padding: 14, marginBottom: 10 },
  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  body: { lineHeight: 20 },
  reply: { marginTop: 12, padding: 10 },
  replyText: { marginTop: 4, lineHeight: 18 },
  deleteBtn: { alignSelf: 'flex-end', marginTop: 10, padding: 4 },
});
