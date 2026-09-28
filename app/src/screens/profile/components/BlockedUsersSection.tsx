/**
 * 차단 관리 — 마이페이지 ▸ 마이프로필 아래.
 *
 * ⚠️ 차단 기능은 Apple 심사지침 1.2(UGC) 필수 요건이다. 차단만 되고 **푸는 방법이 없으면**
 *    "사용자가 제어할 수 없다"로 걸린다. 그래서 목록과 해제 버튼이 반드시 있어야 한다.
 *
 * ⚠️ 차단은 **단방향**이다. 내 화면에서만 상대가 사라지고, 상대에게는 알리지 않는다
 *    (services/moderationService.ts 머리말).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../../components/common/Text';
import { useTheme } from '../../../theme';
import { useAuthStore } from '../../../stores/authStore';
import { fetchBlocked, unblockUser } from '../../../services/moderationService';

export const BlockedUsersSection: React.FC = () => {
  const { colors, radius } = useTheme();
  const uid = useAuthStore((s) => s.user?.uid);

  const [list, setList] = useState<{ uid: string; nickname: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!uid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setList(await fetchBlocked(uid));
    } catch {
      // 차단 목록을 못 읽어도 프로필 화면 전체가 죽으면 안 된다
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const release = useCallback(
    (target: { uid: string; nickname: string }) => {
      if (!uid) {
        return;
      }
      Alert.alert('차단 해제', `${target.nickname} 의 글과 댓글이 다시 보입니다.`, [
        { text: '취소', style: 'cancel' },
        {
          text: '해제',
          onPress: () => {
            void unblockUser(uid, target.uid)
              .then(() => setList((prev) => prev.filter((b) => b.uid !== target.uid)))
              .catch((e: unknown) =>
                Alert.alert('해제 실패', e instanceof Error ? e.message : String(e)),
              );
          },
        },
      ]);
    },
    [uid],
  );

  if (!uid) {
    return null;
  }

  return (
    <View style={[styles.wrap, { borderTopColor: colors.divider }]}>
      <Text variant="label" color="textSecondary" style={styles.head}>
        차단한 사용자
      </Text>

      {loading ? (
        <ActivityIndicator size="small" />
      ) : list.length === 0 ? (
        <Text variant="caption" color="disabled">
          차단한 사용자가 없습니다.
        </Text>
      ) : (
        list.map((b) => (
          <View
            key={b.uid}
            style={[
              styles.row,
              { borderColor: colors.border, borderRadius: radius.md },
            ]}
          >
            <Text variant="body" style={styles.name}>
              {b.nickname}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${b.nickname} 차단 해제`}
              onPress={() => release(b)}
              hitSlop={8}
            >
              <Text variant="label" color="primary">
                해제
              </Text>
            </Pressable>
          </View>
        ))
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginTop: 24, paddingTop: 16, borderTopWidth: 1, rowGap: 8 },
  head: { marginBottom: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  name: { flex: 1 },
});
