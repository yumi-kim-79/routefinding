/**
 * 피치 목록 편집 (리드 전용) — 웹 ReportView.vue의 `.pitch-card` 대응.
 * 필드명은 웹과 1:1: name / length / difficulty / style / gear / images(최대 4장).
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../../components/common/Text';
import { Input } from '../../../components/common/Input';
import { Button } from '../../../components/common/Button';
import { AppIcon } from '../../../components/common/AppIcon';
import { useTheme } from '../../../theme';
import { MAX_PITCH_IMAGES, type PitchInput } from '../../../types/routeReport';
import { ImageStrip } from './ImageStrip';

interface PitchEditorProps {
  pitches: PitchInput[];
  onAdd: () => void;
  onRemove: (uid: string) => void;
  onUpdate: (uid: string, patch: Partial<Omit<PitchInput, 'uid' | 'images'>>) => void;
  onAddImages: (uid: string) => void;
  onRemoveImage: (pitchUid: string, imageUid: string) => void;
  onMoveImage: (pitchUid: string, imageUid: string, dir: -1 | 1) => void;
}

export const PitchEditor: React.FC<PitchEditorProps> = ({
  pitches,
  onAdd,
  onRemove,
  onUpdate,
  onAddImages,
  onRemoveImage,
  onMoveImage,
}) => {
  const { colors, radius, spacing } = useTheme();

  return (
    <View style={{ marginTop: spacing.md }}>
      <Text variant="label" color="textSecondary">
        피치 목록
      </Text>

      {pitches.map((p, i) => (
        <View
          key={p.uid}
          style={[
            styles.card,
            {
              borderColor: colors.divider,
              borderRadius: radius.md,
              backgroundColor: colors.surface,
              padding: spacing.md,
              marginTop: spacing.sm,
            },
          ]}
        >
          <View style={styles.head}>
            <Text variant="label" color="primary">
              {i + 1}피치
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="피치 삭제"
              onPress={() => onRemove(p.uid)}
              hitSlop={8}
              style={styles.headBtn}
            >
              <AppIcon name="trash" size={16} color={colors.error} />
              <Text variant="caption" color="error">
                삭제
              </Text>
            </Pressable>
          </View>

          <Input
            placeholder="이름"
            value={p.name}
            onChangeText={(v) => onUpdate(p.uid, { name: v })}
          />
          <Input
            placeholder="길이"
            value={p.length}
            onChangeText={(v) => onUpdate(p.uid, { length: v })}
          />
          <Input
            placeholder="난이도"
            value={p.difficulty}
            onChangeText={(v) => onUpdate(p.uid, { difficulty: v })}
          />
          <Input
            placeholder="형태"
            value={p.style}
            onChangeText={(v) => onUpdate(p.uid, { style: v })}
          />
          <Input
            placeholder="장비"
            value={p.gear}
            onChangeText={(v) => onUpdate(p.uid, { gear: v })}
          />

          <Text variant="label" color="textSecondary" style={{ marginTop: spacing.xs }}>
            피치 사진 (최대 {MAX_PITCH_IMAGES}장)
          </Text>
          <ImageStrip
            images={p.images}
            max={MAX_PITCH_IMAGES}
            onAdd={() => onAddImages(p.uid)}
            onRemove={(imageUid) => onRemoveImage(p.uid, imageUid)}
            onMove={(imageUid, dir) => onMoveImage(p.uid, imageUid, dir)}
          />
        </View>
      ))}

      <Button
        title="피치 추가"
        variant="secondary"
        onPress={onAdd}
        style={{ marginTop: spacing.sm }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headBtn: { flexDirection: 'row', alignItems: 'center', columnGap: 4 },
});
