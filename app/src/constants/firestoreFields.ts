/**
 * Firestore 컬렉션/필드명 상수 (docs/02_DATA_MODEL.md §명명 규칙).
 * 기존 스키마와 1:1 — 컬렉션명 변경 금지(50명 유저 데이터 보호).
 */
export const COLLECTIONS = {
  USERS: 'users',
  POSTS: 'posts',
  ROUTE_REPORTS: 'route_reports',
  CONCEPTS: 'concepts',
  NOTIFICATIONS: 'notifications',
} as const;

export const SUBCOLLECTIONS = {
  MY_ROUTES: 'my_routes',
  COMMENTS: 'comments',
  REPLIES: 'replies',
  PITCHES: 'pitches',
  ROUTES: 'routes',
} as const;
