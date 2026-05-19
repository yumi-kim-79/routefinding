/**
 * authStore — 인증 상태 (Zustand). v1 인증 로직 1:1 보존.
 *
 * 단일 출처 = Firebase Auth 네이티브 세션. persist 없음(Phase 1-4 결정 A).
 *
 * 이메일 인증 게이트(v1 login_screen.dart):
 *   로그인 후 `!emailVerified && !isOldUser && !isAdmin` 이면 signOut + 차단.
 *   - isOldUser: users/{uid}.createdAt < 2025-05-01 05:00 UTC (없으면 true)
 *   - isAdmin:   ADMIN_EMAILS 포함 (TODO Phase 2-5 Custom Claims)
 *
 * 반응형 충돌 해결(Option A): `gatePassed`. RootNavigator는
 * `isAuthenticated && gatePassed`일 때만 Main 노출.
 *   - 세션 복원(passive)·자동로그인 = 게이트 면제(v1 splash는 currentUser만 봄) → gatePassed=true
 *   - 명시적 signIn = 게이트 판정 후 gatePassed 결정 (signingIn 가드로 자동 통과 차단)
 */
import { create } from 'zustand';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile as fbUpdateProfile,
} from '@react-native-firebase/auth';
import {
  doc,
  getDoc,
  type FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';
import { auth, db } from '../services/firebase';
import { COLLECTIONS } from '../constants/firestoreFields';
import {
  EMAIL_VERIFICATION_CUTOFF,
  isAdminEmail,
} from '../constants/admin';
import { type AuthUser, EmailNotVerifiedError, toAuthUser } from '../types/auth';
import { useUserStore } from './userStore';

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  /** 인증 게이트 통과 여부. RootNavigator는 isAuthenticated && gatePassed 시 Main */
  gatePassed: boolean;
  isInitializing: boolean;
  error: string | null;

  initialize: () => () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    nickname: string,
  ) => Promise<void>;
  signOut: () => Promise<void>;
}

let unsubscribe: (() => void) | null = null;
/** 명시적 signIn/signUp 진행 중 — onAuthStateChanged의 자동 gatePassed 억제 */
let signingIn = false;

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  gatePassed: false,
  isInitializing: true,
  error: null,

  initialize: () => {
    if (unsubscribe) {
      return unsubscribe;
    }
    unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      set({
        user: fbUser ? toAuthUser(fbUser) : null,
        isAuthenticated: !!fbUser,
        isInitializing: false,
        // 세션 복원/자동로그인(passive)은 v1처럼 게이트 면제.
        // 명시적 signIn 중(signingIn)이면 signIn 로직이 gatePassed를 결정.
        ...(signingIn ? {} : { gatePassed: !!fbUser }),
      });
    });
    return unsubscribe;
  },

  signIn: async (email, password) => {
    set({ error: null });
    signingIn = true;
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const user = cred.user;
      await reload(user);

      // v1: users/{uid}.createdAt 기준 예전 유저 판정
      let createdAt: FirebaseFirestoreTypes.Timestamp | undefined;
      try {
        const snap = await getDoc(doc(db, COLLECTIONS.USERS, user.uid));
        createdAt = snap.data()?.createdAt as
          | FirebaseFirestoreTypes.Timestamp
          | undefined;
      } catch {
        // 조회 실패 시 createdAt 미확인 → 아래에서 예전 유저로 간주
      }
      const isOldUser = createdAt
        ? createdAt.toDate() < EMAIL_VERIFICATION_CUTOFF
        : true;
      const isAdmin = isAdminEmail(user.email);

      if (!user.emailVerified && !isOldUser && !isAdmin) {
        // 차단: 재발송 클로저 캡처 후 signOut (v1 동작)
        const resend = async () => {
          await sendEmailVerification(user);
        };
        await fbSignOut(auth);
        set({ gatePassed: false });
        throw new EmailNotVerifiedError(resend);
      }

      // 통과 (이메일 인증자 / 예전 유저 / 관리자)
      set({ gatePassed: true });
    } catch (e) {
      if (!(e instanceof EmailNotVerifiedError)) {
        set({ error: e instanceof Error ? e.message : '로그인 실패' });
      }
      throw e;
    } finally {
      signingIn = false;
    }
  },

  signUp: async (email, password, nickname) => {
    set({ error: null });
    signingIn = true;
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const user = cred.user;
      // displayName = 닉네임 (v1 AuthService().signUp displayName)
      await fbUpdateProfile(user, { displayName: nickname.trim() });
      // 프로필 문서 생성 (userStore — 인증 상태에서 써야 함, signOut 전)
      await useUserStore
        .getState()
        .createProfile(user.uid, { nickname: nickname.trim(), email });
      await sendEmailVerification(user);
      // v1: 가입 후 자동 로그인하지 않고 로그인 화면으로 → signOut
      await fbSignOut(auth);
      set({ gatePassed: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '회원가입 실패' });
      throw e;
    } finally {
      signingIn = false;
    }
  },

  signOut: async () => {
    set({ error: null });
    try {
      await fbSignOut(auth);
      set({ gatePassed: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '로그아웃 실패' });
      throw e;
    }
  },
}));
