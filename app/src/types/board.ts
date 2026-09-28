/**
 * 게시판 정의 — **Firestore 문서**다. 코드 상수가 아니다.
 *
 * ⚠️ 왜 데이터로 두는가 (2026-09-07 사용자 요구: "나중에 게시판을 추가할 수 있게")
 *   게시판을 코드에 박으면 하나 추가할 때마다 **앱을 새로 배포**해야 한다.
 *   심사까지 며칠 걸리고, 구버전 사용자에게는 그 게시판이 아예 보이지 않는다.
 *   Firestore 에 두면 관리자가 만드는 즉시 **모든 사용자에게 나타난다.**
 *
 * ⚠️ 글은 게시판별 컬렉션으로 쪼개지 않는다. `community_posts` 하나에 `boardId` 로 구분한다.
 *    쪼개면 게시판이 늘 때마다 보안 규칙과 색인이 같이 늘어난다.
 */
import type { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

/**
 * 게시판 종류 — 글에 어떤 필드가 더 붙는지를 정한다.
 *
 * ⚠️ 만든 뒤에는 **바꾸지 못한다.** 이미 쓴 글의 필수 필드가 달라져 기존 글이 깨진다.
 */
export type BoardType =
  /** 기본형 — 사진 + 본문 */
  | 'free'
  /** 등반지별 — 글에 등반지(mountain) 필수. 등반지로 거를 수 있다 */
  | 'place'
  /** 중고거래 — 가격·거래방식·판매상태가 붙는다 */
  | 'market'
  /**
   * 등반일지 — **사용자가 직접 쓰지 못한다.**
   * 일지를 공개하면 Cloud Function 이 글을 만든다.
   * ⚠️ 시스템 게시판이라 관리자도 새로 만들 수 없다. 하나만 존재한다.
   */
  | 'log'
  /**
   * 파티 모집 — 등반 날짜·인원·모집 상태가 붙는다 (v2.2.0).
   * ⚠️ 개인 연락처를 본문에 못 적게 막는다 (utils/profanity.ts strict) —
   *    중고거래와 같은 이유다.
   */
  | 'party';

export interface Board {
  /** 문서 ID (영문 소문자, 만든 뒤 불변 — 글이 이 값을 들고 있다) */
  id: string;
  name: string;
  /** 글이 하나도 없을 때 안내에 쓴다 */
  description?: string;
  type: BoardType;
  /** AppIcon 이름 또는 이모지 1자 */
  icon?: string;
  /** 정렬 — 작을수록 왼쪽 */
  order: number;
  /** false 면 목록에서 숨긴다. **글은 지우지 않는다** */
  visible: boolean;
  /** false 면 글쓰기 버튼이 없다 (log 는 항상 false) */
  writable: boolean;
  /** 표시용. 없어도 동작한다 */
  postCount?: number;
  createdAt?: FirebaseFirestoreTypes.Timestamp;
}

/** 관리자가 게시판을 만들 때 넘기는 값 */
export interface BoardInput {
  id: string;
  name: string;
  description?: string;
  type: Exclude<BoardType, 'log'>;
  icon?: string;
  order: number;
}

/** 등반일지 게시판의 고정 ID — 여러 곳에서 참조하므로 상수로 둔다 */
export const LOG_BOARD_ID = 'log';

/** boardId 로 쓸 수 있는 문자열인지 (영문 소문자·숫자·하이픈, 2~24자) */
export function isValidBoardId(id: string): boolean {
  return /^[a-z][a-z0-9-]{1,23}$/.test(id);
}
