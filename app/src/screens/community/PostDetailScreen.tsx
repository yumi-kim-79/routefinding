/**
 * 글 상세 + 댓글.
 *
 * ⚠️ 글은 **실시간 구독**한다(목록과 다르다). 좋아요·댓글 수가 바로 반영돼야 하고,
 *    한 문서만 보므로 비용이 문제되지 않는다.
 * ⚠️ 댓글은 **오래된 순**이다. 대화 흐름대로 읽는 게 자연스럽다 (인스타와 같다).
 * ⚠️ 대댓글은 없다. 100명 규모에서는 평면 목록으로 충분하고 구조가 절반으로 단순해진다.
 *
 * ⚠️ 이 화면은 `Screen` 래퍼도 `KeyboardAvoidingView` 도 쓰지 않는다 (2026-09-07 재수정).
 *    `targetSdk 36` + edge-to-edge 라 **키보드가 떠도 창이 줄지 않는다.**
 *    그래서 KeyboardAvoidingView 는 계산 결과가 0이 나와 아무 일도 하지 않았고,
 *    댓글 입력창이 키보드 뒤에 완전히 숨어 **자기가 뭘 쓰는지 볼 수 없었다.**
 *    → `useKeyboardSpace()` 로 아래에서 잠기는 높이를 직접 받아 그만큼 자리를 비운다.
 *    (근거와 배경은 hooks/useKeyboardSpace.ts 머리말)
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Text } from '../../components/common/Text';
import { Avatar } from '../../components/common/Avatar';
import { AppIcon } from '../../components/common/AppIcon';
import { ConceptImageViewer } from '../route/components/ConceptImageViewer';
import { useTheme } from '../../theme';
import { useAuthStore } from '../../stores/authStore';
import { useUserStore } from '../../stores/userStore';
import { useEnsureProfile } from '../../hooks/useEnsureProfile';
import { useKeyboardSpace } from '../../hooks/useKeyboardSpace';
import {
  addComment,
  deleteComment,
  deletePost,
  subscribeComments,
  subscribePost,
  toggleLike,
} from '../../services/communityService';
import { subscribeBlocked } from '../../services/moderationService';
import { checkText } from '../../utils/profanity';
import { PostPhotos } from './components/PostPhotos';
import { usePostMenu } from './usePostMenu';
import {
  partyLabel,
  priceLabel,
  relativeTime,
  tradeStatusLabel,
  type CommunityPost,
  type PostComment,
} from '../../types/communityPost';
import type { MainStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList, 'PostDetail'>;
type Rt = RouteProp<MainStackParamList, 'PostDetail'>;

export const PostDetailScreen: React.FC = () => {
  const { colors, radius, spacing } = useTheme();
  const { space: bottomSpace } = useKeyboardSpace();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const { postId } = params;

  const uid = useAuthStore((s) => s.user?.uid);
  const profile = useUserStore((s) => s.profile);
  // 프로필이 없으면 닉네임을 못 넣어 등록이 막힌다 (hooks/useEnsureProfile.ts 머리말)
  useEnsureProfile();

  const [post, setPost] = useState<CommunityPost | null>(null);
  const [gone, setGone] = useState(false);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [viewer, setViewer] = useState({ open: false, index: 0 });
  const [blocked, setBlocked] = useState<Set<string>>(new Set());

  const { openMenu } = usePostMenu();

  // 차단한 사용자의 댓글은 내 화면에서 뺀다 (CommunityScreen 과 같은 방식)
  useEffect(() => {
    if (!uid) {
      setBlocked(new Set());
      return;
    }
    return subscribeBlocked(uid, setBlocked);
  }, [uid]);

  useEffect(
    () =>
      subscribePost(
        postId,
        (p) => {
          setPost(p);
          if (!p) {
            setGone(true);
          }
        },
        (m) => Alert.alert('불러오기 실패', m),
      ),
    [postId],
  );

  useEffect(
    () => subscribeComments(postId, setComments, (m) => console.warn('[comments]', m)),
    [postId],
  );

  const send = useCallback(async () => {
    const body = draft.trim();
    if (!body || !uid || !profile) {
      return;
    }
    const clean = checkText(body);
    if (!clean.ok) {
      Alert.alert('등록할 수 없습니다', clean.message);
      return;
    }
    setSending(true);
    try {
      await addComment(postId, body, {
        uid,
        nickname: profile.nickname,
        photoUrl: profile.photoUrl,
      });
      setDraft('');
    } catch (e) {
      Alert.alert('댓글 실패', e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }, [draft, uid, profile, postId]);

  const removePost = useCallback(() => {
    Alert.alert('글 삭제', '이 글을 삭제할까요?\n되돌릴 수 없습니다.', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => {
          void deletePost(postId)
            .then(() => navigation.goBack())
            .catch((e: unknown) =>
              Alert.alert('삭제 실패', e instanceof Error ? e.message : String(e)),
            );
        },
      },
    ]);
  }, [postId, navigation]);

  /** 차단한 사용자의 댓글 제외 */
  const visibleComments = useMemo(
    () => comments.filter((c) => !blocked.has(c.authorUid)),
    [comments, blocked],
  );

  /**
   * ⋯ — 삭제(본인·관리자) / 신고 / 차단.
   * ⚠️ 목록 화면과 **같은 메뉴**여야 한다 (usePostMenu.ts 머리말).
   */
  const openPostMenu = useCallback(() => {
    if (!post) {
      return;
    }
    openMenu(
      {
        type: 'post',
        id: post.id,
        authorUid: post.authorUid,
        nickname: post.nickname,
        boardType: post.boardType,
      },
      { onDelete: removePost, onHidden: () => navigation.goBack() },
    );
  }, [post, openMenu, removePost, navigation]);

  const openCommentMenu = useCallback(
    (c: PostComment) => {
      openMenu(
        {
          type: 'comment',
          id: c.id,
          postId,
          authorUid: c.authorUid,
          nickname: c.nickname,
        },
        {
          onDelete: () => void deleteComment(postId, c.id),
          onHidden: (authorUid) => setBlocked((prev) => new Set(prev).add(authorUid)),
        },
      );
    },
    [openMenu, postId],
  );

  if (gone) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text variant="body" color="textSecondary">
          삭제되었거나 볼 수 없는 글입니다.
        </Text>
      </View>
    );
  }

  if (!post) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const liked = !!uid && post.likedBy.includes(uid);
  const badge =
    post.boardType === 'party'
      ? (partyLabel(post)?.text ?? [post.mountain].filter(Boolean).join(' · '))
      : post.boardType === 'market'
      ? [tradeStatusLabel(post.tradeStatus), priceLabel(post.price, post.tradeType), post.region]
          .filter(Boolean)
          .join(' · ')
      : post.boardType === 'place'
        ? [post.mountain, post.zone].filter(Boolean).join(' · ')
        : post.boardType === 'log'
          ? [post.place, post.routeName].filter(Boolean).join(' · ')
          : '';

  return (
    <View
      style={[
        styles.fill,
        {
          backgroundColor: colors.background,
          // ⚠️ 창이 안 줄어드니 우리가 줄인다 — 이만큼이 키보드 + 내비게이션 바다
          paddingBottom: bottomSpace,
        },
      ]}
    >
      <ScrollView keyboardShouldPersistTaps="handled">
        {/* 작성자 */}
        <View style={styles.header}>
          <Avatar photoUrl={post.photoUrl} nickname={post.nickname} radius={18} />
          <View style={styles.headerText}>
            <Text variant="label">{post.nickname}</Text>
            <Text variant="caption" color="textSecondary">
              {relativeTime(post.timestamp)}
              {badge ? ` · ${badge}` : ''}
            </Text>
          </View>
          {/*
            ⚠️ 예전엔 본인·관리자에게만 휴지통이 떴다. 그러면 **남의 글을 신고할 방법이 없다**
               (Apple 1.2 필수 요건). 지금은 누구에게나 ⋯ 이 뜨고, 그 안에서 갈린다.
          */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="더보기"
            onPress={openPostMenu}
            hitSlop={10}
          >
            <AppIcon name="more" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>

        <PostPhotos urls={post.imageUrls} onPress={(i) => setViewer({ open: true, index: i })} />

        {/* 좋아요 */}
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={liked ? '좋아요 취소' : '좋아요'}
            onPress={() => uid && void toggleLike(post.id, uid, liked)}
            hitSlop={8}
          >
            <AppIcon
              name="heart"
              size={24}
              filled={liked}
              color={liked ? colors.error : colors.textPrimary}
            />
          </Pressable>
          {post.likeCount > 0 ? (
            <Text variant="label">좋아요 {post.likeCount}개</Text>
          ) : null}
        </View>

        {post.body ? (
          <Text variant="body" style={styles.body}>
            {post.body}
          </Text>
        ) : null}

        {/* 댓글 */}
        <View style={[styles.commentHead, { borderTopColor: colors.divider }]}>
          <Text variant="title">댓글 {visibleComments.length}</Text>
        </View>

        {visibleComments.length === 0 ? (
          <Text variant="caption" color="disabled" style={styles.empty}>
            첫 댓글을 남겨 보세요
          </Text>
        ) : (
          visibleComments.map((c) => (
            <View key={c.id} style={styles.comment}>
              <Avatar photoUrl={c.photoUrl} nickname={c.nickname} radius={14} />
              <View style={styles.commentBody}>
                <Text variant="caption" color="textSecondary">
                  {c.nickname} · {relativeTime(c.timestamp)}
                </Text>
                <Text variant="body">{c.body}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="댓글 더보기"
                onPress={() => openCommentMenu(c)}
                hitSlop={10}
              >
                <AppIcon name="more" size={15} color={colors.textSecondary} />
              </Pressable>
            </View>
          ))
        )}

        {/* 마지막 댓글이 입력창에 가리지 않도록 */}
        <View style={{ height: spacing.xxl }} />
      </ScrollView>

      {/* 댓글 입력 — 하단 고정 */}
      <View
        style={[
          styles.inputBar,
          {
            borderTopColor: colors.divider,
            backgroundColor: colors.surface,
          },
        ]}
      >
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="댓글 달기…"
          placeholderTextColor={colors.disabled}
          maxLength={500}
          style={[styles.input, { color: colors.textPrimary }]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="댓글 등록"
          disabled={!draft.trim() || sending}
          onPress={() => void send()}
          style={[styles.sendBtn, { borderRadius: radius.full, opacity: draft.trim() ? 1 : 0.4 }]}
        >
          <Text variant="label" color="primary">
            등록
          </Text>
        </Pressable>
      </View>

      <ConceptImageViewer
        visible={viewer.open}
        images={post.imageUrls}
        initialIndex={viewer.index}
        onClose={() => setViewer((v) => ({ ...v, open: false }))}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: { flexDirection: 'row', alignItems: 'center', columnGap: 10, padding: 12 },
  headerText: { flex: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', columnGap: 10, padding: 12 },
  body: { paddingHorizontal: 12, lineHeight: 22 },
  commentHead: { marginTop: 20, paddingTop: 16, paddingHorizontal: 12, borderTopWidth: 1 },
  empty: { paddingHorizontal: 12, paddingTop: 12 },
  comment: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    columnGap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  commentBody: { flex: 1, rowGap: 2 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  input: { flex: 1, fontSize: 15, paddingVertical: 6 },
  sendBtn: { paddingHorizontal: 12, paddingVertical: 8 },
});
