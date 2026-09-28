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
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Text } from '../../components/common/Text';
import { useTheme } from '../../theme';
import type { MainStackParamList } from '../../navigation/types';
import type { Concept } from '../../types/concept';
import {
  DEFAULT_REGION,
  MAP_PROVIDER,
  MY_LOCATION_DELTA,
  START_NEAR_ME,
} from '../../constants/map';
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
  /*
   * ⚠️ 개념도 상세로 갔다가 **뒤로 돌아왔을 때 보던 목록/카드가 그대로 있어야 한다**
   *    (2026-08-28 사용자 보고: "뒤로가기를 누르면 지도까지 한 번에 나가진다").
   *
   *    예전에는 `openDetail` 이 `setSelected(null)` · `setClusterRoutes(null)` 로
   *    상태를 **지우고** 이동했다. 그래서 돌아오면 빈 지도만 남았다.
   *
   *    그렇다고 상태를 그대로 두면 안 된다 — RN 의 `Modal` 은 **별도 네이티브 창**이라
   *    푸시된 상세 화면 **위에 떠 버린다.**
   *    → 상태는 유지하되, **이 화면이 포커스를 잃으면 렌더만 멈춘다.**
   *      돌아오면 포커스가 살아나면서 보던 그대로 다시 열린다.
   */
  const isFocused = useIsFocused();
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
    onlyFavorites,
    setOnlyFavorites,
    favoriteCount,
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

  /*
   * 첫 진입 시 **내 위치 주변**에서 시작한다 (2026-09-07 요청).
   *
   * ⚠️ 그냥 내 위치로 확대하면 **암장이 하나도 없는 빈 지도**가 되기 쉽다.
   *    가장 가까운 암장이 화면에 들어오도록 배율을 같이 계산한다.
   * ⚠️ 사용자가 이미 지도를 만졌으면 **화면을 뺏지 않는다.**
   * ⚠️ 위치를 못 받는 경우(권한 거부·실내)를 위해 시간 제한을 두고,
   *    지나면 기존 동작(첫 군집으로 이동)으로 넘어간다.
   */
  const startedRef = useRef(false);
  const touchedRef = useRef(false);

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

  /**
   * 내 위치가 잡히면 그 주변으로 (한 번만).
   *
   * 🚨 2026-09-08 수정: 예전에는 4초 안에 위치를 못 받으면 포기하도록 했는데,
   *    **실기기에서 첫 GPS 고정이 4초를 넘는 경우가 훨씬 많아** 사실상 동작하지 않았다
   *    (사용자 보고: "지도는 내 주변에서 시작을 안 하네").
   *    → 시간 제한을 없애고, **사용자가 지도를 만지기 전이라면 언제 도착하든** 옮긴다.
   *    위치가 끝내 안 오면 기본 화면(전국)에 그대로 있는다 — 그게 예측 가능한 동작이다.
   */
  useEffect(() => {
    if (startedRef.current || !myLocation || touchedRef.current) {
      return;
    }
    // 가장 가까운 암장까지의 거리(도 단위 근사)에 맞춰 배율을 잡는다
    let nearest = Number.POSITIVE_INFINITY;
    clusters.forEach((c) => {
      const dLat = c.latitude - myLocation.latitude;
      // 경도는 위도에 따라 실제 거리가 달라진다 — cos 로 보정해야 배율이 안 어긋난다
      const dLng = (c.longitude - myLocation.longitude)
        * Math.cos((myLocation.latitude * Math.PI) / 180);
      nearest = Math.min(nearest, Math.hypot(dLat, dLng));
    });

    const delta = Number.isFinite(nearest)
      ? Math.min(
          START_NEAR_ME.maxDelta,
          Math.max(START_NEAR_ME.minDelta, nearest * START_NEAR_ME.paddingRatio),
        )
      : START_NEAR_ME.minDelta;

    mapRef.current?.animateToRegion(
      {
        ...myLocation,
        latitudeDelta: delta,
        longitudeDelta: delta,
      } satisfies Region,
      500,
    );
    startedRef.current = true;
  }, [myLocation, clusters]);

  /** 필터가 바뀌었을 때만 첫 군집으로 이동 (사용자가 손으로 옮긴 화면을 뺏지 않도록) */
  const filterSig = `${type}|${mountain}|${zone}|${keyword.trim()}`;
  const lastSigRef = useRef<string | null>(null);
  useEffect(() => {
    if (clusters.length === 0 || lastSigRef.current === filterSig) {
      return;
    }
    /*
     * ⚠️ **첫 진입에서는 군집으로 튀지 않는다.**
     *    첫 군집(전국 어딘가)으로 갔다가 내 위치로 다시 가면 화면이 두 번 움직이고,
     *    무엇보다 "내 주변에서 시작"이라는 동작이 깨진다.
     *    필터를 실제로 **바꿨을 때만** 이동한다.
     */
    if (lastSigRef.current === null) {
      lastSigRef.current = filterSig;
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
      // ⚠️ 여기서 상태를 지우지 않는다. 지우면 뒤로 왔을 때 빈 지도만 남는다.
      //    화면이 가려지는 동안에는 아래 `isFocused` 가 렌더를 막아 준다.
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
        onlyFavorites={onlyFavorites}
        onOnlyFavoritesChange={setOnlyFavorites}
        favoriteCount={favoriteCount}
        onMyLocation={goMyLocation}
      />

      <View style={styles.flex}>
        <MapView
          ref={mapRef}
          provider={MAP_PROVIDER}
          /*
            ⚠️ 구글 지도 SDK가 안드로이드에서 그리는 자체 툴바를 끈다.
               마커 선택 시 우하단에 뜨는 '길찾기/열기' 버튼인데, 구글 지도 앱이
               stopped 상태(설치 후 미실행·강제종료)면 인텐트가 전달되지 않아
               "구글지도가 설치되어 있지 않거나 중지되었습니다"로 막다른 길이 된다
               (2026-08-12 사용자 실기기 확인).
               길찾기는 우리 버튼(utils/openExternalMap.ts)으로 일원화한다 —
               앱이 없으면 웹 지도로 폴백하므로 실패하지 않는다.
          */
          toolbarEnabled={false}
          style={StyleSheet.absoluteFill}
          initialRegion={DEFAULT_REGION}
          // 손으로 지도를 옮기기 시작하면 자동 이동을 멈춘다 (화면을 뺏지 않는다)
          onPanDrag={() => {
            touchedRef.current = true;
          }}
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
        ) : onlyFavorites && visibleRouteCount === 0 ? (
          /*
             즐겨찾기만 보기인데 하나도 안 나오는 경우.
             ⚠️ 이유를 말하지 않으면 "즐겨찾기가 지워졌다"로 읽힌다. 실제로는
                ① 타입 칩(리드/볼더링)이 겹치지 않거나 ② 그 루트에 좌표가 없어서다.
                좌표가 없는 제보가 실제로 있다(지도에 못 그린다) — 그래서 둘 다 적는다.
          */
          <View
            style={[styles.notice, { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.sm }]}
          >
            <Text variant="caption" color="textSecondary">
              이 조건에 맞는 즐겨찾기가 없습니다. 위쪽 리드/볼더링 칩을 바꿔 보세요.
              좌표가 없는 루트는 지도에 표시되지 않습니다 — 개념도 탭에서 볼 수 있습니다.
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

      {/*
        `isFocused` 로 감싼 이유는 위 주석 참조 —
        상세 화면 위로 모달이 떠오르는 것을 막으면서 돌아왔을 때 상태를 되살린다.
      */}
      <RouteDetailSheet
        concept={isFocused ? selected : null}
        onClose={() => setSelected(null)}
        onOpenDetail={openDetail}
      />
      <ClusterListModal
        routes={isFocused ? clusterRoutes : null}
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
