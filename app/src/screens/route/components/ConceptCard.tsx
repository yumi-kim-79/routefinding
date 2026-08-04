/**
 * 개념도 카드 (목록 1행).
 * 썸네일 + "등반지 · 구역 · 루트명" + 타입/난이도/길이 메타.
 * 탭 → ConceptDetail 이동.
 */
import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Text } from '../../../components/common/Text';
import { AppIcon } from '../../../components/common/AppIcon';
import { useTheme } from '../../../theme';
import {
  conceptLengthLabel,
  conceptThumbnail,
  conceptTitle,
  type Concept,
} from '../../../types/concept';
import type { MainStackParamList } from '../../../navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

interface ConceptCardProps {
  concept: Concept;
  /** 사진 등록 (웹 목록 카드의 카메라 버튼) */
  onPhotoPress?: (concept: Concept) => void;
  /** 즐겨찾기 토글 (웹 카드의 별) */
  isFavorite?: boolean;
  onFavoritePress?: (concept: Concept) => void;
  /** 등반일지 쓰기 (웹 카드의 연필) */
  onLogPress?: (concept: Concept) => void;
  /** 관리자 전용 — 수정/삭제 (웹 카드의 관리자 버튼 그룹) */
  isAdmin?: boolean;
  onEditPress?: (concept: Concept) => void;
  onDeletePress?: (concept: Concept) => void;
}

export const ConceptCard: React.FC<ConceptCardProps> = ({
  concept,
  onPhotoPress,
  isFavorite = false,
  onFavoritePress,
  onLogPress,
  isAdmin = false,
  onEditPress,
  onDeletePress,
}) => {
  const navigation = useNavigation<Nav>();
  const { colors, radius, spacing } = useTheme();

  const thumb = conceptThumbnail(concept);
  const lengthLabel = conceptLengthLabel(concept);
  const difficulty = concept.difficulty ?? concept.avgDifficulty;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() =>
        navigation.navigate('ConceptDetail', {
          conceptId: concept.id,
          source: concept.source,
        })
      }
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.divider,
          borderRadius: radius.md,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {thumb ? (
        <Image
          source={{ uri: thumb }}
          style={[styles.thumb, { borderTopLeftRadius: radius.md, borderBottomLeftRadius: radius.md }]}
        />
      ) : (
        <View
          style={[
            styles.thumb,
            styles.thumbEmpty,
            {
              backgroundColor: colors.surfaceVariant,
              borderTopLeftRadius: radius.md,
              borderBottomLeftRadius: radius.md,
            },
          ]}
        >
          <Text variant="caption" color="disabled">
            사진 없음
          </Text>
        </View>
      )}

      <View style={[styles.body, { paddingHorizontal: spacing.md, paddingVertical: spacing.sm }]}>
        <Text variant="title" numberOfLines={2}>
          {conceptTitle(concept)}
        </Text>

        {concept.overview ? (
          <Text
            variant="caption"
            color="textSecondary"
            numberOfLines={1}
            style={styles.overview}
          >
            {concept.overview}
          </Text>
        ) : null}

        <View style={styles.metaRow}>
          <View
            style={[
              styles.badge,
              {
                backgroundColor: colors.surfaceVariant,
                borderRadius: radius.sm,
              },
            ]}
          >
            <Text variant="caption" color="textSecondary">
              {concept.type}
            </Text>
          </View>
          {difficulty ? (
            <Text variant="caption" color="textSecondary">
              {difficulty}
            </Text>
          ) : null}
          {lengthLabel ? (
            <Text variant="caption" color="textSecondary">
              {lengthLabel}
            </Text>
          ) : null}
        </View>
      </View>

      {/* 카드 우측 액션 열 — 웹 목록 카드의 별/연필/카메라 + 관리자 수정·삭제 */}
      <View style={styles.actionCol}>
        {onFavoritePress ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isFavorite ? '즐겨찾기 해제' : '즐겨찾기'}
            onPress={() => onFavoritePress(concept)}
            hitSlop={6}
            style={styles.actionBtn}
          >
            <AppIcon
              name="star"
              size={18}
              filled={isFavorite}
              color={isFavorite ? colors.warning : colors.textSecondary}
            />
          </Pressable>
        ) : null}

        {onLogPress ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="등반일지 쓰기"
            onPress={() => onLogPress(concept)}
            hitSlop={6}
            style={styles.actionBtn}
          >
            <AppIcon name="pencil" size={17} color={colors.textSecondary} />
          </Pressable>
        ) : null}

        {onPhotoPress ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="개념도 사진 등록"
            onPress={() => onPhotoPress(concept)}
            hitSlop={6}
            style={styles.actionBtn}
          >
            <AppIcon name="camera" size={18} color={colors.primary} />
          </Pressable>
        ) : null}

        {isAdmin && onEditPress ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="개념도 수정"
            onPress={() => onEditPress(concept)}
            hitSlop={6}
            style={styles.actionBtn}
          >
            <AppIcon name="type" size={17} color={colors.accent.purple} />
          </Pressable>
        ) : null}

        {isAdmin && onDeletePress ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="개념도 삭제"
            onPress={() => onDeletePress(concept)}
            hitSlop={6}
            style={styles.actionBtn}
          >
            <AppIcon name="trash" size={17} color={colors.error} />
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  actionCol: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8, rowGap: 2 },
  actionBtn: { padding: 5 },
  card: {
    flexDirection: 'row',
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  thumb: { width: 104, height: 88 },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, justifyContent: 'center' },
  overview: { marginTop: 2 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  badge: { paddingHorizontal: 6, paddingVertical: 2 },
});
