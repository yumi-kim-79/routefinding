/**
 * 등반일지 타입 — v2 신규 (2026-08-04).
 *
 * 저장 위치: `users/{uid}/climbing_logs/{logId}` (본인 전용, firestore.rules 참조)
 * **날짜별 1건**이다 — 같은 루트를 여러 번 가는 경우가 실제로 많아
 * (사용자 기록 예: 북한산 노적봉 2017.09.24 / 2018.04.28 / 2018.05.13)
 * 루트당 1건인 `my_routes`(즐겨찾기)와는 별개 컬렉션으로 둔다.
 *
 * 필드는 사용자의 기존 스프레드시트(유성이_암벽등반기록)와 1:1:
 *   날짜 / 장소 / 루트명 / 소요장비 / 등반 소요시간 / 참석자 / 등반내용 및 특이사항
 */
import type { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import type { ConceptSource } from './concept';

export interface ClimbingLog {
  /** 문서 ID */
  id: string;

  /** 등반일 (정렬 기준) */
  climbedAt?: FirebaseFirestoreTypes.Timestamp;
  /** 종료일 — 1박 이상일 때만 (예: 2018.05.05~06) */
  endedAt?: FirebaseFirestoreTypes.Timestamp | null;

  /** 장소 (예: "북한산 노적봉") — 필수 */
  place: string;
  /** 루트명 (여러 개면 줄바꿈/슬래시로 자유 기입) */
  routeName?: string;
  /** 소요장비 (예: "퀵드로 12개, 캠1셋트") */
  gear?: string;
  /** 등반 소요시간 — "9시~16시"처럼 자유 형식 (기존 기록 형태 보존) */
  duration?: string;
  /** 참석자 */
  partners?: string;
  /** 등반내용 및 특이사항 */
  notes?: string;

  /**
   * 공개 여부 — v2.1.0 (2026-09-07). **기본은 비공개**다.
   *
   * true 로 바꾸면 Cloud Function `syncPublicLog` 이 커뮤니티 `log` 게시판에
   * 글을 만들어 준다. false 로 되돌리거나 일지를 지우면 그 글도 사라진다.
   *
   * ⚠️ 앱에서 두 곳(일지·게시판)에 직접 쓰지 말 것. 한쪽만 성공하는 날이 반드시 온다.
   *    일지 문서 하나만 고치고 나머지는 서버가 맞춘다.
   */
  isPublic?: boolean;

  /**
   * 사진 (0~5장) — Storage `log_images/{uid}/{logId}/{n}.jpg`.
   * 비공개 일지에도 쓸모가 있어 공개 여부와 무관하게 넣는다.
   */
  photoUrls?: string[];

  /** 개념도에서 작성한 경우 원본 루트 연결 (선택) */
  conceptId?: string;
  conceptSource?: ConceptSource | '';

  createdAt?: FirebaseFirestoreTypes.Timestamp;
  updatedAt?: FirebaseFirestoreTypes.Timestamp;
}

/** 저장(생성/수정) 시 폼에서 넘기는 값 */
export interface ClimbingLogInput {
  climbedAt: Date;
  endedAt?: Date | null;
  place: string;
  routeName?: string;
  gear?: string;
  duration?: string;
  partners?: string;
  notes?: string;
  isPublic?: boolean;
  /** 로컬 파일 URI 또는 이미 올라간 https URL 이 섞여 들어온다 (수정 시) */
  photos?: string[];
  conceptId?: string;
  conceptSource?: ConceptSource | '';
}

/** 일지 1건에 붙일 수 있는 사진 수 */
export const MAX_LOG_PHOTOS = 5;

/** "2018.04.28" 또는 여러 날이면 "2018.05.05~06" */
export function logDateLabel(log: ClimbingLog): string {
  const fmt = (ts?: FirebaseFirestoreTypes.Timestamp | null): string => {
    if (!ts) {
      return '';
    }
    const d = ts.toDate();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
  };
  const a = fmt(log.climbedAt);
  const b = fmt(log.endedAt);
  if (!b || b === a) {
    return a;
  }
  // 같은 해·월이면 뒤쪽은 일자만 (스프레드시트 표기와 동일)
  return a.slice(0, 8) === b.slice(0, 8) ? `${a}~${b.slice(8)}` : `${a}~${b}`;
}

/** 검색 인덱스 (장소/루트명/내용/참석자) */
export function logSearchIndex(log: ClimbingLog): string {
  return [log.place, log.routeName, log.notes, log.partners]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}
