/**
 * 외부 지도 앱으로 위치 열기 / 길안내.
 *
 * ⚠️ App Store 심사 대응 (2026-08-12 반려, Guideline 4 - Design)
 *   > "The app's location feature is not integrated with the built-in mapping
 *   >  functionality, which limits users to a third-party maps app."
 *   > Next Steps: "revise the app to give users the option to launch the
 *   >  native Apple Maps app."
 *
 *   앱 안의 지도는 웹·안드로이드와 통일하기 위해 구글을 쓴다(constants/map.ts).
 *   그래서 iOS 사용자에게는 **네이티브 Apple 지도를 여는 선택지**를 반드시 줘야 한다.
 *   이 모듈이 그 선택지를 담당한다. → **이 파일과 길찾기 버튼들을 지우면 다시 반려된다.**
 *
 * ⚠️ 목적지는 루트 좌표가 아니라 **인근 도로**다 (2026-08-13 사용자 보고)
 *   마커 대부분이 길 없는 산속이라 루트 좌표를 그대로 넘기면 지도 앱이
 *   경로를 만들지 못하고 오류가 나거나 종료된다.
 *   → `openTrailheadDirections()` 가 `services/nearestRoad.ts` 로 도로 지점을 찾아
 *     거기까지만 안내한다. 나머지는 걸어서 접근.
 *
 * 동작:
 *   iOS      — Apple 지도 / (설치돼 있으면) Google 지도 중 선택하는 액션시트
 *   Android  — https 지도 링크(구글 지도 앱 없으면 브라우저가 받는다) → 실패 시 `geo:`
 */
import { ActionSheetIOS, Alert, Linking, Platform } from 'react-native';
import { findNearestRoad, formatDistance } from '../services/nearestRoad';

/** 좌표 + 표시할 이름 */
export interface MapTarget {
  latitude: number;
  longitude: number;
  /** 지도 앱에 표시될 장소명 (예: "북한산 인수봉 · 서면슬랩") */
  label?: string;
}

/**
 * `directions` — 길안내(경로 계산). 목적지가 도로 위에 있어야 안전하다.
 * `pin`        — 위치만 핀으로 표시. 경로 계산이 없어 **절대 실패하지 않는다.**
 */
export type MapMode = 'directions' | 'pin';

/** 도로에서 이만큼 이상 떨어져 있으면 "걸어야 한다"고 미리 알린다 */
const WARN_DISTANCE_M = 300;

// ── URL 빌더 ────────────────────────────────────────────────────────────────

/** Apple 지도 — 목적지로 길안내. dirflg=d = 자동차 */
function appleDirUrl({ latitude, longitude, label }: MapTarget): string {
  const q = label ? `&q=${encodeURIComponent(label)}` : '';
  return `http://maps.apple.com/?daddr=${latitude},${longitude}${q}&dirflg=d`;
}

/** Apple 지도 — 핀만 표시 */
function applePinUrl({ latitude, longitude, label }: MapTarget): string {
  const q = encodeURIComponent(label ?? `${latitude},${longitude}`);
  return `http://maps.apple.com/?ll=${latitude},${longitude}&q=${q}`;
}

/** Google 지도 앱 (iOS 전용 스킴) — 길안내 */
function googleAppDirUrl({ latitude, longitude }: MapTarget): string {
  return `comgooglemaps://?daddr=${latitude},${longitude}&directionsmode=driving`;
}

/** Google 지도 앱 (iOS 전용 스킴) — 핀만 표시 */
function googleAppPinUrl({ latitude, longitude }: MapTarget): string {
  return `comgooglemaps://?center=${latitude},${longitude}&q=${latitude},${longitude}&zoom=15`;
}

/**
 * Google 지도 웹/앱 공용 https 링크.
 * ⚠️ 안드로이드에서 이걸 1순위로 쓰는 이유: https는 구글 지도 앱이 없거나
 *    `stopped` 상태여도 **브라우저가 반드시 받아 준다** = 막다른 길이 없다.
 *    (2026-08-12 "구글지도가 설치되어 있지 않거나 중지되었습니다" 신고의 교훈)
 */
function googleWebDirUrl({ latitude, longitude }: MapTarget): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;
}

function googleWebPinUrl({ latitude, longitude }: MapTarget): string {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

/** Android 기본 지도 앱 — 핀 표시 */
function geoUrl({ latitude, longitude, label }: MapTarget): string {
  const q = label
    ? `${latitude},${longitude}(${encodeURIComponent(label)})`
    : `${latitude},${longitude}`;
  return `geo:${latitude},${longitude}?q=${q}`;
}

// ── 열기 ────────────────────────────────────────────────────────────────────

async function open(url: string, fallback?: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch {
    if (fallback) {
      await Linking.openURL(fallback).catch(() => {
        Alert.alert('오류', '지도 앱을 열 수 없습니다.');
      });
    } else {
      Alert.alert('오류', '지도 앱을 열 수 없습니다.');
    }
  }
}

/**
 * 좌표를 외부 지도로 연다.
 * iOS에서는 Apple 지도를 **항상 첫 번째 선택지**로 제시한다(심사 요구사항).
 *
 * ⚠️ `mode: 'directions'` 는 목적지가 **도로 위**라고 가정한다.
 *    산속 좌표를 그대로 넘기지 말 것 — `openTrailheadDirections()` 를 쓴다.
 */
export async function openExternalMap(
  target: MapTarget,
  mode: MapMode = 'directions',
): Promise<void> {
  if (!Number.isFinite(target.latitude) || !Number.isFinite(target.longitude)) {
    Alert.alert('길찾기', '이 루트에는 좌표 정보가 없습니다.');
    return;
  }

  if (Platform.OS === 'ios') {
    // Google 지도 앱이 깔려 있을 때만 선택지에 넣는다
    // (Info.plist의 LSApplicationQueriesSchemes에 comgooglemaps가 있어야 조회된다)
    const hasGoogle = await Linking.canOpenURL('comgooglemaps://').catch(
      () => false,
    );

    const options = hasGoogle
      ? ['Apple 지도', 'Google 지도', '취소']
      : ['Apple 지도', '취소'];

    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: target.label ?? (mode === 'pin' ? '위치 보기' : '길찾기'),
        message: '어떤 지도 앱으로 열까요?',
        options,
        cancelButtonIndex: options.length - 1,
      },
      (index) => {
        if (index === 0) {
          void open(mode === 'pin' ? applePinUrl(target) : appleDirUrl(target));
        } else if (hasGoogle && index === 1) {
          void open(
            mode === 'pin' ? googleAppPinUrl(target) : googleAppDirUrl(target),
            mode === 'pin' ? googleWebPinUrl(target) : googleWebDirUrl(target),
          );
        }
      },
    );
    return;
  }

  // Android
  if (mode === 'pin') {
    await open(geoUrl(target), googleWebPinUrl(target));
  } else {
    await open(googleWebDirUrl(target), geoUrl(target));
  }
}

/**
 * **길안내 진입점 — 화면에서는 이걸 쓴다.**
 *
 * 루트 좌표에서 가장 가까운 차량 통행 도로를 찾아 **거기까지만** 안내한다.
 * 도로를 못 찾거나 조회에 실패하면 길안내 대신 **핀 표시**로 폴백한다
 * (사용자 결정 2026-08-13 — 지도 앱이 경로를 못 만들어 죽는 것보다 낫다).
 */
export async function openTrailheadDirections(target: MapTarget): Promise<void> {
  if (!Number.isFinite(target.latitude) || !Number.isFinite(target.longitude)) {
    Alert.alert('길찾기', '이 루트에는 좌표 정보가 없습니다.');
    return;
  }

  const road = await findNearestRoad(target.latitude, target.longitude);

  if (!road) {
    Alert.alert(
      '길찾기',
      '차로 갈 수 있는 도로를 찾지 못했습니다.\n' +
        '길안내 대신 루트 위치를 지도에 표시할까요?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '지도에서 보기',
          onPress: () => {
            void openExternalMap(target, 'pin');
          },
        },
      ],
    );
    return;
  }

  const roadTarget: MapTarget = {
    latitude: road.latitude,
    longitude: road.longitude,
    label: `${target.label ?? '루트'} 인근 도로`,
  };

  // 도로가 코앞이면 굳이 한 번 더 묻지 않는다
  if (road.distanceM < WARN_DISTANCE_M) {
    await openExternalMap(roadTarget, 'directions');
    return;
  }

  Alert.alert(
    '인근 도로까지 길안내',
    `${target.label ?? '이 루트'}는 도로에서 직선거리로 약 ` +
      `${formatDistance(road.distanceM)} 떨어져 있습니다.\n\n` +
      '차로 갈 수 있는 가장 가까운 도로까지만 안내합니다. ' +
      '그 뒤로는 걸어서 접근해야 하며, 실제 접근로는 지형에 따라 더 길 수 있습니다.',
    [
      { text: '취소', style: 'cancel' },
      {
        text: '길안내 시작',
        onPress: () => {
          void openExternalMap(roadTarget, 'directions');
        },
      },
    ],
  );
}

/** 문자열/숫자로 섞여 저장된 좌표를 안전하게 숫자로 (Firestore 실측: 둘 다 존재) */
export function toMapTarget(
  latitude: number | string | undefined,
  longitude: number | string | undefined,
  label?: string,
): MapTarget | null {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  if (lat === 0 && lng === 0) {
    return null;
  }
  return { latitude: lat, longitude: lng, label };
}
