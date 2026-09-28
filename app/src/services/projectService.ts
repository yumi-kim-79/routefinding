/**
 * 프로젝트(도전 중인 루트) — `users/{uid}/my_projects/{conceptId}`.
 *
 * ⚠️ 즐겨찾기(`my_routes`)와 **다른 것**이다.
 *      즐겨찾기 = 가보고 싶다
 *      프로젝트 = 붙었는데 아직 못 깼다
 *    화면에서도 이 차이가 분명해야 한다. 안 그러면 둘 중 하나는 안 쓰인다.
 *
 * ⚠️ 문서 모양을 즐겨찾기와 **같게** 맞춘다 (services/favoriteService.ts).
 *    나중에 목록 화면을 공용으로 쓸 수 있고, 웹이 붙을 때도 규칙이 하나다.
 */
import {
  collection,
  deleteDoc,
  doc,
  increment,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from '@react-native-firebase/firestore';
import { db } from './firebase';
import { conceptDifficulty, conceptThumbnail, type Concept } from '../types/concept';

const SUB = 'my_projects';

export interface ProjectRow {
  id: string;
  routeId: string;
  source: string;
  mountain: string;
  zone: string;
  routeName: string;
  difficulty: string;
  imageUrl: string;
  tries: number;
}

export function subscribeProjectIds(
  uid: string,
  onData: (ids: Set<string>) => void,
): () => void {
  return onSnapshot(
    collection(db, 'users', uid, SUB),
    (snap) => onData(new Set(snap.docs.map((d) => d.id))),
    // 실패해도 화면이 멈추면 안 된다 — 버튼이 꺼진 상태로 보일 뿐이다
    (e) => console.warn('[projects]', e.message),
  );
}

export function subscribeProjects(
  uid: string,
  onData: (list: ProjectRow[]) => void,
  onError?: (msg: string) => void,
): () => void {
  return onSnapshot(
    collection(db, 'users', uid, SUB),
    (snap) =>
      onData(
        snap.docs.map((d) => {
          const v = d.data() as Record<string, unknown>;
          const str = (x: unknown) => (typeof x === 'string' ? x : '');
          return {
            id: d.id,
            routeId: str(v.routeId) || d.id,
            source: str(v.source) || 'route_reports',
            mountain: str(v.mountain),
            zone: str(v.zone),
            routeName: str(v.routeName),
            difficulty: str(v.difficulty),
            imageUrl: str(v.imageUrl),
            tries: typeof v.tries === 'number' ? v.tries : 0,
          };
        }),
      ),
    (e) => onError?.(e.message),
  );
}

export async function toggleProject(
  uid: string,
  concept: Concept,
  isProject: boolean,
): Promise<void> {
  const ref = doc(db, 'users', uid, SUB, concept.id);
  if (isProject) {
    await deleteDoc(ref);
    return;
  }
  await setDoc(ref, {
    routeId: concept.id,
    source: concept.source,
    mountain: concept.mountain ?? '',
    zone: concept.zone ?? '',
    routeName: concept.routeName ?? '',
    difficulty: conceptDifficulty(concept) ?? '',
    imageUrl: conceptThumbnail(concept) ?? '',
    tries: 0,
    addedAt: serverTimestamp(),
  });
}

/** 시도 횟수 +1 — "오늘도 붙었다" */
export async function addTry(uid: string, conceptId: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid, SUB, conceptId), { tries: increment(1) });
}

/**
 * 완등하면 프로젝트에서 뺀다.
 *
 * ⚠️ **이 기능의 핵심 쾌감이다.** 완등했는데 '도전 중'에 그대로 남아 있으면
 *    사용자가 직접 지워야 하고, 그러면 프로젝트 목록을 관리하지 않게 된다.
 * ⚠️ 담아 두지 않았던 루트를 완등하는 경우가 더 많다 — 문서가 없어도 조용히 넘어간다.
 */
export async function clearProjectOnSend(uid: string, conceptId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'users', uid, SUB, conceptId));
  } catch {
    /* 담아 둔 적이 없으면 그냥 넘어간다 */
  }
}
