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
  conceptId?: string;
  conceptSource?: ConceptSource | '';
}

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
