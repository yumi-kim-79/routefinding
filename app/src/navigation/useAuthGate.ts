/**
 * 인증 게이트 — authStore(Zustand) 반영.
 *
 * Main 진입 조건 = isAuthenticated && gatePassed (Option A, v1 이메일 인증 게이트).
 * 세션 복원/자동로그인은 게이트 면제(gatePassed 자동 true), 명시적 로그인은
 * authStore.signIn이 게이트 판정 후 gatePassed 설정.
 */
import { useAuthStore } from '../stores/authStore';

export interface AuthGateState {
  isLoading: boolean;
  isAuthenticated: boolean;
}

export function useAuthGate(): AuthGateState {
  const isInitializing = useAuthStore((s) => s.isInitializing);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const gatePassed = useAuthStore((s) => s.gatePassed);
  return { isLoading: isInitializing, isAuthenticated: isAuthenticated && gatePassed };
}
