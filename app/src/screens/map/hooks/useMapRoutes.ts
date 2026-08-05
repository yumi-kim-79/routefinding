/**
 * 지도 탭 데이터·필터·클러스터링 훅.
 *
 * 화면(MapScreen)은 표시에만 집중하고 로딩/필터/그룹핑은 여기에 모은다
 * (CLAUDE.md 갓 파일 분해 원칙).
 *
 * ── 웹(MapView.vue)과 다른 점 · 이유 (사용자 승인 2026-08-04) ──────────────
 * 웹은 타입(리드/볼더링)을 바꿀 때마다 해당 컬렉션을 `onSnapshot`으로 다시 구독한다.
 * 앱은 **기존 `conceptService.fetchConcepts()`를 그대로 재사용**한다:
 *   - 두 컬렉션을 한 번에 병합해 5분 TTL 캐시 → 개념도 탭과 **캐시 공유**
 *   - 리드↔볼더링 칩 전환이 재조회 없이 즉시 (산속 네트워크 고려)
 * 데이터 출처·필터 조건은 웹과 동일하므로 보이는 결과는 같다.
 * ────────────────────────────────────────────────────────────────────────
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchConcepts,
  subscribeConceptsUpdate,
} from '../../../services/conceptService';
import type { Concept, ConceptType } from '../../../types/concept';
import { CLUSTER_RADIUS_M, MAX_MARKERS } from '../../../constants/map';

/** 같은 좌표에 모인 루트 묶음 (웹의 clusters 객체와 동일 개념) */
export interface RouteCluster {
  /** "위도,경도" 반올림 키 */
  key: string;
  latitude: number;
  longitude: number;
  routes: Concept[];
}

export interface UseMapRoutesResult {
  type: ConceptType;
  setType: (t: ConceptType) => void;
  mountain: string;
  setMountain: (m: string) => void;
  zone: string;
  setZone: (z: string) => void;
  keyword: string;
  setKeyword: (k: string) => void;

  /** 선택된 타입에 존재하는 등반지 목록 */
  mountainList: string[];
  /** 선택된 등반지의 구역 목록 (등반지 미선택이면 빈 배열) */
  zoneList: string[];

  /** 실제로 그릴 클러스터 (MAX_MARKERS 적용 후) */
  clusters: RouteCluster[];
  /** 상한 적용 전 전체 클러스터 수 */
  totalClusters: number;
  /** 상한에 걸려 잘렸는지 */
  truncated: boolean;
  /** 좌표가 있는 루트 수 (필터 적용 후) */
  visibleRouteCount: number;

  loading: boolean;
  refreshing: boolean;
  refresh: () => void;
  error: string | null;
  warnings: string[];
}

/**
 * 좌표 정규화. 문서에 문자열로 저장된 경우가 있어 Number 변환이 필요하다.
 * 0 / NaN / 빈값은 '좌표 없음'으로 본다 (웹 `if (!r.latitude || !r.longitude) return`과 동일).
 */
function toCoord(v: number | string | undefined): number | null {
  if (v === undefined || v === null || v === '') {
    return null;
  }
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n !== 0 ? n : null;
}

export function useMapRoutes(): UseMapRoutesResult {
  const [items, setItems] = useState<Concept[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [type, setTypeState] = useState<ConceptType>('리드');
  const [mountain, setMountainState] = useState('');
  const [zone, setZone] = useState('');
  const [keyword, setKeyword] = useState('');

  const load = useCallback(async (forceRefresh: boolean) => {
    try {
      const res = await fetchConcepts(forceRefresh);
      setItems(res.items);
      setWarnings(res.warnings);
      setError(
        res.items.length === 0 && res.warnings.length >= 2
          ? res.warnings.join('\n')
          : null,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : '지도 데이터를 불러오지 못했습니다.');
      setItems([]);
    }
  }, []);

  /**
   * 로컬 캐시로 먼저 그린 뒤, 서버 갱신이 끝나면 조용히 반영한다
   * (conceptService의 stale-while-revalidate — 시작 속도 개선, 2026-08-05).
   */
  useEffect(
    () =>
      subscribeConceptsUpdate((res) => {
        setItems(res.items);
        setWarnings(res.warnings);
      }),
    [],
  );

  // 지도 탭은 열자마자 분포를 보여줘야 하므로 진입 시 1회 로드.
  // (개념도 탭과 달리 '검색 전 조회 0' 정책을 쓰지 않는다 — 캐시를 공유하므로
  //  개념도를 먼저 썼다면 추가 읽기는 발생하지 않는다)
  useEffect(() => {
    setLoading(true);
    void load(false).finally(() => setLoading(false));
  }, [load]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    void load(true).finally(() => setRefreshing(false));
  }, [load]);

  /** 타입 변경 시 하위 필터 초기화 (웹 changeType과 동일) */
  const setType = useCallback((t: ConceptType) => {
    setTypeState((prev) => {
      if (prev === t) {
        return prev;
      }
      setMountainState('');
      setZone('');
      setKeyword('');
      return t;
    });
  }, []);

  /** 등반지 변경 시 구역 초기화 (웹 onMountainChange와 동일) */
  const setMountain = useCallback((m: string) => {
    setMountainState(m);
    setZone('');
  }, []);

  const byType = useMemo(
    () => items.filter((c) => c.type === type),
    [items, type],
  );

  const mountainList = useMemo(() => {
    const set = new Set<string>();
    byType.forEach((c) => {
      const m = c.mountain?.trim();
      if (m) {
        set.add(m);
      }
    });
    return Array.from(set).sort();
  }, [byType]);

  const zoneList = useMemo(() => {
    if (!mountain) {
      return [];
    }
    const set = new Set<string>();
    byType.forEach((c) => {
      if (c.mountain === mountain && c.zone) {
        set.add(c.zone);
      }
    });
    return Array.from(set).sort();
  }, [byType, mountain]);

  /** 등반지 → 구역 → 검색어 순서로 좁힌다 (웹 filterRoutes와 동일) */
  const filtered = useMemo(() => {
    let data = byType;
    if (mountain) {
      data = data.filter((c) => c.mountain === mountain);
      if (zone) {
        data = data.filter((c) => c.zone === zone);
      }
    }
    const q = keyword.trim().toLowerCase();
    if (q) {
      data = data.filter(
        (c) =>
          (c.mountain?.toLowerCase().includes(q) ?? false) ||
          (c.zone?.toLowerCase().includes(q) ?? false) ||
          (c.routeName?.toLowerCase().includes(q) ?? false),
      );
    }
    return data;
  }, [byType, mountain, zone, keyword]);

  /**
   * 가까운 루트끼리 묶기 (거리 기준).
   *
   * 격자 반올림(웹 방식)은 경계에 걸친 두 점이 갈라지는 문제가 있어 거리로 묶는다.
   * 전량 비교는 O(n²)라 5,000건에서 버티지 못하므로,
   * **성긴 격자로 후보를 좁힌 뒤 이웃 칸만 거리 비교**한다(격자 한 칸 ≈ 클러스터 반경).
   */
  const allClusters = useMemo(() => {
    // 위도 1도 ≈ 111km. 경도는 위도에 따라 줄지만 한국 위도(≈37°)에서 상수로 봐도 오차가 작다
    const degLat = CLUSTER_RADIUS_M / 111_320;
    const degLng = CLUSTER_RADIUS_M / (111_320 * Math.cos((37.5 * Math.PI) / 180));

    const buckets = new Map<string, RouteCluster[]>();
    const clusters: RouteCluster[] = [];

    const bucketKey = (lat: number, lng: number): string =>
      `${Math.floor(lat / degLat)}:${Math.floor(lng / degLng)}`;

    filtered.forEach((c) => {
      const lat = toCoord(c.latitude);
      const lng = toCoord(c.longitude);
      if (lat === null || lng === null) {
        return;
      }

      const bx = Math.floor(lat / degLat);
      const by = Math.floor(lng / degLng);

      // 자기 칸 + 인접 8칸에서만 후보를 찾는다 (경계에 걸쳐도 놓치지 않는다)
      let target: RouteCluster | undefined;
      for (let dx = -1; dx <= 1 && !target; dx += 1) {
        for (let dy = -1; dy <= 1 && !target; dy += 1) {
          const list = buckets.get(`${bx + dx}:${by + dy}`);
          if (!list) {
            continue;
          }
          target = list.find(
            (cl) =>
              Math.abs(cl.latitude - lat) <= degLat && Math.abs(cl.longitude - lng) <= degLng,
          );
        }
      }

      if (target) {
        target.routes.push(c);
        return;
      }
      const created: RouteCluster = {
        // 첫 루트의 좌표를 대표로 쓴다 (평균을 내면 묶일수록 기준점이 흔들린다)
        key: `${lat.toFixed(6)},${lng.toFixed(6)}`,
        latitude: lat,
        longitude: lng,
        routes: [c],
      };
      clusters.push(created);
      const k = bucketKey(lat, lng);
      const list = buckets.get(k);
      if (list) {
        list.push(created);
      } else {
        buckets.set(k, [created]);
      }
    });

    return clusters;
  }, [filtered]);

  // 상한 적용: 루트가 많이 모인 곳부터 남긴다 (잘리더라도 중요한 군집이 보이도록)
  const clusters = useMemo(() => {
    if (allClusters.length <= MAX_MARKERS) {
      return allClusters;
    }
    return [...allClusters]
      .sort((a, b) => b.routes.length - a.routes.length)
      .slice(0, MAX_MARKERS);
  }, [allClusters]);

  const visibleRouteCount = useMemo(
    () => allClusters.reduce((sum, c) => sum + c.routes.length, 0),
    [allClusters],
  );

  return {
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
    totalClusters: allClusters.length,
    truncated: allClusters.length > MAX_MARKERS,
    visibleRouteCount,
    loading,
    refreshing,
    refresh,
    error,
    warnings,
  };
}
