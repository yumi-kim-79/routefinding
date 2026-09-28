/**
 * 난이도 제안 · 반영 — `difficulty_suggestions`.
 *
 * 흐름:
 *   사용자가 제안 → 같은 값이 3명 모이면 **Cloud Function 이** 개념도의 `difficulty` 에 반영
 *   → 관리자는 모자란 것들을 '난이도 채우기' 화면에서 직접 입력
 *
 * ⚠️ 클라이언트가 개념도의 `difficulty` 를 직접 쓰지 않는다(관리자 제외).
 *    한 사람의 착각이 그대로 정답이 되면 안 되고, 규칙으로 "3명 동의"를 검증할 방법이 없다.
 *    (커뮤니티 `commentCount` 를 서버가 세는 것과 같은 이유)
 */
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from '@react-native-firebase/firestore';
import { db } from './firebase';
import { clearConceptCache } from './conceptService';
import { normalizeGrade, type DifficultySuggestion } from '../types/difficultySuggestion';
import type { Concept, ConceptSource } from '../types/concept';

const COL = 'difficulty_suggestions';

/** ⚠️ 한 사람이 여러 표를 만들지 못하게 문서 ID 를 고정한다 */
const idOf = (conceptId: string, uid: string) => `${conceptId}__${uid}`;

export async function suggestDifficulty(
  concept: Pick<Concept, 'id' | 'source'>,
  value: string,
  author: { uid: string; nickname: string },
): Promise<void> {
  const grade = normalizeGrade(value);
  if (!grade) {
    throw new Error('난이도를 입력해 주세요.');
  }
  await setDoc(doc(db, COL, idOf(concept.id, author.uid)), {
    conceptId: concept.id,
    conceptSource: concept.source,
    value: grade,
    uid: author.uid,
    nickname: author.nickname,
    createdAt: serverTimestamp(),
  });
}

/** 이 루트에 모인 제안들 (상세 화면에서 "3명 중 2명" 같은 안내를 보여주려고) */
export function subscribeSuggestions(
  conceptId: string,
  onData: (list: DifficultySuggestion[]) => void,
): () => void {
  const q = query(collection(db, COL), where('conceptId', '==', conceptId));
  return onSnapshot(
    q,
    (snap) =>
      onData(
        snap.docs.map((d) => {
          const v = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            conceptId: typeof v.conceptId === 'string' ? v.conceptId : '',
            conceptSource: (v.conceptSource as ConceptSource) ?? 'route_reports',
            value: typeof v.value === 'string' ? v.value : '',
            uid: typeof v.uid === 'string' ? v.uid : '',
            nickname: typeof v.nickname === 'string' ? v.nickname : '',
            createdAt: v.createdAt as DifficultySuggestion['createdAt'],
          };
        }),
      ),
    // 실패해도 화면이 멈추면 안 된다 — 제안 수만 안 보인다
    (e) => console.warn('[difficulty]', e.message),
  );
}

/** 가장 많이 나온 값과 그 표 수 */
export function topSuggestion(
  list: DifficultySuggestion[],
): { value: string; count: number } | null {
  const tally = new Map<string, number>();
  list.forEach((s) => tally.set(s.value, (tally.get(s.value) ?? 0) + 1));
  let best: { value: string; count: number } | null = null;
  tally.forEach((count, value) => {
    if (!best || count > best.count) {
      best = { value, count };
    }
  });
  return best;
}

/**
 * 관리자 직접 입력 — 개념도에 바로 쓴다.
 *
 * ⚠️ 반영 뒤 그 루트의 제안들을 지운다. 남겨 두면 Function 이 다시 계산해 덮어쓴다.
 * ⚠️ `avgDifficulty` 는 건드리지 않는다. 새로 쓰는 값은 `difficulty` 로 통일한다
 *    (types/concept.ts `conceptDifficulty` 가 둘 다 읽는다).
 */
export async function setDifficulty(
  concept: Pick<Concept, 'id' | 'source'>,
  value: string,
): Promise<void> {
  const grade = normalizeGrade(value);
  await updateDoc(doc(db, concept.source, concept.id), { difficulty: grade });

  const snap = await getDocs(
    query(collection(db, COL), where('conceptId', '==', concept.id)),
  );
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));

  clearConceptCache();
}
