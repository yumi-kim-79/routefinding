/**
 * Storage에 남아 있는 기존 사진 붙이기 (관리자 전용).
 *
 * 개념도를 실수로 지워도 **사진 파일은 Storage에 그대로 남는다.**
 * 루트를 다시 만들 때 여기서 골라 붙이면 다시 올릴 필요가 없다 (2026-08-05 복구 사고 대응).
 *
 * 고른 사진은 `remoteUrl`이 채워진 채로 폼에 들어가므로 **재업로드하지 않는다.**
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../../components/common/Text';
import { Button } from '../../../components/common/Button';
import { AppIcon } from '../../../components/common/AppIcon';
import { RemoteImage } from '../../../components/common/RemoteImage';
import { useTheme } from '../../../theme';
import { genUid, type LocalImage } from '../../../types/routeReport';
import {
  listRouteImages,
  routeImageFolder,
  type StoredImage,
} from '../../../services/storageBrowseService';

interface StoredImagePickerProps {
  visible: boolean;
  mountain: string;
  zone: string;
  routeName: string;
  /** 이미 폼에 들어 있는 URL (중복 선택 방지) */
  existingUrls: string[];
  onAdd: (images: LocalImage[]) => void;
  onClose: () => void;
}

export const StoredImagePicker: React.FC<StoredImagePickerProps> = ({
  visible,
  mountain,
  zone,
  routeName,
  existingUrls,
  onAdd,
  onClose,
}) => {
  const { colors, radius, spacing } = useTheme();
  const [items, setItems] = useState<StoredImage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    setItems(null);
    setError(null);
    setPicked(new Set());
    listRouteImages(mountain, zone, routeName)
      .then(setItems)
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
        setItems([]);
      });
  }, [mountain, routeName, zone]);

  useEffect(() => {
    if (visible) {
      load();
    }
  }, [load, visible]);

  const toggle = (url: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(url)) {
        next.delete(url);
      } else {
        next.add(url);
      }
      return next;
    });
  };

  const confirm = () => {
    const chosen = (items ?? []).filter((i) => picked.has(i.url));
    onAdd(chosen.map((i) => ({ uid: genUid(), uri: i.url, remoteUrl: i.url })));
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.wrap, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.divider, padding: spacing.md }]}>
          <Pressable accessibilityRole="button" onPress={onClose} hitSlop={10}>
            <AppIcon name="x" size={22} color={colors.textPrimary} />
          </Pressable>
          <View style={styles.flex}>
            <Text variant="title">기존 사진 불러오기</Text>
            <Text variant="caption" color="textSecondary" numberOfLines={1}>
              {routeImageFolder(mountain, zone, routeName)}
            </Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.md }}>
          {items === null ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : error ? (
            <Text color="error">{error}</Text>
          ) : items.length === 0 ? (
            <Text color="textSecondary">
              이 경로에 남아 있는 사진이 없습니다. 등반지·구역·루트 이름이 예전과 같은지
              확인해 주세요 (경로가 이름으로 만들어집니다).
            </Text>
          ) : (
            <View style={styles.grid}>
              {items.map((it) => {
                const already = existingUrls.includes(it.url);
                const on = picked.has(it.url);
                return (
                  <Pressable
                    key={it.path}
                    accessibilityRole="button"
                    disabled={already}
                    onPress={() => toggle(it.url)}
                    style={[
                      styles.cell,
                      {
                        borderRadius: radius.md,
                        borderColor: on ? colors.primary : colors.border,
                        borderWidth: on ? 3 : 1,
                        opacity: already ? 0.4 : 1,
                      },
                    ]}
                  >
                    <RemoteImage uri={it.url} style={styles.thumb} />
                    <Text variant="caption" color="textSecondary" numberOfLines={1}>
                      {already ? '이미 추가됨' : it.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: colors.surface, padding: spacing.md }]}>
          <Button
            title={picked.size > 0 ? `${picked.size}장 추가` : '사진을 선택하세요'}
            onPress={confirm}
            disabled={picked.size === 0}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  center: { padding: 40, alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cell: { width: 104, padding: 4, alignItems: 'center' },
  thumb: { width: 92, height: 92, borderRadius: 6 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#00000010' },
});
