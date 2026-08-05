/**
 * 접근로(어프로치) 보기 — 첨부된 GPX 트랙을 지도에 그린다.
 *
 * 배경 (2026-08-05):
 *   v2에서 **GPS 실시간 따라가기를 없앴다**(배터리·정확도·권한 문제). 대신 접근로는
 *   **GPX 파일 첨부**로 남기기로 했는데, 정작 앱에는 그 파일을 **보는 화면이 없었다**
 *   (개념도 상세에 "등록됨" 글자만 떴다). 첨부만 되고 볼 수 없으면 첨부의 의미가 없다.
 *
 * 그리는 대상 우선순위:
 *   1) `gpxUrl` — 첨부된 GPX 파일 (정식 경로)
 *   2) `trackingPath` — v1 시절 실시간 기록이 배열로 남은 옛 문서 (파일이 없을 때만)
 *
 * 지도는 지도탭과 같은 provider(구글)를 쓴다 — 같은 지도를 봐야 혼란이 없다.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../../../components/common/Text';
import { AppIcon } from '../../../components/common/AppIcon';
import { useTheme } from '../../../theme';
import { DEFAULT_REGION, MAP_PROVIDER } from '../../../constants/map';
import { fetchGpxTrack, trackLengthLabel, type TrackPoint } from '../../../services/gpxService';

interface ApproachMapModalProps {
  visible: boolean;
  /** 첨부된 GPX 다운로드 URL */
  gpxUrl?: string;
  /** GPX가 없을 때 쓰는 옛 기록 배열 */
  fallbackPath?: Array<{ latitude: number | string; longitude: number | string }>;
  /** 루트 위치 (트랙 도착점 확인용, 있으면 마커로 함께 표시) */
  routeCoord?: { latitude: number; longitude: number } | null;
  title?: string;
  onClose: () => void;
}

type State =
  | { state: 'loading' }
  | { state: 'ready'; points: TrackPoint[] }
  | { state: 'error'; message: string };

/** 옛 trackingPath(문자열 좌표가 섞여 있음) → TrackPoint[] */
function normalize(
  raw: Array<{ latitude: number | string; longitude: number | string }> | undefined,
): TrackPoint[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((p) => ({ latitude: Number(p.latitude), longitude: Number(p.longitude) }))
    .filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));
}

export const ApproachMapModal: React.FC<ApproachMapModalProps> = ({
  visible,
  gpxUrl,
  fallbackPath,
  routeCoord,
  title,
  onClose,
}) => {
  const { colors, spacing } = useTheme();
  // Modal은 SafeAreaView 바깥이라 노치에 헤더가 가린다 (iOS에서 X가 안 눌리던 원인)
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView | null>(null);
  const [load, setLoad] = useState<State>({ state: 'loading' });

  useEffect(() => {
    if (!visible) {
      return;
    }
    let alive = true;
    setLoad({ state: 'loading' });

    (async () => {
      try {
        if (gpxUrl) {
          const points = await fetchGpxTrack(gpxUrl);
          if (alive) {
            setLoad({ state: 'ready', points });
          }
          return;
        }
        const legacy = normalize(fallbackPath);
        if (legacy.length > 0) {
          if (alive) {
            setLoad({ state: 'ready', points: legacy });
          }
          return;
        }
        if (alive) {
          setLoad({ state: 'error', message: '등록된 접근로가 없습니다.' });
        }
      } catch (e) {
        if (alive) {
          setLoad({
            state: 'error',
            message: e instanceof Error ? e.message : '접근로를 불러오지 못했습니다.',
          });
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [visible, gpxUrl, fallbackPath]);

  /** 트랙이 준비되면 전체가 보이도록 화면을 맞춘다 */
  const fit = (points: TrackPoint[]) => {
    if (points.length < 2) {
      return;
    }
    mapRef.current?.fitToCoordinates(points, {
      // 위쪽은 헤더, 아래쪽은 요약 바가 덮으므로 여유를 더 준다
      edgePadding: { top: 90, right: 50, bottom: 130, left: 50 },
      animated: false,
    });
  };

  const points = load.state === 'ready' ? load.points : [];
  const start = points[0];
  const end = points[points.length - 1];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.wrap, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.header,
            {
              borderBottomColor: colors.divider,
              padding: spacing.md,
              paddingTop: spacing.md + insets.top,
            },
          ]}
        >
          <Pressable accessibilityRole="button" onPress={onClose} hitSlop={10}>
            <AppIcon name="x" size={22} color={colors.textPrimary} />
          </Pressable>
          <Text variant="title" numberOfLines={1} style={styles.headerTitle}>
            접근로
          </Text>
          <View style={styles.spacer} />
        </View>

        <View style={styles.flex}>
          {load.state === 'ready' ? (
            <MapView
              ref={mapRef}
              provider={MAP_PROVIDER}
              style={StyleSheet.absoluteFill}
              initialRegion={
                start
                  ? {
                      latitude: start.latitude,
                      longitude: start.longitude,
                      latitudeDelta: 0.01,
                      longitudeDelta: 0.01,
                    }
                  : DEFAULT_REGION
              }
              showsUserLocation
              showsMyLocationButton
              onMapReady={() => fit(points)}
            >
              {/*
                흰 테두리를 깔고 그 위에 색 선을 덧그린다.
                위성/등고선 배경에서 한 겹만 그리면 지형에 묻혀 잘 안 보인다.
              */}
              <Polyline coordinates={points} strokeColor="#ffffff" strokeWidth={8} />
              <Polyline coordinates={points} strokeColor={colors.primary} strokeWidth={4} />

              {start ? (
                <Marker coordinate={start} title="출발" anchor={{ x: 0.5, y: 0.5 }}>
                  <View style={[styles.dot, { backgroundColor: '#2e9e4f' }]} />
                </Marker>
              ) : null}
              {end && points.length > 1 ? (
                <Marker coordinate={end} title="도착" anchor={{ x: 0.5, y: 0.5 }}>
                  <View style={[styles.dot, { backgroundColor: '#e03131' }]} />
                </Marker>
              ) : null}
              {routeCoord ? (
                <Marker coordinate={routeCoord} title={title ?? '루트'} anchor={{ x: 0.5, y: 0.5 }}>
                  <View style={[styles.dot, styles.routeDot, { backgroundColor: colors.primary }]} />
                </Marker>
              ) : null}
            </MapView>
          ) : (
            <View style={styles.center}>
              {load.state === 'loading' ? (
                <>
                  <ActivityIndicator color={colors.primary} />
                  <Text variant="caption" color="textSecondary" style={styles.centerText}>
                    접근로를 불러오는 중…
                  </Text>
                </>
              ) : (
                <Text variant="body" color="textSecondary" style={styles.centerText}>
                  {load.message}
                </Text>
              )}
            </View>
          )}
        </View>

        {load.state === 'ready' && points.length > 1 ? (
          <View
            style={[
              styles.footer,
              { backgroundColor: colors.surface, borderTopColor: colors.divider, padding: spacing.md },
            ]}
          >
            <Text variant="label">
              총 거리 {trackLengthLabel(points)} · 지점 {points.length}개
            </Text>
            <Text variant="caption" color="textSecondary" style={{ marginTop: 2 }}>
              초록 = 출발, 빨강 = 도착. 실제 등반 접근로는 현장 상황에 따라 다를 수 있습니다.
            </Text>
          </View>
        ) : null}
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
  headerTitle: { flex: 1, textAlign: 'center' },
  spacer: { width: 22 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerText: { marginTop: 8, textAlign: 'center', paddingHorizontal: 24 },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2.5,
    borderColor: '#ffffff',
  },
  routeDot: { width: 18, height: 18, borderRadius: 9 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth },
});
