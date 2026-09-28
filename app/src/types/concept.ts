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
import type { BetaVideo } from './betaVideo';
import type { Closure } from './closure';

/** 개념도를 읽어오는 원본 컬렉션 */
export type ConceptSource = 'route_reports' | 'bouldering_reports';

/** 화면 표기용 대분류 (v1 typeRoot 1:1) */
export type ConceptType = '리드' | '볼더링';

/** 피치 (문서의 `pitches` 배열 원소, v1 실측) */
export interface ConceptPitch {
  /** ⚠️ 웹 제보/수정 폼이 쓰는 필드인데 모델에 빠져 있었다 (2026-08-05 추가).
   *     빠진 채로 수정 저장하면 기존 값이 지워진다. */
  name?: string;
  length?: number | string;
  style?: string;
  difficulty?: string;
  gear?: string;
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

  /**
   * 폐쇄 안내 (2026-09-15). 관리자만 쓴다.
   * ⚠️ 폐쇄돼도 개념도는 그대로 보이고 제보·완등도 막지 않는다 — types/closure.ts 머리말.
   */
  closure?: Closure;

  difficulty?: string;
  avgDifficulty?: string;
  /**
   * 문서의 원본 `type` 필드 = **등반 형태**(예: 슬랩/크랙).
   * ⚠️ 이 인터페이스의 `type`은 리드/볼더링 구분으로 덮어써지므로 원본을 여기 따로 보관한다.
   *    (없으면 관리자 수정 저장 시 등반 형태가 지워진다 — 2026-08-05 실측)
   */
  climbType?: string;
  length?: number;
  pioneer?: string;
  equipment?: string;
  directions?: string;
  no?: string | number;

  /**
   * 지도 좌표 (v1 실측 필드명).
   * ⚠️ 문서에 따라 숫자/문자열이 섞여 있어 union으로 둔다 — 사용 전 반드시 Number() 변환.
   * (웹 MapView.vue도 `Number(r.latitude)`로 변환해 쓴다)
   */
  latitude?: number | string;
  longitude?: number | string;

  imageUrl?: string;
  imageUrls?: string[];
  pitches?: ConceptPitch[];

  /*
   * 완등 통계 — **Cloud Function `countSend` 만 쓴다** (v2.2.0).
   * ⚠️ 평균 별점을 저장하지 않고 합·개수만 둔다. `increment` 로 동시성 문제가 없다
   *    (types/send.ts `averageRating`). 평균을 직접 쓰면 두 사람이 같은 순간에
   *    별점을 줄 때 값이 어긋난다 — 커뮤니티 likeCount 와 같은 이유.
   */
  /**
   * 베타 영상 — 유튜브·인스타 **링크만** 담는다 (types/betaVideo.ts 머리말).
   * ⚠️ 이 배열은 **로그인 사용자 누구나** 고칠 수 있게 규칙을 열어 두었다.
   *    루트를 올린 사람만 영상을 붙일 수 있으면 아무도 안 붙인다.
   */
  betaVideos?: BetaVideo[];

  sendCount?: number;
  ratingSum?: number;
  ratingCount?: number;

  writer?: string;
  nickname?: string;
  userId?: string;
  /** 제보한 사람 (수정 권한 판단용) */
  authorUid?: string;
  /** 정보를 채운 사람들 — 수정 제안이 반영되면 이름이 쌓인다 */
  contributors?: string[];

  gpxUrl?: string;
  /**
   * v1 시절 어프로치 실시간 기록. v2에서 기록 기능은 없앴지만(웹 ReportView.vue 주석 참조)
   * 옛 문서에는 배열이 남아 있어 **읽기 전용 폴백**으로 계속 그린다.
   * 좌표가 문자열로 저장된 문서가 있어 union이다 — 사용 전 Number() 변환.
   */
  trackingPath?: Array<{ latitude: number | string; longitude: number | string }>;
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

/** 값이 실제로 보여줄 만한 문자열인지 — `undefined`·`null`·빈칸만 있는 문자열을 걸러낸다 */
function text(v: unknown): string | undefined {
  if (v === undefined || v === null) {
    return undefined;
  }
  const t = String(v).trim();
  return t.length > 0 ? t : undefined;
}

/**
 * 길이 표기. **숫자로 저장된 문서와 문자열로 저장된 문서가 섞여 있다.**
 * (v1 웹 폼이 입력값을 그대로 저장해서 `12` 와 `"12"`, `"12m"` 이 모두 존재한다 —
 *  `latitude`/`longitude` 가 union 인 것과 같은 이유다)
 * 예전 `conceptLengthLabel` 은 `typeof === 'number'` 만 봐서 **문자열 길이를 통째로 놓쳤다.**
 */
function lengthText(v: unknown): string | undefined {
  const t = text(v);
  if (!t) {
    return undefined;
  }
  // 이미 단위가 붙어 있으면 그대로 (`12m`, `12 m`)
  if (/[a-zA-Z가-힣]/.test(t)) {
    return t;
  }
  return Number.isFinite(Number(t)) ? `${Number(t)}m` : t;
}

/** 총 길이 표시용 (루트 길이 우선, 없으면 1피치 값 — v1 목록 표기 보존) */
export function conceptLengthLabel(c: Concept): string | undefined {
  return lengthText(c.length) ?? lengthText(c.pitches?.[0]?.length);
}

/**
 * 목록 한 줄에 들어가는 요약 — `"리드 · 5.12c · 12m · 우향페이스 · 퀵5 · 3피치"`.
 *
 * ⚠️ **개념도 탭과 지도 탭이 이 함수를 함께 쓴다** (2026-08-29).
 *   예전에는 지도 탭 목록이 루트명과 등반지만 보여줘서, 같은 루트인데
 *   **어디서 열었느냐에 따라 정보가 달랐다**(사용자 지적). 한 곳에서 만들어 양쪽에 쓴다.
 *   웹 `src/utils/conceptMeta.js` 에 같은 규칙을 복제해 뒀다 — 한쪽만 고치지 말 것.
 *
 * ⚠️ 값이 **어디에 저장돼 있는지 문서마다 다르다** (2026-08-31 사용자 보고:
 *    "난이도·길이·형태·장비가 양쪽 다 안 보인다. 있는 항목은 보여줘야지").
 *    첫 판은 `c.difficulty ?? c.avgDifficulty` 로만 봤는데 두 가지를 놓쳤다:
 *      · `??` 는 **빈 문자열을 통과시킨다.** `difficulty: ''` 인 문서가 실제로 있어
 *        `avgDifficulty` 로 넘어가지 못하고 빈칸이 그대로 채택됐다 → `||` 로 바꿨다
 *      · 리드 루트는 난이도·길이·형태·장비가 **루트가 아니라 피치**에 들어 있는 경우가 많다
 *        (피치 상세에 12m / 우향페이스 / 10b / 퀵5 가 보이는 그 값들)
 *    그래서 루트 → 1피치 순서로 **폴백**한다. 빈 항목은 알아서 빠진다.
 *
 * 피치는 **개수만** 적는다. 피치별 난이도까지 넣으면 줄이 길어져
 * "목록이 몇 개 안 보인다"는 원래 불만으로 되돌아간다.
 */
export function conceptMetaLine(c: Concept): string {
  const p0 = c.pitches?.[0];
  const pitchCount = c.pitches?.length ?? 0;

  return [
    text(c.type),
    // 난이도
    text(c.difficulty) ?? text(c.avgDifficulty) ?? text(p0?.difficulty),
    // 길이
    conceptLengthLabel(c),
    // 등반 형태 (슬랩/크랙/우향페이스…) — 문서의 원본 `type` 이 climbType 으로 옮겨져 있다
    text(c.climbType) ?? text(p0?.style),
    // 장비
    text(c.equipment) ?? text(p0?.gear),
    pitchCount > 1 ? `${pitchCount}피치` : undefined,
  ]
    .filter((v): v is string => v !== undefined)
    .join(' · ');
}

/**
 * 이 루트에 난이도가 적혀 있는가.
 *
 * ⚠️ 2026-09-07 실측: **리드 2,995개 중 난이도가 있는 건 99개(3%)뿐이다.**
 *    필드가 `difficulty` / `avgDifficulty` / 피치 세 군데로 흩어져 있어
 *    한 곳만 보면 있는 값도 놓친다 (conceptMetaLine 머리말과 같은 함정).
 */
export function conceptDifficulty(c: Concept): string | undefined {
  return (
    text(c.difficulty) ?? text(c.avgDifficulty) ?? text(c.pitches?.[0]?.difficulty)
  );
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
