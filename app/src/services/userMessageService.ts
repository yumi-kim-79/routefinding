/**
 * 문의 서비스 — 최상위 컬렉션 `user_messages`
 *
 * CLAUDE.md: Firestore 호출은 service 모듈로 격리한다.
 *
 * ⚠️ firestore.rules 에 `user_messages` 규칙이 **배포**돼 있어야 동작한다.
 *    (규칙 파일은 수정해 뒀고 배포는 사용자가 직접 — CLAUDE.md: 규칙 변경은 승인·별도 배포)
 *
 * ⚠️ Firestore 리스너는 `permission-denied` 를 한 번 받으면 **스스로 되살아나지 않는다.**
 *    규칙 배포 전에 구독이 걸리면 조용히 빈 목록으로 남는다.
 *    → 등반일지와 같은 방식으로 에러를 상태로 올려 "다시 불러오기"를 띄운다.
 */
import { Platform } from 'react-native';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from '@react-native-firebase/firestore';
import { db } from './firebase';
import { APP_VERSION } from '../constants/version';
import type {
  UserMessage,
  UserMessageInput,
  MessageStatus,
} from '../types/userMessage';

const COL = 'user_messages';

function toMessages(
  snap: { docs: { id: string; data: () => object }[] },
): UserMessage[] {
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<UserMessage, 'id'>),
  }));
}

/**
 * 내가 보낸 문의 구독 (최신순).
 *
 * ⚠️ `where` + `orderBy` 를 함께 쓰면 **복합 색인**이 필요하다.
 *    문의는 1인당 많아야 수십 건이라 정렬은 클라이언트에서 한다 — 색인을 만들 필요가 없다.
 *    (개념도 서비스에서 같은 이유로 단일 where 만 쓰기로 했다)
 */
export function subscribeMyMessages(
  uid: string,
  onData: (list: UserMessage[]) => void,
  onError: (message: string) => void,
): () => void {
  const q = query(collection(db, COL), where('authorUid', '==', uid));
  return onSnapshot(
    q,
    (snap) => onData(sortByCreatedDesc(toMessages(snap))),
    (e) => onError(e.message),
  );
}

/** 관리자 — 전체 문의 구독 (최신순). 규칙상 관리자만 통과한다 */
export function subscribeAllMessages(
  onData: (list: UserMessage[]) => void,
  onError: (message: string) => void,
): () => void {
  const q = query(collection(db, COL), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => onData(toMessages(snap)),
    (e) => onError(e.message),
  );
}

/** createdAt 이 아직 서버에서 안 온 문서(방금 보낸 것)는 맨 위로 */
function sortByCreatedDesc(list: UserMessage[]): UserMessage[] {
  return [...list].sort((a, b) => {
    const ta = a.createdAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
    const tb = b.createdAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
    return tb - ta;
  });
}

/** 문의 보내기 */
export async function sendMessage(
  uid: string,
  nickname: string,
  input: UserMessageInput,
): Promise<void> {
  await addDoc(collection(db, COL), {
    authorUid: uid,
    authorNickname: nickname || '익명',
    category: input.category,
    body: input.body.trim(),
    status: 'open' as MessageStatus,
    // 오류 신고를 재현하려면 어느 버전·플랫폼인지가 필요하다
    appVersion: APP_VERSION,
    platform: Platform.OS,
    createdAt: serverTimestamp(),
  });
}

/** 관리자 — 답변 등록 (status 는 answered 로) */
export async function replyMessage(id: string, reply: string): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    reply: reply.trim(),
    status: 'answered' as MessageStatus,
    repliedAt: serverTimestamp(),
  });
}

/** 관리자 — 처리 완료로 닫기 */
export async function closeMessage(id: string): Promise<void> {
  await updateDoc(doc(db, COL, id), { status: 'closed' as MessageStatus });
}

/** 작성자 본인 — 보낸 문의 삭제 */
export async function deleteMessage(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
}
