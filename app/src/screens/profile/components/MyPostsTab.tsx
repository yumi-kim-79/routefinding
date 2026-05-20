/**
 * 내글 탭 — v1 `mypage_screen.dart::_buildMyPostsTab` 1:1.
 *
 * 쿼리: `posts where userId == uid .snapshots()` (orderBy/limit 없음 — v1 보존).
 * 아이템: 본인 프로필(ProfileWithCrown) + 제목 + snippet(content 30자) + 날짜 + 알림 배지.
 * 알림 배지: `notifications where receiverId==uid AND checked==false AND postId==<docId>` (N+1, v1 보존).
 * onTap: PostDetail로 push(MainStack — Phase 2-2까지 placeholder).
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import {
  collection,
  getDocs,
  onSnapshot,
  query,
  where,
} from '@react-native-firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { db } from '../../../services/firebase';
import { COLLECTIONS } from '../../../constants/firestoreFields';
import { Text } from '../../../components/common/Text';
import { ProfileWithCrown } from '../../../components/common/ProfileWithCrown';
import { useTheme } from '../../../theme';
import { useMyPage } from '../hooks/useMyPage';
import { formatDate } from '../../../utils/date';
import type { Post } from '../../../types/post';
import type { MainStackParamList } from '../../../navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

export const MyPostsTab: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { colors, spacing } = useTheme();
  const { uid, profile } = useMyPage();

  const [posts, setPosts] = useState<Post[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) {
      return;
    }
    const q = query(
      collection(db, COLLECTIONS.POSTS),
      where('userId', '==', uid),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: Post[] = snap.docs.map((d) => ({
          postId: d.id,
          ...(d.data() as Omit<Post, 'postId'>),
        }));
        setPosts(rows);
      },
      (e) => setError(e.message),
    );
    return unsub;
  }, [uid]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text variant="caption" color="error">
          에러: {error}
        </Text>
      </View>
    );
  }
  if (posts === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (posts.length === 0) {
    return (
      <View style={styles.center}>
        <Text variant="body" color="textSecondary">
          아직 작성한 글이 없습니다.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={posts}
      keyExtractor={(p) => p.postId}
      contentContainerStyle={{ padding: spacing.sm }}
      ItemSeparatorComponent={() => (
        <View style={{ height: 1, backgroundColor: colors.divider }} />
      )}
      renderItem={({ item }) => (
        <Pressable
          onPress={() =>
            navigation.navigate('PostDetail', { postId: item.postId })
          }
          style={({ pressed }) => [
            styles.row,
            { padding: spacing.md, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <ProfileWithCrown
            photoUrl={profile?.photoUrl}
            level={profile?.level}
            nickname={profile?.nickname}
            displayType="comment"
            radius={18}
          />
          <View style={styles.body}>
            <View style={styles.titleRow}>
              <Text variant="title" numberOfLines={1} style={styles.flex}>
                {item.title || '(제목 없음)'}
              </Text>
              {uid ? <UnreadBadge uid={uid} postId={item.postId} /> : null}
            </View>
            <Text variant="caption" color="textSecondary">
              {(profile?.nickname ?? '') + '   ' + formatDate(item.timestamp)}
            </Text>
            <Text variant="body" color="textSecondary" numberOfLines={1}>
              {snippetOf(item.content)}
            </Text>
          </View>
        </Pressable>
      )}
    />
  );
};

function snippetOf(content?: string): string {
  if (!content) {
    return '';
  }
  return content.length > 30 ? content.substring(0, 30) + '...' : content;
}

/**
 * 읽지 않은 알림 배지 — `notifications where receiverId==uid AND checked==false AND postId==<id>`.
 * v1 FutureBuilder per item과 동일(N+1, 1:1 보존). 인덱스 누락 시 콘솔 warn(앱은 계속 동작).
 */
const UnreadBadge: React.FC<{ uid: string; postId: string }> = ({
  uid,
  postId,
}) => {
  const { colors } = useTheme();
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const q = query(
          collection(db, COLLECTIONS.NOTIFICATIONS),
          where('receiverId', '==', uid),
          where('checked', '==', false),
          where('postId', '==', postId),
        );
        const snap = await getDocs(q);
        if (!cancelled) {
          setCount(snap.size);
        }
      } catch (e) {
        // 인덱스 누락 등 — v1 동작 보존(앱 안 깸). Firestore 에러 메시지에 인덱스 생성 URL 포함.
        // eslint-disable-next-line no-console
        console.warn('[MyPostsTab] unread badge query failed:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, postId]);

  if (count <= 0) {
    return null;
  }
  return (
    <View style={[styles.badge, { backgroundColor: colors.error }]}>
      <Text variant="caption" style={{ color: colors.onPrimary, fontSize: 10 }}>
        {count > 99 ? '99+' : String(count)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  body: { flex: 1, marginLeft: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  badge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
});
