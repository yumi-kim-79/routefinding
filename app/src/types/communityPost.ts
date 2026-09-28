/**
 * 커뮤니티 글 — 모든 게시판의 글이 `community_posts` **한 컬렉션**에 들어간다.
 * 게시판 구분은 `boardId`. (이유는 types/board.ts 머리말)
 *
 * ⚠️ 시간 필드명은 `timestamp` 다. `createdAt` 이 아니다 —
 *    v1 부터 이어온 이 프로젝트의 규칙이다 (types/post.ts, types/concept.ts 와 동일).
 *
 * ⚠️ `nickname` / `photoUrl` 은 **비정규화**다. 목록에서 글마다 `users` 문서를 읽으면
 *    글 20개당 읽기가 20회 더 든다. 작성 시점 값을 그대로 박아 둔다.
 *    (프로필을 바꿔도 과거 글의 표시 이름은 안 바뀐다 — 의도한 절충이다)
 */
import type { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import type { BoardType } from './board';

/** 중고거래 글의 거래 방식 */
export type TradeType = 'sell' | 'exchange' | 'give';
/** 중고거래 글의 판매 상태 */
export type TradeStatus = 'selling' | 'reserved' | 'sold';

export interface CommunityPost {
  id: string;

  boardId: string;
  /** 비정규화 — 카드를 그릴 때 게시판 문서를 다시 읽지 않으려고 */
  boardType: BoardType;

  authorUid: string;
  nickname: string;
  photoUrl?: string;

  /** 0~2000자. 사진만 올리는 글도 있어 빈 문자열을 허용한다 */
  body: string;
  /** 0~5장. Storage `post_images/{postId}/` */
  imageUrls: string[];

  // ── type='place' 일 때 ──────────────────────────────
  mountain?: string;
  zone?: string;
  /** 개념도 상세에서 글쓰기로 들어온 경우 원본 루트 연결 */
  conceptId?: string;
  conceptSource?: string;

  // ── type='market' 일 때 ─────────────────────────────
  /** 0 = 나눔 */
  price?: number;
  tradeType?: TradeType;
  tradeStatus?: TradeStatus;
  /** ⚠️ 시/군/구까지만. 상세 주소는 받지 않는다 */
  region?: string;

  // ── type='log' 일 때 (Cloud Function 이 채운다) ──────
  /* 파티 모집 (boardType === 'party') — v2.2.0 */
  climbAt?: FirebaseFirestoreTypes.Timestamp;
  capacity?: number;
  partyStatus?: 'open' | 'closed';

  logId?: string;
  climbedAt?: FirebaseFirestoreTypes.Timestamp;
  place?: string;
  routeName?: string;

  likeCount: number;
  /**
   * 좋아요를 누른 uid 목록.
   * ⚠️ 100명 규모라 배열이 가장 단순하고 `arrayUnion`/`arrayRemove` 로 동시성도 안전하다.
   *    수천 명이 되면 하위 컬렉션(`likes/{uid}`)으로 옮겨야 한다.
   */
  likedBy: string[];
  /** Cloud Function 이 갱신한다. 클라이언트에서 올리면 규칙으로 막기 어렵다 */
  commentCount: number;

  timestamp?: FirebaseFirestoreTypes.Timestamp;
  updatedAt?: FirebaseFirestoreTypes.Timestamp;
  isDeleted: boolean;
  /** 신고 누적. 3 이상이면 목록에서 감춘다 */
  reportCount: number;
}

/** 글 하나의 댓글 — `community_posts/{postId}/comments/{commentId}` */
export interface PostComment {
  id: string;
  authorUid: string;
  nickname: string;
  photoUrl?: string;
  /** 1~500자 */
  body: string;
  timestamp?: FirebaseFirestoreTypes.Timestamp;
  isDeleted: boolean;
  reportCount: number;
}

/** 글쓰기 폼이 넘기는 값 (서비스가 나머지를 채운다) */
export interface PostDraft {
  boardId: string;
  boardType: BoardType;
  body: string;
  /** 로컬 파일 uri 또는 이미 올라간 https URL */
  images: string[];

  mountain?: string;
  zone?: string;
  conceptId?: string;
  conceptSource?: string;

  price?: number;
  tradeType?: TradeType;
  region?: string;

  /** 파티 모집 — v2.2.0 */
  climbAt?: Date;
  capacity?: number;
}

/**
 * 파티 모집 카드 배지.
 * ⚠️ **지난 날짜는 '마감'으로 본다.** 작성자가 닫아 주기를 기다리면
 *    지난 모집이 목록에 계속 남는다.
 */
export function partyLabel(p: {
  climbAt?: { toDate: () => Date };
  capacity?: number;
  partyStatus?: 'open' | 'closed';
}): { text: string; closed: boolean } | undefined {
  if (!p.climbAt?.toDate) {
    return undefined;
  }
  const d = p.climbAt.toDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const closed = p.partyStatus === 'closed' || d < today;
  const date = `${d.getMonth() + 1}월 ${d.getDate()}일`;
  return {
    text: `${date}${p.capacity ? ` · ${p.capacity}명` : ''} · ${closed ? '마감' : '모집중'}`,
    closed,
  };
}

/** 신고가 쌓여 가려야 하는 글인지 */
export const HIDE_REPORT_THRESHOLD = 3;

export function isHidden(p: { isDeleted: boolean; reportCount: number }): boolean {
  return p.isDeleted || p.reportCount >= HIDE_REPORT_THRESHOLD;
}

/** "1,200원" / "나눔" — 중고거래 카드 표시용 */
export function priceLabel(price?: number, tradeType?: TradeType): string | undefined {
  if (tradeType === 'give' || price === 0) {
    return '나눔';
  }
  if (tradeType === 'exchange') {
    return '교환';
  }
  if (typeof price !== 'number' || !Number.isFinite(price)) {
    return undefined;
  }
  return `${price.toLocaleString('ko-KR')}원`;
}

/** "판매중" / "예약중" / "판매완료" */
export function tradeStatusLabel(s?: TradeStatus): string | undefined {
  return s === 'reserved' ? '예약중' : s === 'sold' ? '판매완료' : s === 'selling' ? '판매중' : undefined;
}

/** "2시간 전" — 인스타식 상대 시간 */
export function relativeTime(ts?: FirebaseFirestoreTypes.Timestamp): string {
  if (!ts) {
    return '';
  }
  const sec = Math.max(0, Math.floor(Date.now() / 1000 - ts.seconds));
  if (sec < 60) {
    return '방금';
  }
  const min = Math.floor(sec / 60);
  if (min < 60) {
    return `${min}분 전`;
  }
  const hour = Math.floor(min / 60);
  if (hour < 24) {
    return `${hour}시간 전`;
  }
  const day = Math.floor(hour / 24);
  if (day < 7) {
    return `${day}일 전`;
  }
  const d = ts.toDate();
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}
