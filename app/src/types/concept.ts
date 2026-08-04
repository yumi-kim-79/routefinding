/**
 * 개념도(토포) 타입 — v2 리뉴얼.
 *
 * ⚠️ 데이터 소스는 **기존 컬렉션 그대로**다 (docs/02_DATA_MODEL.md, 스키마 변경 금지).
 *   - `route_reports`      (typeRoot === '리드')      → 자연암벽 리드 루트
 *   - `bouldering_reports` (볼더링)                    → 인공벽/볼더링
 * v1 `concept_list_screen.dart` / 웹 `ConceptListView.vue`가 읽는 것과 동일하다.
 * (`concepts/{mountain}/routes`는 v1에서도 거의 사용되지 않아 이번 리뉴얼 범위 밖 —
 *  02_DATA_MODEL.md §6 참조.)
 *
 * v1 실측 필드명 주의:
 *   - 작성일 = `timestamp` (createdAt 아님)
 *   - 대표 이미지 = `imageUrl` 또는 `imageUrls[0]`
 *   - 피치는 문서의 **배열 필드** `pitches` (route_reports/{id}/pitches 서브컬렉션과 별개)
 */
import type { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

/** 개념도를 읽어오는 원본 컬렉션 */
export type ConceptSource = 'route_reports' | 'bouldering_reports';

/** 화면 표기용 대분류 (v1 typeRoot 1:1) */
export type ConceptType = '리드' | '볼더링';

/** 피치 (문서의 `pitches` 배열 원소, v1 실측) */
export interface ConceptPitch {
  length?: number;
  style?: string;
  difficulty?: string;
  imageUrls?: string[];
}

/**
 * 목록·상세 공용 개념도 모델.
 * 두 컬렉션의 필드가 완전히 동일하지 않으므로 전부 optional로 둔다(v1 관용 동작 보존).
 */
export interface Concept {
  /** 문서 ID */
  id: string;
  /** 읽어온 원본 컬렉션 (상세 재조회·수정 분기용) */
  source: ConceptSource;
  /** 리드 / 볼더링 */
  type: ConceptType;

  mountain?: string;
  zone?: string;
  routeName?: string;
  overview?: string;

  difficulty?: string;
  avgDifficulty?: string;
  length?: number;
  pioneer?: string;
  equipment?: string;
  directions?: string;
  no?: string | number;

  imageUrl?: string;
  imageUrls?: string[];
  pitches?: ConceptPitch[];

  writer?: string;
  nickname?: string;
  userId?: string;

  gpxUrl?: string;
  timestamp?: FirebaseFirestoreTypes.Timestamp;
}

/** 상세/뷰어에서 쓸 이미지 목록 (imageUrls 우선, 없으면 imageUrl) */
export function conceptImages(c: Concept): string[] {
  const list: string[] = [];
  if (Array.isArray(c.imageUrls)) {
    list.push(...c.imageUrls.filter(Boolean));
  }
  if (c.imageUrl && !list.includes(c.imageUrl)) {
    list.push(c.imageUrl);
  }
  return list;
}

/** 카드 썸네일 1장 */
export function conceptThumbnail(c: Concept): string | undefined {
  return conceptImages(c)[0];
}

/** "등반지 · 구역 · 루트명" (빈 값은 자동 생략) */
export function conceptTitle(c: Concept): string {
  const parts = [c.mountain, c.zone, c.routeName].filter(
    (v): v is string => !!v && v.trim().length > 0,
  );
  return parts.length > 0 ? parts.join(' · ') : '이름 없는 루트';
}

/** 총 길이 표시용 (1피치 정보 우선, v1 목록 표기 보존) */
export function conceptLengthLabel(c: Concept): string | undefined {
  const first = c.pitches?.[0]?.length;
  if (typeof first === 'number') {
    return `${first}m`;
  }
  if (typeof c.length === 'number') {
    return `${c.length}m`;
  }
  return undefined;
}

/**
 * 검색 대상 문자열 — 등반지/구역/루트명/개요를 하나로 합쳐 소문자화.
 * 검색창 한 줄로 전부 걸리도록 하기 위한 리뉴얼 핵심 로직.
 */
export function conceptSearchIndex(c: Concept): string {
  return [c.mountain, c.zone, c.routeName, c.overview, c.difficulty]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}
