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

/**
 * 이메일 미인증으로 로그인 차단(v1 게이트). LoginScreen이 잡아
 * "이메일 인증 필요" 다이얼로그 + 재발송 버튼을 띄운다.
 */
export class EmailNotVerifiedError extends Error {
  /** v1: 차단 후 사용자 요청 시 인증메일 재발송 */
  resend: () => Promise<void>;
  constructor(resend: () => Promise<void>) {
    super('email-not-verified');
    this.name = 'EmailNotVerifiedError';
    this.resend = resend;
  }
}
