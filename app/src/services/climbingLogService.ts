/**
 * 등반일지 서비스 — `users/{uid}/climbing_logs`
 *
 * CLAUDE.md: Firestore 호출은 service 모듈로 격리한다.
 * 목록은 실시간 구독(onSnapshot) — 작성/수정 직후 별도 재조회가 필요 없다.
 *
 * ⚠️ firestore.rules에 `users/{userId}/climbing_logs` 규칙이 **배포**돼 있어야 동작한다.
 *    (규칙 파일은 수정해 뒀고 배포는 사용자가 직접 — CLAUDE.md: 규칙 변경은 승인·별도 배포)
 */
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
} from '@react-native-firebase/firestore';
import { db } from './firebase';
import { COLLECTIONS } from '../constants/firestoreFields';
import type { ClimbingLog, ClimbingLogInput } from '../types/climbingLog';

const SUB = 'climbing_logs';

function logsCollection(uid: string) {
  return collection(doc(db, COLLECTIONS.USERS, uid), SUB);
}

/**
 * 등반일지 실시간 구독 (최신 등반일 순).
 * @returns 구독 해제 함수
 */
export function subscribeClimbingLogs(
  uid: string,
  onData: (logs: ClimbingLog[]) => void,
  onError: (message: string) => void,
): () => void {
  const q = query(logsCollection(uid), orderBy('climbedAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ClimbingLog, 'id'>),
        })),
      );
    },
    (e) => onError(e.message),
  );
}

/** 폼 입력 → Firestore 문서 필드 */
function toDocData(input: ClimbingLogInput) {
  return {
    climbedAt: input.climbedAt,
    endedAt: input.endedAt ?? null,
    place: input.place.trim(),
    routeName: input.routeName?.trim() ?? '',
    gear: input.gear?.trim() ?? '',
    duration: input.duration?.trim() ?? '',
    partners: input.partners?.trim() ?? '',
    notes: input.notes?.trim() ?? '',
    updatedAt: serverTimestamp(),
  };
}

export async function createClimbingLog(
  uid: string,
  input: ClimbingLogInput,
): Promise<void> {
  await addDoc(logsCollection(uid), {
    ...toDocData(input),
    // 개념도에서 작성한 경우에만 원본 루트를 연결
    ...(input.conceptId
      ? {
          conceptId: input.conceptId,
          conceptSource: input.conceptSource ?? '',
        }
      : {}),
    createdAt: serverTimestamp(),
  });
}

export async function updateClimbingLog(
  uid: string,
  logId: string,
  input: ClimbingLogInput,
): Promise<void> {
  await updateDoc(
    doc(doc(db, COLLECTIONS.USERS, uid), SUB, logId),
    toDocData(input),
  );
}

export async function deleteClimbingLog(
  uid: string,
  logId: string,
): Promise<void> {
  await deleteDoc(doc(doc(db, COLLECTIONS.USERS, uid), SUB, logId));
}
