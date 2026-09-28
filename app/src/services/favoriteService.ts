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
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from '@react-native-firebase/firestore';
import { db } from './firebase';
import type { Concept, ConceptSource } from '../types/concept';
import { conceptThumbnail } from '../types/concept';

/**
 * 즐겨찾기 한 줄 — **문서에 저장된 스냅샷만으로** 그린다.
 *
 * ⚠️ 원본 루트를 다시 읽지 않는다(`routeRef` deref 안 함). 즐겨찾기가 40개면
 *    읽기가 40번 더 생기고, 목록이 카드마다 따로 늦게 채워져 화면이 덜컹거린다.
 *    저장 당시 이름·썸네일이 조금 옛것일 수는 있지만, 목록에서는 그게 낫다 —
 *    누르고 들어간 상세는 어차피 원본을 읽는다.
 */
export interface FavoriteRoute {
  /** 문서 id = 개념도 id */
  conceptId: string;
  /** 어느 컬렉션의 루트인지 (routeRef 경로에서 뽑는다. 옛 문서엔 없을 수 있다) */
  source?: ConceptSource;
  mountain: string;
  routeName: string;
  imageUrl?: string;
}

/** `route_reports/abc` → `route_reports` */
function sourceOf(refPath: unknown): ConceptSource | undefined {
  const path = typeof refPath === 'string' ? refPath : undefined;
  if (!path) {
    return undefined;
  }
  const head = path.split('/')[0];
  return head === 'route_reports' || head === 'bouldering_reports' ? head : undefined;
}

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


/**
 * 즐겨찾기 목록 구독 (최근 저장 순).
 *
 * ⚠️ `orderBy('savedAt','desc')` 라서 **`savedAt` 이 없는 문서는 빠진다.**
 *    지금 저장 경로는 항상 `serverTimestamp()` 를 넣으므로 문제가 없지만,
 *    옛 웹에서 만든 문서에 필드가 없다면 그 항목은 목록에 안 보인다.
 *    (별은 채워져 있는데 목록에 없다는 신고가 오면 여기를 먼저 볼 것)
 *
 * ⚠️ 규칙은 `users/{uid}/my_routes` 전체에 `isOwner(userId)` 라서
 *    이 쿼리는 조건을 더 붙이지 않아도 통과한다 (sends 와 다른 점).
 */
export function subscribeFavorites(
  uid: string,
  onData: (list: FavoriteRoute[]) => void,
  onError?: (message: string) => void,
): () => void {
  return onSnapshot(
    query(collection(db, 'users', uid, 'my_routes'), orderBy('savedAt', 'desc')),
    (snap) =>
      onData(
        snap.docs.map((d) => {
          const v = d.data() as Record<string, unknown>;
          const ref = v.routeRef as { path?: string } | undefined;
          return {
            conceptId: typeof v.routeId === 'string' ? v.routeId : d.id,
            source: sourceOf(ref?.path),
            mountain: typeof v.mountain === 'string' ? v.mountain : '',
            routeName: typeof v.routeName === 'string' ? v.routeName : '',
            imageUrl: typeof v.imageUrl === 'string' && v.imageUrl ? v.imageUrl : undefined,
          };
        }),
      ),
    (e) => onError?.(e.message),
  );
}

/** 목록에서 바로 해제할 때 — 개념도 문서 없이 id 만으로 지운다 */
export async function removeFavorite(uid: string, conceptId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'my_routes', conceptId));
}
