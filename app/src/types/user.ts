/**
 * 사용자 타입 — docs/02_DATA_MODEL.md의 `users/{userId}` 스키마 기반.
 * Firestore 구조 변경 금지(기존 50명 유저 데이터 보호) → 이 타입은 **실제 v1 필드명**에 맞춤.
 *
 * Phase 2-1 정정: v1 `mypage_screen.dart`/`my_profile_tab.dart` 실측 결과
 *   - 사진 필드명 = `photoUrl` (이전 추정 `profileImageUrl` 오류)
 *   - `level` = 등반등급 **문자열**("5.15"~"5.6"), 숫자 아님
 *   - `intro`(한 줄 소개) 필드 존재
 */
import type { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

export interface UserProfile {
  // 기본 정보
  uid: string; // FirebaseAuth UID (= 문서 ID)
  email: string;
  nickname: string;
  photoUrl?: string; // 프로필 사진 (v1 실제 필드명)
  intro?: string; // 한 줄 소개 (v1 my_profile_tab)

  // FCM
  fcmToken?: string;

  /**
   * @deprecated v2 리뉴얼(2026-08-04)에서 **등급/포인트 기능 전면 제거**.
   * Firestore 문서에는 남아 있으나(기존 데이터 보호, 스키마 변경 금지)
   * 화면에서는 더 이상 읽지 않는다. 새 코드에서 참조하지 말 것.
   */
  level?: string;
  /** @deprecated 위와 동일 — 표시하지 않음. */
  point?: number;

  // 통계
  postCount?: number;
  commentCount?: number;
  reportCount?: number;

  // 메타
  createdAt?: FirebaseFirestoreTypes.Timestamp;
  updatedAt?: FirebaseFirestoreTypes.Timestamp;
}

/** updateProfile에서 허용하는 수정 가능 필드(식별/메타 제외) */
export type UserProfileUpdate = Partial<
  Pick<UserProfile, 'nickname' | 'photoUrl' | 'intro' | 'fcmToken'>
>;
