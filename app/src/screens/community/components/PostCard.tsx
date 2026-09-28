/**
 * 피드 카드 — 인스타 형태.
 *
 *   ● 닉네임 · 2시간 전                    ⋯
 *   ┌──────────────────────────┐
 *   │        사진 (1:1)          │
 *   └──────────────────────────┘
 *   ♡  💬
 *   좋아요 12개
 *   닉네임  본문 두 줄까지… 더보기
 *   댓글 5개 모두 보기
 *
 * ⚠️ 카드 좌우 여백을 두지 않는다. 사진이 화면 폭을 꽉 채워야 인스타 느낌이 난다.
 *    글자만 좌우 12px 안쪽으로 넣는다.
 * ⚠️ 사진이 없는 글도 많다(자유주제·중고거래 문의). 사진 영역을 통째로 생략한다.
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../../components/common/Text';
import { AppIcon } from '../../../components/common/AppIcon';
import { Avatar } from '../../../components/common/Avatar';
import { useTheme } from '../../../theme';
import { PostPhotos } from './PostPhotos';
import {
  partyLabel,
  priceLabel,
  relativeTime,
  tradeStatusLabel,
  type CommunityPost,
} from '../../../types/communityPost';

interface PostCardProps {
  post: CommunityPost;
  /** 내 uid — 좋아요 눌렀는지 판단 */
  myUid?: string;
  onPress: (post: CommunityPost) => void;
  onLike: (post: CommunityPost) => void;
  onPhotoPress?: (post: CommunityPost, index: number) => void;
  onMore: (post: CommunityPost) => void;
}

export const PostCard: React.FC<PostCardProps> = ({
  post,
  myUid,
  onPress,
  onLike,
  onPhotoPress,
  onMore,
}) => {
  const { colors, radius } = useTheme();
  const liked = !!myUid && post.likedBy.includes(myUid);

  // 등반지 게시판이면 어디인지, 중고거래면 가격을 한 줄로
  const badge =
    post.boardType === 'party'
      ? (partyLabel(post)?.text ?? [post.mountain].filter(Boolean).join(' · '))
      : post.boardType === 'market'
      ? [tradeStatusLabel(post.tradeStatus), priceLabel(post.price, post.tradeType)]
          .filter(Boolean)
          .join(' · ')
      : post.boardType === 'place'
        ? [post.mountain, post.zone].filter(Boolean).join(' · ')
        : post.boardType === 'log'
          ? [post.place, post.routeName].filter(Boolean).join(' · ')
          : '';

  return (
    <View style={[styles.card, { borderBottomColor: colors.divider }]}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Avatar photoUrl={post.photoUrl} nickname={post.nickname} radius={16} />
        <View style={styles.headerText}>
          <Text variant="label" numberOfLines={1}>
            {post.nickname}
          </Text>
          {badge ? (
            <Text variant="caption" color="textSecondary" numberOfLines={1}>
              {badge}
            </Text>
          ) : null}
        </View>
        <Text variant="caption" color="textSecondary">
          {relativeTime(post.timestamp)}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="더보기"
          onPress={() => onMore(post)}
          hitSlop={10}
          style={styles.moreBtn}
        >
          <AppIcon name="more" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>

      {/* 사진 — 없으면 통째로 생략 */}
      <PostPhotos urls={post.imageUrls} onPress={(i) => onPhotoPress?.(post, i)} />

      {/* 액션 */}
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={liked ? '좋아요 취소' : '좋아요'}
          onPress={() => onLike(post)}
          hitSlop={8}
          style={styles.actionBtn}
        >
          <AppIcon
            name="heart"
            size={24}
            filled={liked}
            color={liked ? colors.error : colors.textPrimary}
          />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="댓글"
          onPress={() => onPress(post)}
          hitSlop={8}
          style={styles.actionBtn}
        >
          <AppIcon name="comment" size={23} color={colors.textPrimary} />
        </Pressable>
      </View>

      <Pressable onPress={() => onPress(post)} style={styles.body}>
        {post.likeCount > 0 ? (
          <Text variant="label">좋아요 {post.likeCount}개</Text>
        ) : null}

        {post.body ? (
          <Text variant="body" numberOfLines={2} style={styles.bodyText}>
            <Text variant="label">{post.nickname}</Text>
            {'  '}
            {post.body}
          </Text>
        ) : null}

        {post.commentCount > 0 ? (
          <Text variant="caption" color="textSecondary" style={styles.commentLink}>
            댓글 {post.commentCount}개 모두 보기
          </Text>
        ) : null}
      </Pressable>

      {/* 사진이 없는 글은 카드 경계가 흐려진다 — 얇은 구분만 준다 */}
      {post.imageUrls.length === 0 ? (
        <View style={[styles.plainEdge, { borderColor: colors.divider, borderRadius: radius.sm }]} />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 12 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  headerText: { flex: 1 },
  moreBtn: { padding: 4 },
  actions: { flexDirection: 'row', columnGap: 14, paddingHorizontal: 12, paddingTop: 10 },
  actionBtn: { paddingVertical: 2 },
  body: { paddingHorizontal: 12, paddingTop: 6, rowGap: 3 },
  bodyText: { lineHeight: 21 },
  commentLink: { marginTop: 2 },
  plainEdge: { height: 0 },
});
