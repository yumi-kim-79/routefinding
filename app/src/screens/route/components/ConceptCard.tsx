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
  /** 있으면 카드 우측에 사진 등록(📷) 버튼을 띄운다 — 웹 목록 카드의 카메라 버튼 대응 */
  onPhotoPress?: (concept: Concept) => void;
}

export const ConceptCard: React.FC<ConceptCardProps> = ({ concept, onPhotoPress }) => {
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

      {onPhotoPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="개념도 사진 등록"
          onPress={() => onPhotoPress(concept)}
          hitSlop={8}
          style={styles.photoBtn}
        >
          <AppIcon name="camera" size={20} color={colors.primary} />
        </Pressable>
      ) : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  photoBtn: { alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 8 },
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
