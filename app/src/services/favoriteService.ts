/**
 * 개념도 즐겨찾기 — `users/{uid}/my_routes/{conceptId}`.
 *
 * ⚠️ **문서 모양이 웹과 v1에서 다르다** (2026-08-05 실측).
 *   · v1/앱 `MyRouteTab`은 `routeRef`(DocumentReference)를 deref해서 최신 정보를 읽는다
 *   · 웹 `ConceptListView.toggleMyRoute`는 `routeId`(문자열) + 스냅샷 필드를 쓴다
 *   어느 한쪽만 쓰면 다른 쪽 화면에서 항목이 비어 보인다.
 *   → **둘 다 쓴다.** 문서 id는 개념도 id와 같게 두어 존재 여부 확인이 간단해진다.
 */
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from '@react-native-firebase/firestore';
import { db } from './firebase';
import type { Concept } from '../types/concept';
import { conceptThumbnail } from '../types/concept';

/** 내 즐겨찾기 id 집합 구독 */
export function subscribeFavoriteIds(
  uid: string,
  onData: (ids: Set<string>) => void,
  onError?: (message: string) => void,
): () => void {
  return onSnapshot(
    collection(db, 'users', uid, 'my_routes'),
    (snap) => onData(new Set(snap.docs.map((d) => d.id))),
    (e) => onError?.(e.message),
  );
}

/** 즐겨찾기 추가/해제 */
export async function toggleFavorite(
  uid: string,
  concept: Concept,
  isFavorite: boolean,
): Promise<void> {
  const ref = doc(db, 'users', uid, 'my_routes', concept.id);
  if (isFavorite) {
    await deleteDoc(ref);
    return;
  }
  await setDoc(ref, {
    // v1/앱이 읽는 형태
    routeRef: doc(db, concept.source, concept.id),
    // 웹이 읽는 형태
    routeId: concept.id,
    mountain: concept.mountain ?? '',
    routeName: concept.routeName ?? '',
    imageUrl: conceptThumbnail(concept) ?? '',
    savedAt: serverTimestamp(),
  });
}
