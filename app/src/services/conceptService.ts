/**
 * 개념도 조회 서비스.
 *
 * CLAUDE.md 원칙: 비용 발생(Firestore 읽기) 호출은 service 모듈로 격리하고,
 * 자주 안 바뀌는 데이터는 캐싱한다(자연암벽 = 네트워크 불안정).
 *
 * 쿼리 설계:
 *   - 두 컬렉션(`route_reports`, `bouldering_reports`)에서 `status == 'approved'` 단일 조건만 사용.
 *     → 복합 색인 불필요. 등반지/구역/검색어 필터는 전부 **클라이언트에서** 처리한다
 *       (리뉴얼 목표: 드롭다운 없이 검색 한 줄).
 *   - 한쪽 컬렉션 조회가 실패해도(권한/색인) 나머지는 그대로 보여준다.
 *
 * ⚠️ 현재 `firestore.rules`에는 `bouldering_reports` 규칙이 없어(§9 전면 차단에 걸림)
 *    볼더링 조회가 permission-denied로 실패할 수 있다. 규칙 추가는 별도 PR + 사용자 승인 필요
 *    (CLAUDE.md: Firestore Rules 변경은 별도 PR). 그래서 여기서는 실패를 삼키고 경고만 남긴다.
 */
import {
  collection,
  getDocs,
  query,
  where,
} from '@react-native-firebase/firestore';
import { db } from './firebase';
import type { Concept, ConceptSource, ConceptType } from '../types/concept';

/** 조회 결과 — 부분 실패를 호출부가 알 수 있게 warnings를 함께 돌려준다 */
export interface ConceptFetchResult {
  items: Concept[];
  /** 일부 컬렉션 조회 실패 메시지 (전부 실패면 items가 비고 warnings가 2건) */
  warnings: string[];
}

type RawDoc = Record<string, unknown>;

const SOURCES: ReadonlyArray<{ source: ConceptSource; fallback: ConceptType }> =
  [
    { source: 'route_reports', fallback: '리드' },
    { source: 'bouldering_reports', fallback: '볼더링' },
  ];

/** 캐시 TTL — 개념도는 자주 안 바뀐다. 강제 새로고침은 refresh=true */
const CACHE_TTL_MS = 5 * 60 * 1000;

let cache: { at: number; result: ConceptFetchResult } | null = null;

function toConcept(
  id: string,
  data: RawDoc,
  source: ConceptSource,
  fallbackType: ConceptType,
): Concept {
  const typeRoot = data.typeRoot;
  const type: ConceptType =
    typeRoot === '리드' || typeRoot === '볼더링' ? typeRoot : fallbackType;

  // 스프레드로 통째로 받되 id/source/type은 우리가 확정한 값으로 덮어쓴다.
  return {
    ...(data as Omit<Concept, 'id' | 'source' | 'type'>),
    id,
    source,
    type,
  };
}

async function fetchOne(
  source: ConceptSource,
  fallbackType: ConceptType,
): Promise<Concept[]> {
  const q = query(collection(db, source), where('status', '==', 'approved'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toConcept(d.id, d.data() as RawDoc, source, fallbackType));
}

/**
 * 승인된 개념도 전체 조회 (두 컬렉션 병합).
 * @param refresh true면 캐시를 무시하고 다시 읽는다 (당겨서 새로고침).
 */
export async function fetchConcepts(refresh = false): Promise<ConceptFetchResult> {
  if (!refresh && cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.result;
  }

  const settled = await Promise.allSettled(
    SOURCES.map(({ source, fallback }) => fetchOne(source, fallback)),
  );

  const items: Concept[] = [];
  const warnings: string[] = [];

  settled.forEach((r, i) => {
    const { source } = SOURCES[i];
    if (r.status === 'fulfilled') {
      items.push(...r.value);
    } else {
      const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
      // eslint-disable-next-line no-console
      console.warn(`[conceptService] ${source} 조회 실패:`, msg);
      warnings.push(`${source} 조회 실패: ${msg}`);
    }
  });

  // 최신 작성순 (v1 실측 필드명 `timestamp`)
  items.sort(
    (a, b) => (b.timestamp?.toMillis() ?? 0) - (a.timestamp?.toMillis() ?? 0),
  );

  const result: ConceptFetchResult = { items, warnings };
  cache = { at: Date.now(), result };
  return result;
}

/** 로그아웃/데이터 변경 후 캐시 무효화 */
export function clearConceptCache(): void {
  cache = null;
}
