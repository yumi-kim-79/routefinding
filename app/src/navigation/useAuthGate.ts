/**
 * 인증 게이트 (스텁).
 *
 * Phase 1-3에서는 네비게이션 분기 골격만 검증한다.
 * 실제 인증 상태는 Phase 1-4의 `authStore`(상태관리 [TBD: Zustand 등]) +
 * Firebase Auth `onAuthStateChanged`로 연결한다.
 *
 * TODO(Phase 1-4): authStore 연동, 부팅 시 자동 로그인 체크.
 */
export interface AuthGateState {
  isLoading: boolean;
  isAuthenticated: boolean;
}

export function useAuthGate(): AuthGateState {
  // 스텁: 미인증 상태로 고정 → AuthStack(스플래시/로그인) 노출.
  return { isLoading: false, isAuthenticated: false };
}
