/**
 * 사용자 메시지 탭 (관리자 전용) — 마이페이지 ▸ 사용자 메시지. v2 신규 (2026-08-17).
 *
 * 사용자가 보낸 문의를 모두 보고, 답변을 달거나 처리 완료로 닫는다.
 *
 * ⚠️ 이 탭은 `MyPageScreen` 에서 **관리자에게만** 노출된다.
 *    화면을 감추는 것은 편의일 뿐이고, 실제 차단은 firestore.rules 가 한다
 *    (`user_messages` 전체 조회는 isAdmin() 만 통과).
 *
 * ⚠️ 전체 목록은 `orderBy('createdAt')` 단독이라 복합 색인이 필요 없다.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import {
  closeMessage,
  replyMessage,
  subscribeAllMessages,
} from '../../../services/userMessageService';
import {
  categoryLabel,
  statusLabel,
  type MessageStatus,
  type UserMessage,
} from '../../../types/userMessage';

type Filter = 'todo' | 'all';

/** Timestamp → 'M월 D일 HH:mm' */
function when(ts?: { toDate: () => Date }): string {
  if (!ts?.toDate) {
    return '';
  }
  const d = ts.toDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const UserMessagesTab: React.FC = () => {
  const { colors, radius, spacing } = useTheme();
  // ⚠️ edge-to-edge 라 키보드가 떠도 창이 안 줄어든다 (hooks/useKeyboardSpace.ts)
  const { space: bottomSpace } = useKeyboardSpace();

  const [list, setList] = useState<UserMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('todo');
  /** 지금 답변을 쓰고 있는 문의 id → 입력 중인 답변 */
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setError(null);
    const unsub = subscribeAllMessages(
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
  }, [reloadKey]);

  /** 처리할 것 = 아직 닫지 않은 문의 */
  const shown = useMemo(() => {
    const rows = list ?? [];
    return filter === 'todo' ? rows.filter((m) => m.status !== 'closed') : rows;
  }, [filter, list]);

  const todoCount = useMemo(
    () => (list ?? []).filter((m) => m.status !== 'closed').length,
    [list],
  );

  const onReply = useCallback(
    (id: string) => {
      const text = replyText.trim();
      if (text.length < 2) {
        Alert.alert('답변', '답변 내용을 적어주세요.');
        return;
      }
      setBusy(true);
      replyMessage(id, text)
        .then(() => {
          setReplyFor(null);
          setReplyText('');
        })
        .catch((e: unknown) =>
          Alert.alert('오류', e instanceof Error ? e.message : String(e)),
        )
        .finally(() => setBusy(false));
    },
    [replyText],
  );

  const onClose = useCallback((id: string) => {
    Alert.alert('처리 완료', '이 문의를 처리 완료로 닫을까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '완료',
        onPress: () => {
          closeMessage(id).catch((e: unknown) =>
            Alert.alert('오류', e instanceof Error ? e.message : String(e)),
          );
        },
      },
    ]);
  }, []);

  if (list === null && !error) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const statusColor = (s: MessageStatus | undefined) =>
    s === 'closed' ? 'textSecondary' : s === 'answered' ? 'primary' : 'error';

  return (
    <FlatList
      contentContainerStyle={{ paddingBottom: bottomSpace }}
      data={shown}
      keyExtractor={(m) => m.id}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={{ padding: spacing.md }}>
          <View style={styles.filterRow}>
            {(['todo', 'all'] as Filter[]).map((f) => {
              const active = f === filter;
              return (
                <Pressable
                  key={f}
                  accessibilityRole="button"
                  onPress={() => setFilter(f)}
                  style={[
                    styles.chip,
                    {
                      borderRadius: radius.full,
                      borderColor: active ? colors.primary : colors.divider,
                    },
                  ]}
                >
                  <Text
                    variant="caption"
                    color={active ? 'primary' : 'textSecondary'}
                  >
                    {f === 'todo' ? `처리할 것 ${todoCount}` : `전체 ${(list ?? []).length}`}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text variant="caption" color="error">
                불러오지 못했습니다. {error}
              </Text>
              <Button
                title="다시 불러오기"
                variant="ghost"
                size="sm"
                onPress={() => setReloadKey((k) => k + 1)}
              />
            </View>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        <Text
          variant="caption"
          color="textSecondary"
          style={[styles.empty, { paddingHorizontal: spacing.md }]}
        >
          {filter === 'todo' ? '처리할 문의가 없습니다.' : '문의가 없습니다.'}
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
            <Text variant="caption" color={statusColor(item.status)}>
              {statusLabel(item.status)}
            </Text>
          </View>

          <Text variant="caption" color="textSecondary">
            {item.authorNickname || '익명'} · {when(item.createdAt)}
            {item.appVersion ? ` · v${item.appVersion}` : ''}
            {item.platform ? ` · ${item.platform}` : ''}
          </Text>

          <Text style={styles.body}>{item.body}</Text>

          {item.reply ? (
            <View
              style={[
                styles.reply,
                { backgroundColor: colors.surfaceVariant, borderRadius: radius.sm },
              ]}
            >
              <Text variant="caption" color="primary">
                내 답변
              </Text>
              <Text variant="caption" style={styles.replyText}>
                {item.reply}
              </Text>
            </View>
          ) : null}

          {replyFor === item.id ? (
            <View style={styles.replyEditor}>
              <TextInput
                value={replyText}
                onChangeText={setReplyText}
                placeholder="답변을 적어주세요"
                placeholderTextColor={colors.textSecondary}
                multiline
                maxLength={1000}
                style={[
                  styles.input,
                  {
                    color: colors.textPrimary,
                    borderColor: colors.divider,
                    borderRadius: radius.sm,
                  },
                ]}
              />
              <View style={styles.actions}>
                <Button
                  title="취소"
                  variant="ghost"
                  size="sm"
                  onPress={() => {
                    setReplyFor(null);
                    setReplyText('');
                  }}
                  style={styles.action}
                />
                <Button
                  title="답변 등록"
                  size="sm"
                  loading={busy}
                  disabled={busy}
                  onPress={() => onReply(item.id)}
                  style={styles.action}
                />
              </View>
            </View>
          ) : (
            <View style={styles.actions}>
              <Button
                title={item.reply ? '답변 수정' : '답변하기'}
                variant="ghost"
                size="sm"
                onPress={() => {
                  setReplyFor(item.id);
                  setReplyText(item.reply ?? '');
                }}
                style={styles.action}
              />
              {item.status !== 'closed' ? (
                <Button
                  title="처리 완료"
                  variant="secondary"
                  size="sm"
                  onPress={() => onClose(item.id)}
                  style={styles.action}
                />
              ) : null}
            </View>
          )}
        </View>
      )}
    />
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  filterRow: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1 },
  errorBox: { marginTop: 12, gap: 6 },
  empty: { paddingVertical: 24 },
  card: { borderWidth: 1, padding: 14, marginBottom: 10 },
  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  body: { marginTop: 8, lineHeight: 20 },
  reply: { marginTop: 12, padding: 10 },
  replyText: { marginTop: 4, lineHeight: 18 },
  replyEditor: { marginTop: 12 },
  input: { minHeight: 80, borderWidth: 1, padding: 10, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  action: { flex: 1 },
});
