/**
 * 완등 기록 (Send) — `sends/{sendId}`
 *
 * ⚠️ **등반일지(`climbing_logs`)와 별개 컬렉션이다.** 단위가 다르다.
 *      등반일지 = **하루** 1건 (참석자·소요시간·날씨 같은 내 일기)
 *      완등 기록 = **루트** 1건 (별점·스타일·시도 — 공개 데이터)
 *    하루에 루트를 5개 오르면 일지는 1건인데 완등은 5건이다.
 *    억지로 합치면 **"이 루트 완등 30명"을 영원히 못 만든다.**
 *    (계획: claude/v2.2-v2.5-개발계획.md §0-1)
 *
 * ⚠️ `difficulty` 는 **완등 당시 값을 박아 둔다.** 나중에 난이도가 정정돼도
 *    그때 내가 오른 기록은 그대로여야 한다.
 */
import type { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import type { ConceptSource } from './concept';

/** 등반 스타일 — 순서가 그대로 화면 칩 순서다 */
export const SEND_STYLES = ['onsight', 'flash', 'redpoint', 'toprope', 'second'] as const;
export type SendStyle = (typeof SEND_STYLES)[number];

export const STYLE_LABEL: Record<SendStyle, string> = {
  onsight: '온사이트',
  flash: '플래시',
  redpoint: '레드포인트',
  toprope: '톱로핑',
  second: '세컨',
};

/** 짧은 설명 — 처음 보는 사람이 고를 수 있게 */
export const STYLE_HINT: Record<SendStyle, string> = {
  onsight: '정보 없이 첫 시도에 완등',
  flash: '정보를 듣고 첫 시도에 완등',
  redpoint: '여러 번 시도 끝에 선등 완등',
  toprope: '톱로핑으로 완등',
  second: '후등으로 완등',
};

export interface Send {
  id: string;

  conceptId: string;
  conceptSource: ConceptSource;
  mountain: string;
  zone: string;
  routeName: string;
  /** 완등 당시 난이도 (위 머리말) */
  difficulty: string;

  uid: string;
  nickname: string;
  photoUrl?: string;

  style: SendStyle;
  /** 1~5, 없을 수 있다 */
  rating?: number;
  attempts?: number;
  shoes?: string;
  memo?: string;

  /** 실제 등반일 (서버 시각이 아니다) */
  climbedAt?: FirebaseFirestoreTypes.Timestamp;
  /** 같이 만든 등반일지 문서 ID */
  logId?: string;
  isPublic: boolean;
  timestamp?: FirebaseFirestoreTypes.Timestamp;
}

/** 작성 폼에서 넘기는 값 */
export interface SendInput {
  style: SendStyle;
  rating?: number;
  attempts?: number;
  shoes?: string;
  memo?: string;
  climbedAt: Date;
  isPublic: boolean;
  /** 난이도가 비어 있는 루트에서 같이 받은 값 (선택) */
  difficultySuggestion?: string;
}

/** 별점 평균 — ⚠️ 평균을 저장하지 않고 합/개수로 계산한다 (동시성) */
export function averageRating(sum?: number, count?: number): number | undefined {
  if (!count || count <= 0 || typeof sum !== 'number') {
    return undefined;
  }
  return Math.round((sum / count) * 10) / 10;
}
