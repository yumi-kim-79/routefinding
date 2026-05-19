/**
 * 사용자 타입 — docs/02_DATA_MODEL.md의 `users/{userId}` 스키마 기반.
 * Firestore 구조 변경 금지(기존 50명 유저 데이터 보호) → 이 타입은 기존 스키마 반영.
 */
import type { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

export interface UserProfile {
  // 기본 정보
  uid: string; // FirebaseAuth UID (= 문서 ID)
  email: string;
  nickname: string;
  profileImageUrl?: string;

  // FCM
  fcmToken?: string;

  // 등급 시스템 (왕관 표시용)
  level?: number;

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
  Pick<UserProfile, 'nickname' | 'profileImageUrl' | 'fcmToken'>
>;
