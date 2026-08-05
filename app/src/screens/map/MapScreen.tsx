/**
 * 지도 탭 — 웹 MapView.vue 이식 (v1 map_screen.dart 대체).
 *
 * 데이터·필터·클러스터링은 `hooks/useMapRoutes.ts`, 표시는 이 파일과 `components/`가 맡는다
 * (CLAUDE.md 갓 파일 분해 원칙).
 *
 * ── 웹과 맞춘 것 ─────────────────────────────────────────────────────────
 *  - 마커 앵커: PNG 알파 실측 비율(tipRatio) 그대로 → 핀 끝이 실제 좌표에 온다
 *  - 클러스터: 좌표 소수점 5자리 반올림 그룹핑 (웹 toFixed(5)와 동일)
 *  - 필터 순서: 타입 → 등반지 → 구역 → 검색어
 *  - 마커가 있으면 첫 군집으로 지도 중심 이동
 *
 * ── 웹과 다른 것 · 이유 ──────────────────────────────────────────────────
 *  - 데이터: conceptService 캐시 재사용 (개념도 탭과 공유, 칩 전환 시 재조회 없음)
 *  - 등반지/구역 선택: `<select>` 대신 자체 모달 (iOS/Android가 같아 보이도록)
 *  - 마커 상한 MAX_MARKERS: RN 마커는 네이티브 뷰라 수천 개를 그리면 앱이 멈춘다
 *  - 위치: 별도 geolocation 라이브러리를 넣지 않고 지도의 onUserLocationChange를 쓴다
 *    (네이티브 의존성 추가 최소화 — 산속 사용 환경에서 검증할 표면을 줄인다)
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  PermissionsAndroid,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import MapView, {
  type Region,
  type UserLocationChangeEvent,
} from 'react-native-maps';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Text } from '../../components/common/Text';
import { useTheme } from '../../theme';
import type { MainStackParamList } from '../../navigation/types';
import type { Concept } from '../../types/concept';
import { DEFAULT_REGION, MAP_PROVIDER, MY_LOCATION_DELTA } from '../../constants/map';
import { useMapRoutes, type RouteCluster } from './hooks/useMapRoutes';
import { MapFilterBar } from './components/MapFilterBar';
import { RouteMarker } from './components/RouteMarker';
import { RouteDetailSheet } from './components/RouteDetailSheet';
import { AdBanner } from '../../components/common/AdBanner';
import { ClusterListModal } from './components/ClusterListModal';

type Nav = NativeStackNavigationProp<MainStackParamList>;

interface Coord {
  latitude: number;
  longitude: number;
}

export const MapScreen: React.FC = () => {
  const { colors, spacing, radius } = useTheme();
  const navigation = useNavigation<Nav>();
  const mapRef = useRef<MapView | null>(null);

  const {
    type,
    setType,
    mountain,
    setMountain,
    zone,
    setZone,
    keyword,
    setKeyword,
    mountainList,
    zoneList,
    clusters,
    totalClusters,
    truncated,
    visibleRouteCount,
    loading,
    error,
  } = useMapRoutes();

  const [selected, setSelected] = useState<Concept | null>(null);
  const [clusterRoutes, setClusterRoutes] = useState<Concept[] | null>(null);
  const [myLocation, setMyLocation] = useState<Coord | null>(null);
  const [locationAllowed, setLocationAllowed] = useState(Platform.OS === 'ios');

  /**
   * 위치 권한.
   * iOS는 지도 SDK가 Info.plist 문구로 시스템 팝업을 띄우므로 별도 요청이 필요 없다.
   * Android는 런타임 권한을 직접 요청해야 `showsUserLocation`이 동작한다.
   */
  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }
    void PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ).then((res) => setLocationAllowed(res === PermissionsAndroid.RESULTS.GRANTED));
  }, []);

  /** 필터가 바뀌었을 때만 첫 군집으로 이동 (사용자가 손으로 옮긴 화면을 뺏지 않도록) */
  const filterSig = `${type}|${mountain}|${zone}|${keyword.trim()}`;
  const lastSigRef = useRef<string | null>(null);
  useEffect(() => {
    if (clusters.length === 0 || lastSigRef.current === filterSig) {
      return;
    }
    lastSigRef.current = filterSig;
    const first = clusters[0];
    mapRef.current?.animateToRegion(
      {
        latitude: first.latitude,
        longitude: first.longitude,
        latitudeDelta: DEFAULT_REGION.latitudeDelta,
        longitudeDelta: DEFAULT_REGION.longitudeDelta,
      } satisfies Region,
      400,
    );
  }, [clusters, filterSig]);

  const onMarkerPress = useCallback((cluster: RouteCluster) => {
    if (cluster.routes.length === 1) {
      setSelected(cluster.routes[0]);
    } else {
      setClusterRoutes(cluster.routes);
    }
  }, []);

  const openDetail = useCallback(
    (c: Concept) => {
      setSelected(null);
      setClusterRoutes(null);
      navigation.navigate('ConceptDetail', { conceptId: c.id, source: c.source });
    },
    [navigation],
  );

  const goMyLocation = useCallback(() => {
    if (!myLocation) {
      Alert.alert(
        '내 위치를 아직 못 찾았습니다',
        locationAllowed
          ? 'GPS 신호를 잡는 중입니다. 하늘이 트인 곳에서 잠시 후 다시 눌러주세요.'
          : '설정에서 위치 권한을 허용해주세요.',
      );
      return;
    }
    mapRef.current?.animateToRegion(
      {
        ...myLocation,
        latitudeDelta: MY_LOCATION_DELTA,
        longitudeDelta: MY_LOCATION_DELTA,
      } satisfies Region,
      400,
    );
  }, [myLocation, locationAllowed]);

  return (
    <View style={[styles.wrap, { backgroundColor: colors.background }]}>
      <MapFilterBar
        type={type}
        onTypeChange={setType}
        mountain={mountain}
        onMountainChange={setMountain}
        zone={zone}
        onZoneChange={setZone}
        keyword={keyword}
        onKeywordChange={setKeyword}
        mountainList={mountainList}
        zoneList={zoneList}
        onMyLocation={goMyLocation}
      />

      <View style={styles.flex}>
        <MapView
          ref={mapRef}
          provider={MAP_PROVIDER}
          style={StyleSheet.absoluteFill}
          initialRegion={DEFAULT_REGION}
          showsUserLocation={locationAllowed}
          showsMyLocationButton={false}
          onUserLocationChange={(e: UserLocationChangeEvent) => {
            const c = e.nativeEvent.coordinate;
            if (c) {
              setMyLocation({ latitude: c.latitude, longitude: c.longitude });
            }
          }}
        >
          {clusters.map((cluster) => (
            <RouteMarker
              key={cluster.key}
              cluster={cluster}
              type={type}
              onPress={onMarkerPress}
            />
          ))}
        </MapView>

        {loading ? (
          <View style={[styles.badge, styles.center, { backgroundColor: colors.surface, borderRadius: radius.full, padding: spacing.sm }]}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : null}

        {error ? (
          <View style={[styles.notice, { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.sm }]}>
            <Text color="error" variant="caption">
              {error}
            </Text>
          </View>
        ) : truncated ? (
          <Pressable
            style={[styles.notice, { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.sm }]}
          >
            <Text variant="caption" color="textSecondary">
              루트 {visibleRouteCount}개 중 일부만 표시했습니다 (군집 {totalClusters}곳).
              등반지를 고르거나 검색하면 전부 볼 수 있습니다.
            </Text>
          </Pressable>
        ) : null}
      </View>

      <RouteDetailSheet
        concept={selected}
        onClose={() => setSelected(null)}
        onOpenDetail={openDetail}
      />
      <ClusterListModal
        routes={clusterRoutes}
        onClose={() => setClusterRoutes(null)}
        onOpenDetail={openDetail}
      />

      {/* 하단 탭 바로 위 배너 — 지도는 절대배치 위에 있으므로 마지막 자식으로 둔다 */}
      <AdBanner />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 12, alignSelf: 'center' },
  notice: { position: 'absolute', left: 12, right: 12, bottom: 12 },
});
