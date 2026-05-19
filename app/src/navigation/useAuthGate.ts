/**
 * 인증 게이트 — authStore(Zustand) 반영.
 *
 * 인증 세션의 단일 출처는 Firebase Auth 네이티브. `initialize()`(App.tsx에서 1회 호출)의
 * `onAuthStateChanged`가 store를 동기화하면 RootNavigator가 자동 분기한다.
 */
import { useAuthStore } from '../stores/authStore';

export interface AuthGateState {
  isLoading: boolean;
  isAuthenticated: boolean;
}

export function useAuthGate(): AuthGateState {
  const isInitializing = useAuthStore((s) => s.isInitializing);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return { isLoading: isInitializing, isAuthenticated };
}
