/**
 * 사용자 → 관리자 문의 (`user_messages`).
 *
 * 문자·카카오톡 대신 **앱 안에서** 기능개선·수정요청을 받는다 (사용자 요청 2026-08-17).
 *   · 사용자: 마이페이지 ▸ 문의 — 보내고, 내가 보낸 내역과 답변을 본다
 *   · 관리자: 마이페이지 ▸ 사용자 메시지 — 전체를 보고 답변하거나 처리완료로 닫는다
 *
 * ⚠️ 등반일지처럼 `users/{uid}` 하위가 아니라 **최상위 컬렉션**이다.
 *    관리자가 전체를 한 번에 조회해야 하는데, 서브컬렉션이면
 *    collectionGroup 색인이 따로 필요해 규칙·색인이 복잡해진다.
 */
import type { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

/** 분류 — 관리자가 목록에서 우선순위를 판단할 수 있게 */
export type MessageCategory = 'improve' | 'bug' | 'data' | 'etc';

export const MESSAGE_CATEGORIES: {
  value: MessageCategory;
  label: string;
  hint: string;
}[] = [
  { value: 'improve', label: '기능 개선', hint: '이렇게 바뀌었으면 좋겠어요' },
  { value: 'bug', label: '오류 신고', hint: '동작하지 않거나 이상해요' },
  { value: 'data', label: '정보 수정', hint: '루트·개념도 내용이 잘못됐어요' },
  { value: 'etc', label: '기타 문의', hint: '그 밖의 이야기' },
];

export function categoryLabel(c: MessageCategory | undefined): string {
  return MESSAGE_CATEGORIES.find((x) => x.value === c)?.label ?? '기타 문의';
}

/**
 * open     — 접수됨, 아직 관리자가 보지 않았거나 처리 중
 * answered — 관리자가 답변을 남김
 * closed   — 처리 완료
 */
export type MessageStatus = 'open' | 'answered' | 'closed';

export function statusLabel(s: MessageStatus | undefined): string {
  if (s === 'answered') {
    return '답변 완료';
  }
  if (s === 'closed') {
    return '처리 완료';
  }
  return '접수됨';
}

export interface UserMessage {
  id: string;
  authorUid: string;
  /** 관리자 목록에서 누가 보냈는지 보이도록. 이메일은 담지 않는다(개인정보 최소화) */
  authorNickname: string;
  category: MessageCategory;
  body: string;
  status: MessageStatus;
  /** 관리자 답변 */
  reply?: string;
  repliedAt?: FirebaseFirestoreTypes.Timestamp;
  createdAt?: FirebaseFirestoreTypes.Timestamp;
  /** 어느 버전에서 왔는지 — 오류 신고를 재현할 때 필요하다 */
  appVersion?: string;
  platform?: string;
}

export interface UserMessageInput {
  category: MessageCategory;
  body: string;
}
