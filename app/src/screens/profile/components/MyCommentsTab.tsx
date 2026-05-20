/**
 * 내댓글 탭 — v1 `mypage_screen.dart::_buildMyCommentsTab` 1:1.
 *
 * 쿼리: `collectionGroup('comments') where userId==uid orderBy timestamp desc .snapshots()`.
 *   ✅ 인덱스 firestore.indexes.json 정의 확인 (Phase A 분석).
 * 아이템: ProfileWithCrown(본인) + 원본 글 제목(per-item posts/{postId}.get N+1, v1 보존)
 *   + 댓글 본문(2줄) + 날짜 + 알림 배지(commentId).
 * postId 추출: `doc.ref.parent.parent.id` (경로 posts/{postId}/comments/{commentId}).
 * onTap: 원본 PostDetail로 push.
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
  collectionGroup,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  where,
} from '@react-native-firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { db } from '../../../services/firebase';
import { COLLECTIONS, SUBCOLLECTIONS } from '../../../constants/firestoreFields';
import { Text } from '../../../components/common/Text';
import { ProfileWithCrown } from '../../../components/common/ProfileWithCrown';
import { UnreadBadge } from '../../../components/common/UnreadBadge';
import { useTheme } from '../../../theme';
import { useMyPage } from '../hooks/useMyPage';
import { formatDate } from '../../../utils/date';
import type { Comment } from '../../../types/comment';
import type { MainStackParamList } from '../../../navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

export const MyCommentsTab: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { colors, spacing } = useTheme();
  const { uid, profile } = useMyPage();

  const [items, setItems] = useState<Comment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) {
      return;
    }
    const q = query(
      collectionGroup(db, SUBCOLLECTIONS.COMMENTS),
      where('userId', '==', uid),
      orderBy('timestamp', 'desc'),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: Comment[] = snap.docs.map((d) => {
          const data = d.data() as Omit<Comment, 'commentId' | 'postId'>;
          const postId = d.ref.parent.parent?.id ?? '';
          return { commentId: d.id, postId, ...data };
        });
        setItems(rows);
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
  if (items === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (items.length === 0) {
    return (
      <View style={styles.center}>
        <Text variant="body" color="textSecondary">
          아직 작성한 댓글이 없습니다.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(c) => c.commentId}
      contentContainerStyle={{ padding: spacing.sm }}
      ItemSeparatorComponent={() => (
        <View style={{ height: 1, backgroundColor: colors.divider }} />
      )}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => {
            if (item.postId) {
              navigation.navigate('PostDetail', { postId: item.postId });
            }
          }}
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
            radius={16}
          />
          <View style={styles.body}>
            <View style={styles.titleRow}>
              <View style={styles.flex}>
                {item.postId ? (
                  <PostTitle postId={item.postId} />
                ) : (
                  <Text variant="label" color="textSecondary">
                    (원본 글 없음)
                  </Text>
                )}
              </View>
              {uid ? (
                <UnreadBadge
                  uid={uid}
                  field="commentId"
                  value={item.commentId}
                />
              ) : null}
            </View>
            <Text variant="body" numberOfLines={2}>
              {item.text || ''}
            </Text>
            <Text variant="caption" color="textSecondary">
              {formatDate(item.timestamp)}
            </Text>
          </View>
        </Pressable>
      )}
    />
  );
};

/**
 * 부모 글 제목 — v1 FutureBuilder per item 1:1. posts/{postId}.get() 1회.
 * 실패/없음 = "(삭제된 글)" 표시. 로딩 중엔 빈 자리.
 */
const PostTitle: React.FC<{ postId: string }> = ({ postId }) => {
  const [title, setTitle] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, COLLECTIONS.POSTS, postId));
        if (cancelled) {
          return;
        }
        if (snap.exists()) {
          const t = (snap.data() as { title?: string } | undefined)?.title;
          setTitle(t ?? '(제목 없음)');
        } else {
          setMissing(true);
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[MyCommentsTab] post title fetch failed:', e);
        if (!cancelled) {
          setMissing(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [postId]);

  if (missing) {
    return (
      <Text variant="label" color="textSecondary">
        (삭제된 글)
      </Text>
    );
  }
  return (
    <Text variant="label" color="primary" numberOfLines={1}>
      {title ?? ' '}
    </Text>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  body: { flex: 1, marginLeft: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
});
