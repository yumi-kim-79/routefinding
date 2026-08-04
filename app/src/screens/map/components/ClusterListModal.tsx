/**
 * 클러스터 마커 탭 → 같은 좌표의 루트 목록 (웹 ClusterModal.vue 대응).
 * 항목 선택 시 개념도 상세로 이동한다.
 */
import React from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../../components/common/Text';
import { useTheme } from '../../../theme';
import type { Concept } from '../../../types/concept';

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
  if (!routes) {
    return null;
  }

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

          <FlatList
            data={routes}
            keyExtractor={(item) => `${item.source}:${item.id}`}
            initialNumToRender={12}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                onPress={() => onOpenDetail(item)}
                style={({ pressed }) => [
                  {
                    paddingVertical: spacing.md,
                    paddingHorizontal: spacing.md,
                    backgroundColor: pressed ? colors.surfaceVariant : 'transparent',
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.divider,
                  },
                ]}
              >
                <Text>{item.routeName ?? '이름 없음'}</Text>
                <Text variant="caption" color="textSecondary">
                  {[item.mountain, item.zone].filter(Boolean).join(' · ') || '위치 정보 없음'}
                  {item.difficulty ? ` · ${item.difficulty}` : ''}
                </Text>
              </Pressable>
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
