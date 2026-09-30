/**
 * 커뮤니티 — 게시판 탭 + 인스타형 피드.
 *
 * ⚠️ 게시판 목록은 **Firestore `boards` 에서 읽는다.** 코드에 박지 않는다 —
 *    관리자가 게시판을 추가하면 앱 배포 없이 즉시 나타나야 한다 (types/board.ts 머리말).
 *
 * ⚠️ 피드는 **실시간 구독이 아니다.** 페이지 단위로 받고, 당겨서 새로고침한다.
 *    리스너를 걸면 글 하나가 바뀔 때마다 접속자 전원에게 읽기가 발생한다
 *    (비용이 가장 먼저 터지는 지점 — communityService.ts 머리말).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen } from '../../components/common/Screen';
import { Text } from '../../components/common/Text';
import { AppIcon } from '../../components/common/AppIcon';
import { AdBanner } from '../../components/common/AdBanner';
import { useTheme } from '../../theme';
import { useAuthStore } from '../../stores/authStore';
import { useUserStore } from '../../stores/userStore';
import { useEnsureProfile } from '../../hooks/useEnsureProfile';
import { subscribeBoards } from '../../services/boardService';
import {
  deletePost,
  fetchPosts,
  toggleLike,
  type PostPage,
} from '../../services/communityService';
import { subscribeBlocked } from '../../services/moderationService';
import { PostCard } from './components/PostCard';
import { usePostMenu } from './usePostMenu';
import { CommunityRulesGate } from './CommunityRulesGate';
import type { Board } from '../../types/board';
import type { CommunityPost } from '../../types/communityPost';
import type { MainStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

export const CommunityScreen: React.FC = () => {
  const { colors, radius, spacing } = useTheme();
  const navigation = useNavigation<Nav>();
  const uid = useAuthStore((s) => s.user?.uid);
  const profile = useUserStore((s) => s.profile);

  /*
   * ⚠️ 프로필이 없으면 글쓰기 버튼이 안 뜬다. 예전엔 마이페이지를 한 번 열어야만
   *    채워져서, 앱을 켜고 바로 커뮤니티로 오면 글을 쓸 수 없었다 (2026-09-07 수정).
   */
  useEnsureProfile();

  const [boards, setBoards] = useState<Board[]>([]);
  const [boardIndex, setBoardIndex] = useState(0);
  const [boardError, setBoardError] = useState('');

  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [page, setPage] = useState<PostPage['cursor']>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [blocked, setBlocked] = useState<Set<string>>(new Set());
  /** 이용규칙 동의 창 — 동의 후 열 게시판을 기억해 둔다 */
  const [rulesFor, setRulesFor] = useState<Board | null>(null);

  const { openMenu } = usePostMenu();

  // 게시판 목록 (문서 몇 개뿐이라 실시간 구독해도 부담이 없다)
  useEffect(() => subscribeBoards(setBoards, setBoardError), []);

  /*
   * 차단 목록 — 차단한 사람의 글은 **내 화면에서만** 사라진다.
   * ⚠️ 서버 쿼리로 못 거른다. Firestore 에 `not-in` 은 10개 제한이 있고
   *    정렬과 같이 쓰면 색인이 성립하지 않는다. 받아 온 뒤 화면에서 뺀다.
   */
  useEffect(() => {
    if (!uid) {
      setBlocked(new Set());
      return;
    }
    return subscribeBlocked(uid, setBlocked);
  }, [uid]);

  const board = boards[Math.min(boardIndex, Math.max(0, boards.length - 1))];

  const load = useCallback(
    async (mode: 'first' | 'more') => {
      if (!board || loading) {
        return;
      }
      setLoading(true);
      setError('');
      try {
        const res = await fetchPosts(board.id, mode === 'more' ? page : null);
        setPosts((prev) => (mode === 'more' ? [...prev, ...res.posts] : res.posts));
        setPage(res.cursor);
        setHasMore(res.hasMore);
      } catch (e) {
        /*
         * ⚠️ 여기서 가장 흔한 실패는 **복합 색인 없음**이다.
         *    콘솔 로그에 색인 생성 링크가 함께 찍힌다 (docs 참조).
         */
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [board, loading, page],
  );

  // 게시판을 바꾸면 처음부터 다시
  useEffect(() => {
    setPosts([]);
    setPage(null);
    setHasMore(false);
    if (board) {
      void load('first');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board?.id]);

  // 글을 쓰고 돌아오면 목록을 새로 읽는다
  useFocusEffect(
    useCallback(() => {
      if (board && posts.length === 0) {
        void load('first');
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [board?.id]),
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setPage(null);
    await load('first');
    setRefreshing(false);
  }, [load]);

  const onLike = useCallback(
    (post: CommunityPost) => {
      if (!uid) {
        return;
      }
      const liked = post.likedBy.includes(uid);
      // 낙관적 갱신 — 네트워크를 기다리면 하트가 늦게 반응해 답답하다
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? {
                ...p,
                likedBy: liked ? p.likedBy.filter((u) => u !== uid) : [...p.likedBy, uid],
                likeCount: Math.max(0, p.likeCount + (liked ? -1 : 1)),
              }
            : p,
        ),
      );
      void toggleLike(post.id, uid, liked).catch(() => {
        // 실패하면 되돌린다
        setPosts((prev) =>
          prev.map((p) =>
            p.id === post.id
              ? {
                  ...p,
                  likedBy: liked ? [...p.likedBy, uid] : p.likedBy.filter((u) => u !== uid),
                  likeCount: post.likeCount,
                }
              : p,
          ),
        );
      });
    },
    [uid],
  );

  /*
   * 이용규칙 동의 여부. 프로필에 시각이 남아 있으면 다시 묻지 않는다.
   * ⚠️ 기기가 아니라 계정에 저장한다 (types/user.ts 의 communityAgreedAt).
   */
  const [agreed, setAgreed] = useState(false);
  const hasAgreed = agreed || !!profile?.communityAgreedAt;

  const openWrite = useCallback(
    (b: Board) => {
      if (!profile) {
        Alert.alert('잠시만요', '프로필을 불러오는 중입니다. 잠시 후 다시 눌러 주세요.');
        return;
      }
      if (!hasAgreed) {
        setRulesFor(b);
        return;
      }
      navigation.navigate('PostWrite', { boardId: b.id, boardType: b.type });
    },
    [hasAgreed, navigation, profile],
  );

  /*
   * ⚠️ 조건에 profile 을 넣지 않는다. 프로필을 아직 못 읽었다는 이유로 버튼을 **감춰 버리면**
   *    사용자는 왜 글을 못 쓰는지 알 수 없다 (2026-09-07 에 실제로 겪은 증상).
   *    버튼은 띄우고, 눌렀을 때 아직이면 이유를 말해 준다.
   */
  const canWrite = useMemo(() => !!board?.writable && !!uid, [board, uid]);

  /** 차단한 사용자의 글은 목록에서 뺀다 (위 useEffect 머리말 참조) */
  const visiblePosts = useMemo(
    () => posts.filter((p) => !blocked.has(p.authorUid)),
    [posts, blocked],
  );

  /** ⋯ — 삭제(본인·관리자) / 신고 / 차단. 상세 화면과 같은 메뉴다 */
  const onMore = useCallback(
    (post: CommunityPost) => {
      openMenu(
        {
          type: 'post',
          id: post.id,
          authorUid: post.authorUid,
          nickname: post.nickname,
          boardType: post.boardType,
        },
        {
          onDelete: () => {
            void deletePost(post.id)
              .then(() => setPosts((prev) => prev.filter((p) => p.id !== post.id)))
              .catch(() => undefined);
          },
          // 차단 직후에도 목록에서 바로 사라지게 (구독 반영을 기다리지 않는다)
          onHidden: (authorUid) =>
            setBlocked((prev) => new Set(prev).add(authorUid)),
        },
      );
    },
    [openMenu],
  );

  if (boardError) {
    return (
      <Screen>
        <Text variant="body" color="error">
          게시판을 불러오지 못했습니다.{'\n'}
          {boardError}
        </Text>
      </Screen>
    );
  }

  if (boards.length === 0) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      padded={false}
      /*
       * 🚨 `edges` 에서 'bottom' 을 뺀다 (2026-09-30).
       *    `Screen` 의 기본값은 `['top','bottom']` 이라 **하단 safe-area 만큼 패딩**이 들어간다.
       *    이 화면은 **하단 탭 네비게이터 안**이고 탭 바가 이미 그 영역을 먹고 있어,
       *    여기서 또 넣으면 **인셋이 두 번** 들어간다 → 광고 배너와 내용이 그만큼 위로 밀린다.
       *    지도·개념도 탭은 `Screen` 을 쓰지 않아 멀쩡했고, 이 두 탭만 배너가 높았다
       *    (사용자 보고: "커뮤니티·마이페이지만 배너가 위로 올라와 화면을 가린다").
       */
      edges={['top']}
    >
      {/* 게시판 탭 — boards 문서에서 그린다 */}
      <View style={[styles.tabBarWrap, { borderBottomColor: colors.divider }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBar}
        >
          {boards.map((b, i) => {
            const active = i === boardIndex;
            return (
              <Pressable
                key={b.id}
                onPress={() => setBoardIndex(i)}
                style={[styles.tab, active && { borderBottomColor: colors.primary }]}
              >
                <Text variant="label" color={active ? 'primary' : 'textSecondary'}>
                  {b.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/*
        ⚠️ 목록과 FAB 을 같은 상자에 넣는다.
           예전엔 FAB 이 화면 전체를 기준으로 absolute 였는데, 화면 맨 아래는
           **광고 배너 자리**여서 FAB 이 배너에 반쯤 가렸다 (2026-09-07).
           이 상자는 배너 위에서 끝나므로, 배너 높이가 기기마다 달라도 항상 그 위에 뜬다.
      */}
      <View style={styles.feed}>
        <FlatList
          data={visiblePosts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              myUid={uid}
              onPress={(p) => navigation.navigate('PostDetail', { postId: p.id })}
              onLike={onLike}
              onMore={onMore}
              onPhotoPress={(p) => navigation.navigate('PostDetail', { postId: p.id })}
            />
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (hasMore && !loading) {
              void load('more');
            }
          }}
          ListEmptyComponent={
            loading ? (
              <View style={styles.center}>
                <ActivityIndicator />
              </View>
            ) : (
              <View style={styles.center}>
                <Text variant="body" color="textSecondary" style={styles.emptyText}>
                  {error
                    ? `불러오지 못했습니다.\n${error}`
                    : (board?.description ?? '아직 글이 없습니다.')}
                </Text>
                {!error && board?.writable ? (
                  <Text variant="caption" color="disabled" style={styles.emptyText}>
                    첫 글을 남겨 보세요
                  </Text>
                ) : null}
              </View>
            )
          }
          ListFooterComponent={
            loading && visiblePosts.length > 0 ? (
              <View style={styles.footer}>
                <ActivityIndicator size="small" />
              </View>
            ) : null
          }
          initialNumToRender={4}
          maxToRenderPerBatch={4}
          windowSize={5}
          removeClippedSubviews
        />

        {/* 글쓰기 — 쓰기 가능한 게시판에서만 (등반일지 게시판은 writable=false) */}
        {canWrite && board ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="글쓰기"
            onPress={() => openWrite(board)}
            style={({ pressed }) => [
              styles.fab,
              {
                backgroundColor: colors.primary,
                borderRadius: radius.full,
                bottom: spacing.xl,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <AppIcon name="plus" size={26} color={colors.onPrimary} />
          </Pressable>
        ) : null}
      </View>

      {/*
        ⚠️ 이용규칙 동의는 **글을 쓰기 전에** 받아야 한다 (Apple 1.2).
           CommunityRulesGate.tsx 머리말 참조 — 화면에서 떼어내지 말 것.
      */}
      {uid && rulesFor ? (
        <CommunityRulesGate
          visible
          uid={uid}
          onAgree={() => {
            const b = rulesFor;
            setRulesFor(null);
            setAgreed(true);
            navigation.navigate('PostWrite', { boardId: b.id, boardType: b.type });
          }}
          onCancel={() => setRulesFor(null)}
        />
      ) : null}

      <AdBanner />
    </Screen>
  );
};

const styles = StyleSheet.create({
  tabBarWrap: { borderBottomWidth: 1 },
  tabBar: { paddingHorizontal: 8 },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, rowGap: 6 },
  emptyText: { textAlign: 'center' },
  footer: { paddingVertical: 20 },
  feed: { flex: 1 },
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
});
