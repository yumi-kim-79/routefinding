/**
 * 가장 가까운 "차가 다니는 도로" 지점 찾기.
 *
 * ⚠️ 왜 필요한가 (2026-08-13 사용자 보고)
 *   이 앱의 마커는 대부분 **길이 없는 산속 자연암벽**이다.
 *   그 좌표를 그대로 목적지로 넘기면 지도 앱이 경로를 만들지 못해
 *   오류가 나거나 그대로 종료된다.
 *   → 길안내는 **인근 도로까지만** 하고, 거기서 루트까지는 걸어서 접근한다.
 *
 * 조회 방식: 공개 OSRM `nearest` 서비스 (OpenStreetMap 기반).
 *   - API 키·비용 없음
 *   - `driving` 프로파일이라 **등산로·보행로는 제외**되고 차량 통행 가능한 길만 나온다
 *   - 공용 서버라 느리거나 실패할 수 있다 → 타임아웃 + null 반환.
 *     실패 시 호출부가 "지도에 핀만 표시"로 폴백한다 (사용자 결정 2026-08-13)
 *
 * ⚠️ 이 값은 참고용이다. OSM 데이터에 없는 임도·사유지 진입로가 있을 수 있고,
 *    반대로 지도에 있어도 실제로는 막혀 있을 수 있다. 현장 판단이 우선이다.
 */

export interface NearestRoad {
  latitude: number;
  longitude: number;
  /** 원래 좌표에서 이 도로 지점까지의 직선 거리(m) */
  distanceM: number;
}

/** 공개 데모 서버. SLA가 없으므로 실패를 정상 경로로 취급한다 */
const OSRM_ENDPOINT = 'https://router.project-osrm.org/nearest/v1/driving';

/** 산속에서 네트워크가 약할 때 사용자를 오래 붙잡지 않는다 */
const TIMEOUT_MS = 6000;

/**
 * 이 거리를 넘으면 "인근 도로"라고 부르기 어렵다.
 * 30km면 사실상 다른 동네 도로로 안내하는 셈이라 차라리 핀 표시가 낫다.
 */
const MAX_REASONABLE_M = 30_000;

/** 같은 루트를 반복해서 눌러도 조회는 한 번만 (좌표 5자리 ≈ 1m 정밀도) */
const cache = new Map<string, NearestRoad | null>();

const cacheKey = (lat: number, lng: number): string =>
  `${lat.toFixed(5)},${lng.toFixed(5)}`;

interface OsrmNearestResponse {
  code?: string;
  waypoints?: Array<{
    /** ⚠️ OSRM은 [경도, 위도] 순서다 — 뒤집으면 엉뚱한 곳으로 안내한다 */
    location?: [number, number];
    distance?: number;
    name?: string;
  }>;
}

/**
 * @returns 찾은 도로 지점, 없거나 조회 실패면 `null`
 *          (에러를 던지지 않는다 — 길찾기는 실패해도 앱이 멈추면 안 된다)
 */
export async function findNearestRoad(
  latitude: number,
  longitude: number,
): Promise<NearestRoad | null> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const key = cacheKey(latitude, longitude);
  const cached = cache.get(key);
  if (cached !== undefined) {
    return cached;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    // OSRM 경로 파라미터는 {경도},{위도} 순서
    const url = `${OSRM_ENDPOINT}/${longitude},${latitude}?number=1`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      cache.set(key, null);
      return null;
    }

    const json = (await res.json()) as OsrmNearestResponse;
    const wp = json.code === 'Ok' ? json.waypoints?.[0] : undefined;
    const loc = wp?.location;

    if (!loc || loc.length < 2) {
      cache.set(key, null);
      return null;
    }

    const [lng, lat] = loc;
    const distanceM = typeof wp?.distance === 'number' ? wp.distance : 0;

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      distanceM > MAX_REASONABLE_M
    ) {
      cache.set(key, null);
      return null;
    }

    const result: NearestRoad = { latitude: lat, longitude: lng, distanceM };
    cache.set(key, result);
    return result;
  } catch {
    // 타임아웃·오프라인·서버 장애 — 전부 "못 찾음"으로 본다.
    // ⚠️ 캐시에 넣지 않는다. 네트워크가 돌아오면 다시 시도할 수 있어야 한다.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** "1.2km" / "350m" — 사용자에게 보여줄 거리 문구 */
export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)}km`;
  }
  return `${Math.round(meters)}m`;
}
