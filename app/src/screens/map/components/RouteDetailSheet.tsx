/**
 * 단일 마커 탭 → 루트 요약 카드 (웹 RouteDetailDialog.vue 대응).
 *
 * ⚠️ 웹 대비 필드명 정정: 웹은 `route.images / description / createdAt`을 읽는데
 *    실제 Firestore 필드는 `imageUrls·imageUrl / overview / timestamp`다
 *    (docs/02_DATA_MODEL.md 실측). 그래서 웹 다이얼로그는 개요·등록일이 항상 비어 보인다.
 *    앱은 **실측 필드명**으로 제대로 표시한다.
 *
 * ⚠️ 2026-08-13 — 여기에 **길찾기 버튼이 있어야 한다.**
 *    이전에는 구글 지도 SDK가 마커 선택 시 그려 주던 Map Toolbar(우하단 '따라가기')가
 *    그 역할을 했는데, 그 버튼이 `stopped` 상태의 구글 지도 앱으로 암시적 인텐트를 던져
 *    *"설치되어 있지 않거나 중지되었습니다"* 로 죽는 문제가 있어 `toolbarEnabled={false}`로 껐다.
 *    끄기만 하니 지도에서 길찾기로 갈 방법이 사라져서, 우리 버튼으로 되살린다.
 *    (`utils/openExternalMap.ts` — 안드로이드는 웹 폴백이 있어 막히지 않고,
 *     iOS는 Apple 지도를 첫 선택지로 띄워 심사 Guideline 4를 만족한다)
 */
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../../components/common/Text';
import { Button } from '../../../components/common/Button';
import { RemoteImage } from '../../../components/common/RemoteImage';
import { useTheme } from '../../../theme';
import { conceptThumbnail, conceptTitle, type Concept } from '../../../types/concept';
import { useClosedCrags } from '../../../hooks/useClosedCrags';
import { toMapTarget } from '../../../utils/openExternalMap';
import { useDirections } from '../../../hooks/useDirections';

interface RouteDetailSheetProps {
  concept: Concept | null;
  /** 지도 시트에서도 폐쇄를 알려야 한다 — 현장에 가기 전에 보는 화면이다 */
  onClose: () => void;
  onOpenDetail: (c: Concept) => void;
}

export const RouteDetailSheet: React.FC<RouteDetailSheetProps> = ({
  concept,
  onClose,
  onOpenDetail,
}) => {
  const { colors, radius, spacing } = useTheme();
  // ⚠️ 훅은 아래 조기 return 보다 위에 있어야 한다 (Rules of Hooks)
  const { busy, go } = useDirections();
  /* ⚠️ early return 보다 위 — 훅 개수가 렌더마다 달라지면 안 된다 */
  const { isConceptClosed } = useClosedCrags();

  if (!concept) {
    return null;
  }

  const thumb = conceptThumbnail(concept);
  const difficulty = concept.difficulty ?? concept.avgDifficulty;
  const registered = concept.timestamp?.toDate?.().toLocaleDateString?.() ?? '-';
  // 좌표가 문자열/숫자로 섞여 저장돼 있고 (0,0) 더미도 있다 → 유효할 때만 버튼을 낸다
  const mapTarget = toMapTarget(
    concept.latitude,
    concept.longitude,
    conceptTitle(concept),
  );

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.card, { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md }]}
          onPress={(e) => e.stopPropagation()}
        >
          {/*
            내용이 화면보다 길면(사진 + 개요 4줄 + 메타 3줄) 카드가 세로 중앙 정렬이라
            아래쪽 버튼이 화면 밖으로 밀린다 → 내용만 스크롤시키고 버튼은 항상 보이게 둔다.
          */}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
          {/*
            ⚠️ 2026-08-25 수정 — 여기가 `<Image source={{ uri: thumb }} />` 였다.
               개념도 사진 주소는 `storage.googleapis.com` 원본이라 **그냥 넣으면 403**이다.
               (GCS IAM을 타므로 Storage 규칙으로는 열리지 않는다 — imageUrlService 주석 참조)
               지도에서 마커를 눌렀을 때 사진이 안 보이던 원인.
          */}
          {thumb ? (
            <RemoteImage
              uri={thumb}
              style={[styles.image, { borderRadius: radius.md }]}
              variant="thumb"
            />
          ) : null}

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

          {isConceptClosed(concept) ? (
            <View
              style={[
                styles.closed,
                { backgroundColor: colors.error, borderRadius: radius.sm, marginTop: spacing.sm },
              ]}
            >
              <Text variant="caption" style={styles.closedText}>
                ⛔ 지금 폐쇄 중입니다. 눌러서 안내를 확인하세요.
              </Text>
            </View>
          ) : null}

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
          </ScrollView>

          <View style={[styles.actions, { marginTop: spacing.md }]}>
            {mapTarget ? (
              <Button
                title="인근 도로까지 길찾기"
                variant="secondary"
                loading={busy}
                onPress={() => go(mapTarget)}
                style={styles.flex}
              />
            ) : null}
            <Button
              title="개념도 상세 보기"
              onPress={() => onOpenDetail(concept)}
              style={styles.flex}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  closed: { paddingHorizontal: 8, paddingVertical: 6 },
  closedText: { color: '#ffffff', fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 420, maxHeight: '88%' },
  scroll: { flexGrow: 0 },
  scrollContent: { paddingBottom: 4 },
  image: { width: '100%', height: 170, backgroundColor: '#00000010' },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  tag: { paddingHorizontal: 10, paddingVertical: 3, marginLeft: 8 },
  actions: { flexDirection: 'row', gap: 8 },
});
