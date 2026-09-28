/**
 * 정보 수정 제안 — 제출 · 관리자 검토.
 *
 * ⚠️ **본인 제보면 제안하지 않고 바로 반영한다.** 자기가 올린 오타를 남에게
 *    승인받게 하는 것은 말이 안 된다 (types/editSuggestion.ts 머리말).
 * ⚠️ 반영할 때 `contributors` 에 이름을 남긴다 — 이름이 남는 것이 고치는 동기다.
 */
import {
  addDoc,
  arrayUnion,
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
import { clearConceptCache } from './conceptService';
import type { EditSuggestion, EditableField } from '../types/editSuggestion';
import type { Concept } from '../types/concept';

const COL = 'edit_suggestions';

/** 제안 올리기 */
export async function submitSuggestion(
  concept: Concept,
  patch: Partial<Record<EditableField, string>>,
  before: Partial<Record<EditableField, string>>,
  reason: string,
  author: { uid: string; nickname: string },
): Promise<void> {
  if (Object.keys(patch).length === 0) {
    throw new Error('바꿀 내용이 없습니다.');
  }
  await addDoc(collection(db, COL), {
    conceptId: concept.id,
    conceptSource: concept.source,
    title: [concept.mountain, concept.zone, concept.routeName].filter(Boolean).join(' · '),
    patch,
    before,
    reason: reason.trim(),
    uid: author.uid,
    nickname: author.nickname,
    status: 'open',
    createdAt: serverTimestamp(),
  });
}

/** 본인 제보 — 검토 없이 바로 반영 (위 머리말) */
export async function applyDirect(
  concept: Concept,
  patch: Partial<Record<EditableField, string>>,
): Promise<void> {
  await updateDoc(doc(db, concept.source, concept.id), patch);
  clearConceptCache();
}

/** 관리자 목록 — ⚠️ `orderBy` 단독이라 복합 색인이 필요 없다 */
export function subscribeSuggestions(
  onData: (list: EditSuggestion[]) => void,
  onError: (msg: string) => void,
): () => void {
  return onSnapshot(
    query(collection(db, COL), orderBy('createdAt', 'desc')),
    (snap) =>
      onData(
        snap.docs.map((d) => {
          const v = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            conceptId: typeof v.conceptId === 'string' ? v.conceptId : '',
            conceptSource: (v.conceptSource as EditSuggestion['conceptSource']) ?? 'route_reports',
            title: typeof v.title === 'string' ? v.title : '',
            patch: (v.patch as EditSuggestion['patch']) ?? {},
            before: (v.before as EditSuggestion['before']) ?? {},
            reason: typeof v.reason === 'string' ? v.reason : undefined,
            uid: typeof v.uid === 'string' ? v.uid : '',
            nickname: typeof v.nickname === 'string' ? v.nickname : '',
            status: (v.status as EditSuggestion['status']) ?? 'open',
            createdAt: v.createdAt as EditSuggestion['createdAt'],
          };
        }),
      ),
    (e) => onError(e.message),
  );
}

/** 관리자: 제안을 반영한다 */
export async function applySuggestion(s: EditSuggestion): Promise<void> {
  await updateDoc(doc(db, s.conceptSource, s.conceptId), {
    ...s.patch,
    // 이름이 남는 것이 고치는 동기다
    contributors: arrayUnion(s.nickname),
  });
  await updateDoc(doc(db, COL, s.id), { status: 'applied' });
  clearConceptCache();
}

export async function rejectSuggestion(id: string): Promise<void> {
  await updateDoc(doc(db, COL, id), { status: 'rejected' });
}

export async function deleteSuggestion(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
}
