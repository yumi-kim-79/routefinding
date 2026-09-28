/**
 * 완등 기록 — `sends`.
 *
 * ⚠️ 목록은 **루트별로 페이지 조회**한다. 전체 구독은 하지 않는다 —
 *    기록이 쌓이면 접속자 1명당 수만 건 읽기가 발생한다
 *    (커뮤니티 피드와 같은 이유: services/communityService.ts 머리말).
 *
 * ⚠️ `sendCount` / `ratingSum` / `ratingCount` 는 **여기서 올리지 않는다.**
 *    Cloud Function `countSend` 가 센다. 클라이언트가 올리면 보안 규칙으로 막을 수 없고,
 *    한쪽만 실패하면 숫자가 영구히 어긋난다.
 */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from '@react-native-firebase/firestore';
import { db } from './firebase';
import { conceptDifficulty, type Concept } from '../types/concept';
import type { Send, SendInput, SendStyle } from '../types/send';

const COL = 'sends';

/** 루트 상세에서 한 번에 보여줄 완등 수 */
export const SEND_PAGE = 30;

function toSend(id: string, v: Record<string, unknown>): Send {
  return {
    id,
    conceptId: typeof v.conceptId === 'string' ? v.conceptId : '',
    conceptSource: (v.conceptSource as Send['conceptSource']) ?? 'route_reports',
    mountain: typeof v.mountain === 'string' ? v.mountain : '',
    zone: typeof v.zone === 'string' ? v.zone : '',
    routeName: typeof v.routeName === 'string' ? v.routeName : '',
    difficulty: typeof v.difficulty === 'string' ? v.difficulty : '',
    uid: typeof v.uid === 'string' ? v.uid : '',
    nickname: typeof v.nickname === 'string' ? v.nickname : '이름 없음',
    photoUrl: typeof v.photoUrl === 'string' ? v.photoUrl : undefined,
    style: (v.style as SendStyle) ?? 'redpoint',
    rating: typeof v.rating === 'number' ? v.rating : undefined,
    attempts: typeof v.attempts === 'number' ? v.attempts : undefined,
    shoes: typeof v.shoes === 'string' ? v.shoes : undefined,
    memo: typeof v.memo === 'string' ? v.memo : undefined,
    climbedAt: v.climbedAt as Send['climbedAt'],
    logId: typeof v.logId === 'string' ? v.logId : undefined,
    isPublic: v.isPublic !== false,
    timestamp: v.timestamp as Send['timestamp'],
  };
}

/**
 * 루트별 완등 목록 (최신 등반일 순).
 *
 * 🚨 `where('isPublic', '==', true)` 를 **절대 빼지 말 것.**
 *    보안 규칙이 `resource.data.isPublic == true || isOwner(...) || isAdmin()` 인데,
 *    Firestore 의 목록(list) 쿼리는 **결과를 보기 전에** "이 쿼리가 돌려줄 수 있는
 *    모든 문서가 규칙을 통과하는가"를 쿼리 조건만 보고 정적으로 판단한다.
 *    isPublic 을 안 거르면 비공개 기록이 섞일 수 있다고 보고 **쿼리 전체를 거부**한다.
 *    받아 온 뒤 `.filter()` 로 걸러도 소용없다 — 애초에 응답이 오지 않는다.
 *
 *    v2.2.0 에서 이 조건이 빠져 있었다. 관리자 계정은 `isAdmin()` 이 문서와 무관하게
 *    참이라 규칙이 통째로 통과해 **개발 중에는 아무 문제가 없었고**, 배포 후 일반
 *    사용자에게만 루트 상세마다 permission-denied 가 떴다 (2026-09-08 제보).
 *    같은 함정이 `edit_suggestions` 규칙 주석에도 적혀 있다.
 *
 * ⚠️ 복합 색인이 필요하다 — `conceptId` + `isPublic` + `climbedAt desc`.
 *    없으면 failed-precondition 이 난다. **앱보다 색인을 먼저 배포할 것.**
 */
export function subscribeSendsOfConcept(
  conceptId: string,
  onData: (list: Send[]) => void,
  onError?: (message: string) => void,
): () => void {
  const q = query(
    collection(db, COL),
    where('conceptId', '==', conceptId),
    where('isPublic', '==', true),
    orderBy('climbedAt', 'desc'),
    limit(SEND_PAGE),
  );
  return onSnapshot(
    q,
    (snap) =>
      onData(snap.docs.map((d) => toSend(d.id, d.data() as Record<string, unknown>))),
    (e) => onError?.(e.message),
  );
}

/** 내 완등 전체 (마이페이지) — ⚠️ `uid` + `climbedAt desc` 색인 필요 */
export function subscribeMySends(
  uid: string,
  onData: (list: Send[]) => void,
  onError?: (message: string) => void,
): () => void {
  const q = query(
    collection(db, COL),
    where('uid', '==', uid),
    orderBy('climbedAt', 'desc'),
  );
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => toSend(d.id, d.data() as Record<string, unknown>))),
    (e) => onError?.(e.message),
  );
}

/** 이 루트를 내가 이미 완등했는지 (버튼 문구를 바꾸려고) */
export async function findMySend(conceptId: string, uid: string): Promise<Send | null> {
  const snap = await getDocs(
    query(collection(db, COL), where('conceptId', '==', conceptId), where('uid', '==', uid)),
  );
  const d = snap.docs[0];
  return d ? toSend(d.id, d.data() as Record<string, unknown>) : null;
}

/**
 * 완등 기록 남기기.
 * @param logId 등반일지에서 같이 만들 때만
 */
export async function addSend(
  concept: Concept,
  input: SendInput,
  author: { uid: string; nickname: string; photoUrl?: string },
  logId?: string,
): Promise<string> {
  const ref = await addDoc(collection(db, COL), {
    conceptId: concept.id,
    conceptSource: concept.source,
    mountain: concept.mountain ?? '',
    zone: concept.zone ?? '',
    routeName: concept.routeName ?? '',
    // ⚠️ 완등 당시 값을 박아 둔다 (types/send.ts 머리말)
    difficulty: conceptDifficulty(concept) ?? input.difficultySuggestion ?? '',
    uid: author.uid,
    nickname: author.nickname,
    ...(author.photoUrl ? { photoUrl: author.photoUrl } : {}),
    style: input.style,
    ...(input.rating ? { rating: input.rating } : {}),
    ...(input.attempts ? { attempts: input.attempts } : {}),
    ...(input.shoes?.trim() ? { shoes: input.shoes.trim() } : {}),
    ...(input.memo?.trim() ? { memo: input.memo.trim() } : {}),
    climbedAt: input.climbedAt,
    ...(logId ? { logId } : {}),
    isPublic: input.isPublic,
    timestamp: serverTimestamp(),
  });
  return ref.id;
}

export async function updateSend(sendId: string, patch: Partial<SendInput>): Promise<void> {
  await updateDoc(doc(db, COL, sendId), {
    ...(patch.style ? { style: patch.style } : {}),
    ...(patch.rating !== undefined ? { rating: patch.rating } : {}),
    ...(patch.attempts !== undefined ? { attempts: patch.attempts } : {}),
    ...(patch.shoes !== undefined ? { shoes: patch.shoes } : {}),
    ...(patch.memo !== undefined ? { memo: patch.memo } : {}),
    ...(patch.climbedAt ? { climbedAt: patch.climbedAt } : {}),
    ...(patch.isPublic !== undefined ? { isPublic: patch.isPublic } : {}),
  });
}

export async function deleteSend(sendId: string): Promise<void> {
  await deleteDoc(doc(db, COL, sendId));
}
