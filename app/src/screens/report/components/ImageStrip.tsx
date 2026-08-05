/**
 * 사진 첨부 줄 — 썸네일 + 삭제 + 순서 이동 + 추가 버튼.
 * 대표 이미지(8장)와 피치 이미지(4장) 양쪽에서 쓴다.
 *
 * 웹은 vuedraggable로 드래그 정렬하지만, RN에서 같은 UX를 내려면
 * reanimated + gesture-handler(네이티브 의존성 2개)가 필요하다.
 * → **좌/우 이동 버튼**으로 대체한다. 순서 개념과 결과는 동일하다.
 */
import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../../components/common/Text';
import { AppIcon } from '../../../components/common/AppIcon';
import { useTheme } from '../../../theme';
import type { LocalImage } from '../../../types/routeReport';

interface ImageStripProps {
  images: LocalImage[];
  max: number;
  onAdd: () => void;
  onRemove: (uid: string) => void;
  onMove: (uid: string, dir: -1 | 1) => void;
  /** 있으면 썸네일에 연필 버튼 — 사진 위에 라인·글자를 그린다 (대표 사진에서만 쓴다) */
  onEdit?: (uid: string) => void;
}

const THUMB = 80;

export const ImageStrip: React.FC<ImageStripProps> = ({
  images,
  max,
  onAdd,
  onRemove,
  onMove,
  onEdit,
}) => {
  const { colors, radius, spacing } = useTheme();

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {images.map((img, index) => (
          <View key={img.uid} style={styles.item}>
            <Image
              source={{ uri: img.remoteUrl ?? img.uri }}
              style={[styles.thumb, { borderRadius: radius.md, backgroundColor: colors.surfaceVariant }]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="사진 삭제"
              onPress={() => onRemove(img.uid)}
              hitSlop={6}
              style={[styles.del, { backgroundColor: colors.surface, borderColor: colors.divider }]}
            >
              <AppIcon name="x" size={13} color={colors.error} />
            </Pressable>

            {onEdit ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="라인 그리기"
                onPress={() => onEdit(img.uid)}
                hitSlop={6}
                style={[styles.edit, { backgroundColor: colors.surface, borderColor: colors.divider }]}
              >
                <AppIcon name="pencil" size={13} color={colors.primary} />
              </Pressable>
            ) : null}

            <View style={styles.moveRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="앞으로 이동"
                disabled={index === 0}
                onPress={() => onMove(img.uid, -1)}
                hitSlop={6}
                style={styles.moveBtn}
              >
                <AppIcon
                  name="back"
                  size={15}
                  color={index === 0 ? colors.disabled : colors.textSecondary}
                />
              </Pressable>
              <Text variant="caption" color="textSecondary">
                {index + 1}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="뒤로 이동"
                disabled={index === images.length - 1}
                onPress={() => onMove(img.uid, 1)}
                hitSlop={6}
                style={[styles.moveBtn, styles.flip]}
              >
                <AppIcon
                  name="back"
                  size={15}
                  color={index === images.length - 1 ? colors.disabled : colors.textSecondary}
                />
              </Pressable>
            </View>
          </View>
        ))}

        {images.length < max ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="사진 추가"
            onPress={onAdd}
            style={[styles.add, { borderColor: colors.border, borderRadius: radius.md }]}
          >
            <AppIcon name="plus" size={26} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </ScrollView>

      {images.length === 0 ? (
        <Text variant="caption" color="textSecondary" style={{ marginTop: spacing.xs }}>
          첨부된 사진 없음 (최대 {max}장)
        </Text>
      ) : (
        <Text variant="caption" color="textSecondary" style={{ marginTop: spacing.xs }}>
          {images.length} / {max}장 · 화살표로 순서를 바꿉니다 (첫 장이 대표 사진)
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  item: { width: THUMB, alignItems: 'center' },
  thumb: { width: THUMB, height: THUMB },
  del: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  edit: {
    position: 'absolute',
    top: -4,
    left: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moveRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  moveBtn: { padding: 2 },
  flip: { transform: [{ scaleX: -1 }] },
  add: {
    width: THUMB,
    height: THUMB,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
