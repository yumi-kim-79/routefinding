/**
 * 클러스터 마커 탭 → 같은 좌표의 루트 목록 (웹 ClusterModal.vue 대응).
 * 항목 선택 시 개념도 상세로 이동한다.
 *
 * ⚠️ 2026-08-13 — **길찾기 버튼이 여기에도 있어야 한다.**
 *    클러스터 반경이 30m(`CLUSTER_RADIUS_M`)라 한 바위의 루트들은 거의 다 하나로 묶인다.
 *    즉 지도에서 마커를 누르면 단일 카드(RouteDetailSheet)보다 **이 목록이 훨씬 자주 뜬다.**
 *    구글 Map Toolbar('따라가기')를 끈 뒤 여기에 대체 버튼을 안 넣어서
 *    "지도에 따라가기 버튼이 안 보인다"는 신고로 이어졌다.
 *
 *    30m 안이므로 루트별이 아니라 **군집 위치 한 곳**으로 길을 안내한다.
 *    (그 이상은 어차피 걸어서 접근 — 접근로는 ApproachMapModal이 담당)
 */
import React from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../../components/common/Text';
import { Button } from '../../../components/common/Button';
import { useTheme } from '../../../theme';
import type { Concept } from '../../../types/concept';
import { ConceptCard } from '../../route/components/ConceptCard';
import { useClosedCrags } from '../../../hooks/useClosedCrags';
import { toMapTarget } from '../../../utils/openExternalMap';
import { useDirections } from '../../../hooks/useDirections';

interface ClusterListModalProps {
  routes: Concept[] | null;
  onClose: () => void;
  onOpenDetail: (c: Concept) => void;
}

export const ClusterListModal: React.FC<ClusterListModalProps> = ({
  routes,
  onClose,
  onOpenDetail,
}) => {
  const { colors, radius, spacing } = useTheme();
  // ⚠️ 훅은 아래 조기 return 보다 위에 있어야 한다 (Rules of Hooks)
  const { busy, go } = useDirections();
  const { isConceptClosed } = useClosedCrags();
  if (!routes) {
    return null;
  }

  // 군집 대표 좌표 — 좌표가 유효한 첫 루트. 마커가 떠 있다는 건 최소 하나는 유효하다는 뜻
  const first = routes.find((r) => toMapTarget(r.latitude, r.longitude) !== null);
  const mapTarget = first
    ? toMapTarget(
        first.latitude,
        first.longitude,
        [first.mountain, first.zone].filter(Boolean).join(' · ') || '등반지',
      )
    : null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.header, { borderBottomColor: colors.divider, padding: spacing.md }]}>
            <Text variant="title">이 위치의 루트 {routes.length}개</Text>
            <Pressable accessibilityRole="button" onPress={onClose} hitSlop={12}>
              <Text color="textSecondary">
                닫기
              </Text>
            </Pressable>
          </View>

          {mapTarget ? (
            <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
              <Button
                title="인근 도로까지 길찾기"
                variant="secondary"
                loading={busy}
                onPress={() => go(mapTarget)}
              />
            </View>
          ) : null}

          <FlatList
            data={routes}
            keyExtractor={(item) => `${item.source}:${item.id}`}
            initialNumToRender={12}
            /*
              ⚠️ 개념도 탭과 **같은 컴포넌트**를 쓴다 (2026-08-29).
                 예전에는 여기서 루트명과 등반지만 보여줘서, 같은 루트인데
                 개념도 탭에서 열면 난이도·길이·피치가 보이고 지도에서 열면 안 보였다
                 (사용자 지적: "같은 루트지만 보여지는 정보가 다르잖아").
                 상세로 가기 전에 **이 모달을 먼저 닫아야** 하므로 onPress 로 가로챈다.
            */
            renderItem={({ item }) => (
              <ConceptCard
                concept={item}
                variant="row"
                closed={isConceptClosed(item)}
                onPress={onOpenDetail}
              />
            )}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '70%', overflow: 'hidden' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
