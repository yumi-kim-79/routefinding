/**
 * 지도에서 좌표 선택 (웹 `components/MapPicker.vue` 대응).
 *
 * 지도를 움직여 화면 **중앙 십자선**에 맞추는 방식이다.
 * 마커를 끌어 옮기는 방식보다 손가락에 가려지지 않아 산에서 쓰기 좋고,
 * iOS·안드로이드 동작이 완전히 같다.
 */
import React, { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import MapView, { type Region } from 'react-native-maps';
import { Text } from '../../../components/common/Text';
import { Button } from '../../../components/common/Button';
import { AppIcon } from '../../../components/common/AppIcon';
import { useTheme } from '../../../theme';
import { DEFAULT_REGION, MAP_PROVIDER } from '../../../constants/map';

interface CoordPickerModalProps {
  visible: boolean;
  /** 기존 좌표가 있으면 그 위치에서 시작 */
  initial?: { latitude: number; longitude: number } | null;
  onPick: (coord: { latitude: number; longitude: number }) => void;
  onClose: () => void;
}

export const CoordPickerModal: React.FC<CoordPickerModalProps> = ({
  visible,
  initial,
  onPick,
  onClose,
}) => {
  const { colors, spacing } = useTheme();
  const start: Region = {
    latitude: initial?.latitude ?? DEFAULT_REGION.latitude,
    longitude: initial?.longitude ?? DEFAULT_REGION.longitude,
    latitudeDelta: initial ? 0.01 : DEFAULT_REGION.latitudeDelta,
    longitudeDelta: initial ? 0.01 : DEFAULT_REGION.longitudeDelta,
  };
  const centerRef = useRef({ latitude: start.latitude, longitude: start.longitude });
  const [center, setCenter] = useState(centerRef.current);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.wrap, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.divider, padding: spacing.md }]}>
          <Pressable accessibilityRole="button" onPress={onClose} hitSlop={10}>
            <AppIcon name="x" size={22} color={colors.textPrimary} />
          </Pressable>
          <Text variant="title">지도에서 선택</Text>
          <View style={styles.spacer} />
        </View>

        <View style={styles.flex}>
          <MapView
            provider={MAP_PROVIDER}
            style={StyleSheet.absoluteFill}
            initialRegion={start}
            showsUserLocation
            showsMyLocationButton
            onRegionChange={(r) => {
              centerRef.current = { latitude: r.latitude, longitude: r.longitude };
            }}
            onRegionChangeComplete={(r) => {
              setCenter({ latitude: r.latitude, longitude: r.longitude });
            }}
          />

          {/* 화면 중앙 십자선 — 이 점이 지정될 좌표다 */}
          <View style={styles.crosshair} pointerEvents="none">
            <View style={[styles.crossV, { backgroundColor: colors.primary }]} />
            <View style={[styles.crossH, { backgroundColor: colors.primary }]} />
            <View style={[styles.crossDot, { backgroundColor: colors.primary }]} />
          </View>
        </View>

        <View style={[styles.footer, { backgroundColor: colors.surface, padding: spacing.md }]}>
          <Text variant="caption" color="textSecondary">
            지도를 움직여 십자선을 루트 위치에 맞추세요
          </Text>
          <Text variant="label" style={{ marginTop: 2 }}>
            {center.latitude.toFixed(6)}, {center.longitude.toFixed(6)}
          </Text>
          <Button
            title="이 위치로 지정"
            onPress={() => onPick(center)}
            style={{ marginTop: spacing.sm }}
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
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  spacer: { width: 22 },
  crosshair: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crossV: { position: 'absolute', width: 2, height: 28, opacity: 0.9 },
  crossH: { position: 'absolute', width: 28, height: 2, opacity: 0.9 },
  crossDot: { position: 'absolute', width: 8, height: 8, borderRadius: 4 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#00000010' },
});
