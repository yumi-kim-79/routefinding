/**
 * 단일 마커 탭 → 루트 요약 카드 (웹 RouteDetailDialog.vue 대응).
 *
 * ⚠️ 웹 대비 필드명 정정: 웹은 `route.images / description / createdAt`을 읽는데
 *    실제 Firestore 필드는 `imageUrls·imageUrl / overview / timestamp`다
 *    (docs/02_DATA_MODEL.md 실측). 그래서 웹 다이얼로그는 개요·등록일이 항상 비어 보인다.
 *    앱은 **실측 필드명**으로 제대로 표시한다.
 */
import React from 'react';
import { Image, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../../components/common/Text';
import { Button } from '../../../components/common/Button';
import { useTheme } from '../../../theme';
import { conceptThumbnail, type Concept } from '../../../types/concept';

interface RouteDetailSheetProps {
  concept: Concept | null;
  onClose: () => void;
  onOpenDetail: (c: Concept) => void;
}

export const RouteDetailSheet: React.FC<RouteDetailSheetProps> = ({
  concept,
  onClose,
  onOpenDetail,
}) => {
  const { colors, radius, spacing } = useTheme();
  if (!concept) {
    return null;
  }

  const thumb = conceptThumbnail(concept);
  const difficulty = concept.difficulty ?? concept.avgDifficulty;
  const registered = concept.timestamp?.toDate?.().toLocaleDateString?.() ?? '-';

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.card, { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md }]}
          onPress={(e) => e.stopPropagation()}
        >
          {thumb ? <Image source={{ uri: thumb }} style={[styles.image, { borderRadius: radius.md }]} /> : null}

          <Text variant="label" color="textSecondary" style={{ marginTop: spacing.sm }}>
            {concept.mountain ?? '등반지 미상'}
            {concept.zone ? ` · ${concept.zone}` : ''}
          </Text>
          <View style={[styles.titleRow, { marginTop: spacing.xs }]}>
            <Text variant="title" style={styles.flex}>
              {concept.routeName ?? '이름 없음'}
            </Text>
            <View style={[styles.tag, { backgroundColor: colors.surfaceVariant, borderRadius: radius.full }]}>
              <Text variant="caption" color="textSecondary">
                {concept.type}
              </Text>
            </View>
          </View>

          {concept.overview ? (
            <Text color="textSecondary" numberOfLines={4} style={{ marginTop: spacing.sm }}>
              {concept.overview}
            </Text>
          ) : null}

          <View style={{ marginTop: spacing.sm }}>
            <Text variant="caption" color="textSecondary">
              난이도: {difficulty || '정보없음'}
            </Text>
            <Text variant="caption" color="textSecondary">
              개척: {concept.pioneer || '정보없음'}
            </Text>
            <Text variant="caption" color="textSecondary">
              등록일: {registered}
            </Text>
          </View>

          <Button
            title="개념도 상세 보기"
            onPress={() => onOpenDetail(concept)}
            style={{ marginTop: spacing.md }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 420 },
  image: { width: '100%', height: 170, backgroundColor: '#00000010' },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  tag: { paddingHorizontal: 10, paddingVertical: 3, marginLeft: 8 },
});
