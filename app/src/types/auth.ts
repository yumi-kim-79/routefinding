/**
 * 인증 타입.
 *
 * 인증 세션의 단일 출처는 Firebase Auth(네이티브 영속). store는 이를 반영만 한다
 * (별도 persist 없음 — docs/05_ROADMAP.md Phase 1-4 결정 A).
 */
import type { FirebaseAuthTypes } from '@react-native-firebase/auth';

/** 앱에서 쓰는 최소 인증 사용자 (Firebase user에서 파생) */
export interface AuthUser {
  uid: string;
  email: string | null;
  emailVerified: boolean;
}

export function toAuthUser(user: FirebaseAuthTypes.User): AuthUser {
  return {
    uid: user.uid,
    email: user.email,
    emailVerified: user.emailVerified,
  };
}
