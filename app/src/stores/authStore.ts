/**
 * authStore — 인증 상태 (Zustand).
 *
 * 단일 출처 = Firebase Auth 네이티브 세션. store는 이를 **반영만** 한다.
 * persist 없음(Phase 1-4 결정 A): 앱 재시작 시 RNFB가 세션을 복원하고
 * `initialize()`의 `onAuthStateChanged`가 store를 동기화한다 (v1 자동 로그인 동등).
 */
import { create } from 'zustand';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
} from '@react-native-firebase/auth';
import { auth } from '../services/firebase';
import { type AuthUser, toAuthUser } from '../types/auth';

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  /** 첫 onAuthStateChanged 수신 전까지 true (스플래시 표시용) */
  isInitializing: boolean;
  error: string | null;

  /** 앱 시작 시 1회 호출. 인증 상태 구독 시작. 구독 해제 함수 반환. */
  initialize: () => () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

let unsubscribe: (() => void) | null = null;

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isInitializing: true,
  error: null,

  initialize: () => {
    // 중복 구독 가드
    if (unsubscribe) {
      return unsubscribe;
    }
    unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      set({
        user: fbUser ? toAuthUser(fbUser) : null,
        isAuthenticated: !!fbUser,
        isInitializing: false,
      });
    });
    return unsubscribe;
  },

  signIn: async (email, password) => {
    set({ error: null });
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // 상태 반영은 onAuthStateChanged가 담당 (단일 출처 유지)
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '로그인 실패' });
      throw e;
    }
  },

  signUp: async (email, password) => {
    // 프로필 문서(users/{uid}) 생성은 Phase 2 SignUp 화면 + userStore에서.
    set({ error: null });
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '회원가입 실패' });
      throw e;
    }
  },

  signOut: async () => {
    set({ error: null });
    try {
      await fbSignOut(auth);
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '로그아웃 실패' });
      throw e;
    }
  },
}));
