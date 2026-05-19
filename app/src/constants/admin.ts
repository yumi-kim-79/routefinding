/**
 * 관리자 / 이메일 인증 게이트 상수 (v1 1:1 보존).
 *
 * TODO(Phase 2-5): adminEmails 하드코딩 → Firebase Custom Claims로 이전
 * (docs/02_DATA_MODEL.md §관리자 권한, docs/05_ROADMAP.md 2-5-4).
 */

/** v1 `login_screen.dart` / `constants/level.dart`의 adminEmails와 동일 */
export const ADMIN_EMAILS = ['yusung790926@gmail.com'] as const;

/**
 * v1 이메일 인증 컷오프: 2025-05-01 05:00:00 UTC.
 * 이 시점 이전 가입자(또는 createdAt 없음)는 "예전 유저"로 인증 면제.
 */
export const EMAIL_VERIFICATION_CUTOFF = new Date(
  Date.UTC(2025, 4, 1, 5, 0, 0),
);

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && (ADMIN_EMAILS as readonly string[]).includes(email);
}
