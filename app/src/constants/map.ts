/**
 * 지도 상수 — 마커 기하 실측값 + 기본 지도 설정.
 *
 * ⚠️ 마커 기하는 **추측이 아니라 PNG 알파 채널 실측값**이다 (웹 MapView.vue와 동일 값).
 *    측정: 알파 > 20인 픽셀의 최하단 = 핀 끝, 몸통 안쪽 투명 픽셀 무게중심 = 구멍 중심.
 *
 *    | 아이콘             | 핀 끝 비율 | 구멍(숫자 자리) 중심 비율 |
 *    |--------------------|-----------|---------------------------|
 *    | lead_marker        | 0.8300    | 0.4037                    |
 *    | bouldering_marker  | 0.8450    | 0.4233                    |
 *
 *    마커 PNG(200x200)는 아래쪽에 투명 여백이 있어서, 기본 anchor(하단 중앙)를 쓰면
 *    핀 끝이 실제 좌표보다 위에 찍힌다(= 마커가 아래로 밀려 보인다).
 *
 *    웹은 픽셀로 계산했지만 react-native-maps의 `anchor`는 **0~1 비율**을 그대로 받으므로
 *    실측값을 변환 없이 쓴다:  anchor={{ x: 0.5, y: tipRatio }}
 */
import { PROVIDER_GOOGLE } from 'react-native-maps';
import type { ImageSourcePropType } from 'react-native';
import type { ConceptType } from '../types/concept';

export interface MarkerGeometry {
  source: ImageSourcePropType;
  /** 핀 끝 y / 이미지 높이 → anchor 계산 */
  tipRatio: number;
  /** 구멍(숫자 자리) 중심 y / 이미지 높이 → 숫자 위치 계산 */
  holeRatio: number;
}

export const MARKER_GEOMETRY: Record<ConceptType, MarkerGeometry> = {
  '리드': {
    source: require('../assets/icons/lead_marker.png'),
    tipRatio: 0.83,
    holeRatio: 0.4037,
  },
  '볼더링': {
    source: require('../assets/icons/bouldering_marker.png'),
    tipRatio: 0.845,
    holeRatio: 0.4233,
  },
};

/** 단일 마커 표시 크기 (정사각) — 웹 SINGLE_PIN과 동일 */
export const SINGLE_PIN = 40;
/** 클러스터 핀 가로/세로 — 웹 CLUSTER_PIN_W/H와 동일 */
export const CLUSTER_PIN_W = 52;
export const CLUSTER_PIN_H = 60;

/**
 * 지도 제공자.
 *
 * iOS 기본값은 애플 지도지만, 웹·안드로이드와 **같은 지도**를 보여주기 위해 구글로 고정한다
 * (사용자 결정 2026-08-04). iOS는 `ios/Podfile`의 `react-native-maps/Google` pod과
 * AppDelegate의 `[GMSServices provideAPIKey:]`가 함께 있어야 동작한다.
 *
 * 되돌리려면 이 상수를 `undefined`로 두고 Podfile의 해당 pod 줄을 지운 뒤 `pod install`.
 */
export const MAP_PROVIDER = PROVIDER_GOOGLE;

/** 초기 화면 (웹과 동일: 서울 중심, zoom 11 상당) */
export const DEFAULT_REGION = {
  latitude: 37.5665,
  longitude: 126.978,
  latitudeDelta: 0.45,
  longitudeDelta: 0.45,
};

/** '내 위치' 이동 시 확대 정도 (웹 zoom 15 상당) */
export const MY_LOCATION_DELTA = 0.02;

/** 클러스터 그룹핑 좌표 반올림 자릿수 — 웹 `toFixed(5)`와 동일해야 결과가 같다 */
export const CLUSTER_PRECISION = 5;

/**
 * 한 번에 그리는 마커 상한.
 *
 * ⚠️ 웹에는 없는 제한이다. 승인 루트가 5,407건이라 필터 없이 열면 마커가 수천 개가 되는데,
 *    브라우저의 Google Maps JS와 달리 RN 마커는 각각이 네이티브 뷰라 그대로 그리면
 *    스크롤이 멈추거나 앱이 죽는다. 상한을 넘으면 화면에 안내를 띄우고 검색을 유도한다.
 *    [QUESTION] 실기기에서 체감 확인 후 값 조정 또는 뷰포트 기반 로딩으로 전환 검토.
 */
export const MAX_MARKERS = 400;
