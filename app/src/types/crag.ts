/**
 * 암장 정보 — `crags/{cragId}`
 *
 * ⚠️ **루트 문서에 넣지 않는 이유**: 주차·화장실·대중교통은 **암장의 속성**이지
 *    루트의 속성이 아니다. 루트마다 넣으면 선운산 도솔암 107개 루트에 같은 주차 안내를
 *    107번 쓰게 되고, 바뀌면 107개를 다 고쳐야 한다.
 *
 * ⚠️ 문서 ID 는 `${mountain}__${zone}` 를 정리한 값으로 **직접 정한다.**
 *    자동 ID 를 쓰면 루트 문서(`mountain`/`zone` 문자열만 가짐)와 이어 붙일 방법이 없다.
 *
 * ⚠️ 2026-09-07 실측: 루트의 `directions`(찾아가는 길)는 **0건**이다.
 *    대체할 기존 데이터가 없으므로 처음부터 채워야 한다. 그만큼 효과도 크다 —
 *    지금 앱 어디에도 접근 정보가 없다.
 */
import type { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import type { Closure } from './closure';

export type ApproachLevel = '쉬움' | '보통' | '어려움';
export const APPROACH_LEVELS: readonly ApproachLevel[] = ['쉬움', '보통', '어려움'];

export const SEASONS = ['봄', '여름', '가을', '겨울'] as const;

export interface Crag {
  id: string;
  mountain: string;
  zone: string;
  /** '수리산 매바위' */
  displayName: string;

  description?: string;

  latitude?: number;
  longitude?: number;

  approachLevel?: ApproachLevel;
  approachText?: string;
  /** 접근 소요 (분) */
  approachMin?: number;
  parking?: string;
  transit?: string;

  /** '종일 양지' / '부분 일조' / '종일 그늘' */
  sun?: string;
  seasons?: string[];
  toilet?: boolean;
  water?: boolean;

  /** ⚠️ 등반 금지·낙석 등 경고. 있으면 화면 맨 위에 빨간 배너로 띄운다 */
  notice?: string;

  /**
   * 구역 통째 폐쇄 (2026-09-15). 이 구역의 **모든 루트**에 안내가 뜬다.
   * ⚠️ `notice` 와 다른 것이다. notice 는 '조심하라'는 자유 문구고,
   *    closure 는 '지금 닫혀 있다'는 상태다. 상태여야 해제·배지·모달을 다룰 수 있다.
   */
  closure?: Closure;

  contributors?: string[];
  updatedAt?: FirebaseFirestoreTypes.Timestamp;
  updatedBy?: string;
}

/**
 * 문서 ID 만들기.
 * ⚠️ Firestore 문서 ID 에 `/` 가 들어가면 안 되고, 공백은 앞뒤가 흔들려 매칭이 깨진다.
 *    양쪽(앱·웹)이 **같은 규칙**을 써야 같은 문서를 가리킨다.
 */
export function cragIdOf(mountain?: string, zone?: string): string | null {
  const m = (mountain ?? '').trim();
  const z = (zone ?? '').trim();
  if (!m) {
    return null;
  }
  const safe = (v: string) => v.replace(/[/\\.#$[\]]/g, '-').replace(/\s+/g, ' ');
  return z ? `${safe(m)}__${safe(z)}` : safe(m);
}

export function cragDisplayName(mountain?: string, zone?: string): string {
  return [mountain, zone].map((v) => (v ?? '').trim()).filter(Boolean).join(' ');
}

/** 화면 한 줄 요약 — 값이 있는 것만 */
export function cragSummary(c: Crag): string {
  return [
    c.approachLevel ? `접근 ${c.approachLevel}` : undefined,
    c.approachMin ? `${c.approachMin}분` : undefined,
    c.parking?.trim() ? '주차' : undefined,
    c.toilet ? '화장실' : undefined,
    c.water ? '식수' : undefined,
  ]
    .filter(Boolean)
    .join(' · ');
}
