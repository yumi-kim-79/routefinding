/**
 * 내 루트 타입 — `users/{uid}/my_routes/{myRouteId}` (v1 mypage_screen.dart::_buildMyRouteTab).
 *
 * v1 실측: `routeRef`(DocumentReference, 원본 루트 doc 가리킴), `mountain`/`routeName`
 *   스냅샷(routeRef null 또는 deleted 대비), `savedAt`(저장 시각).
 * 02_DATA_MODEL의 `completedAt`/`attemptCount`/`isOnsight` 등은 추정 — 본 탭 범위에서
 * 사용되는 필드만 모델링. 나머지는 추후 (등반 기록 강화 시) 확장.
 */
import type {
  DocumentReference,
  FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';

export interface MyRoute {
  myRouteId: string;
  /** 원본 루트 doc 참조 (route_reports 또는 bouldering_reports의 doc).
   *  modular API의 `DocumentReference` 타입 — `getDoc(ref)` 직접 호출 가능. */
  routeRef?: DocumentReference;
  // 스냅샷(저장 당시 — routeRef 없거나 삭제됐을 때 표시)
  mountain?: string;
  routeName?: string;
  /** ⚠️ v1 실측: `savedAt` (completedAt 아님) */
  savedAt?: FirebaseFirestoreTypes.Timestamp;
}
