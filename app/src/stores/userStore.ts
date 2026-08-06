/**
 * userStore — Firestore 사용자 프로필 (Zustand).
 *
 * `users/{uid}` 문서를 읽고/수정한다 (docs/02_DATA_MODEL.md User 스키마).
 * 기존 Firestore 구조 변경 금지 — 읽기/부분 수정만.
 */
import { create } from 'zustand';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from '@react-native-firebase/firestore';
import { db } from '../services/firebase';
import { FUNCTIONS_BASE_URL } from '../constants/firebase';
import { COLLECTIONS } from '../constants/firestoreFields';
import type { UserProfile, UserProfileUpdate } from '../types/user';

interface UserState {
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;

  fetchProfile: (uid: string) => Promise<void>;
  updateProfile: (uid: string, patch: UserProfileUpdate) => Promise<void>;
  /** 닉네임 사용 가능 여부 (v1: users where nickname == nick) */
  isNicknameAvailable: (nickname: string) => Promise<boolean>;
  /** 회원가입 시 프로필 문서 생성 (v1과 동일 필드만) */
  createProfile: (
    uid: string,
    data: { nickname: string; email: string },
  ) => Promise<void>;
  clear: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  profile: null,
  isLoading: false,
  error: null,

  fetchProfile: async (uid) => {
    set({ isLoading: true, error: null });
    try {
      const snap = await getDoc(doc(db, COLLECTIONS.USERS, uid));
      if (snap.exists()) {
        set({
          profile: { uid, ...snap.data() } as UserProfile,
          isLoading: false,
        });
      } else {
        set({ profile: null, isLoading: false });
      }
    } catch (e) {
      set({
        isLoading: false,
        error: e instanceof Error ? e.message : '프로필 조회 실패',
      });
      throw e;
    }
  },

  updateProfile: async (uid, patch) => {
    set({ error: null });
    try {
      await updateDoc(doc(db, COLLECTIONS.USERS, uid), {
        ...patch,
        updatedAt: serverTimestamp(),
      });
      set((s) =>
        s.profile && s.profile.uid === uid
          ? { profile: { ...s.profile, ...patch } }
          : {},
      );
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '프로필 수정 실패' });
      throw e;
    }
  },

  /**
   * 닉네임 중복 확인.
   *
   * ⚠️ **Firestore 를 직접 조회하면 안 된다** (2026-08-06 실측).
   *    회원가입은 로그인 **전**에 일어나는데, firestore.rules 의
   *    `match /users/{userId} { allow read: if isSignedIn(); }` 때문에
   *    비로그인 조회가 거부돼 **신규 가입이 전면 차단돼 있었다.**
   *    ('닉네임 확인 중 오류가 발생했습니다'만 떴다)
   *
   *    규칙을 되돌릴 수는 없다 — users 문서에 **이메일**이 들어 있다.
   *    → Cloud Function 이 서버에서 확인하고 불리언만 돌려준다
   *      (`functions/index.js` 의 `checkNickname`).
   */
  isNicknameAvailable: async (nickname) => {
    const nick = nickname.trim();
    const res = await fetch(
      `${FUNCTIONS_BASE_URL}/checkNickname?nickname=${encodeURIComponent(nick)}`,
    );
    if (!res.ok) {
      throw new Error(`닉네임 확인 실패 (HTTP ${res.status})`);
    }
    const json = (await res.json()) as { available?: boolean };
    return json.available === true;
  },

  createProfile: async (uid, data) => {
    // v1 sign_up_screen.dart과 동일: nickname/email/createdAt만 기록
    await setDoc(doc(db, COLLECTIONS.USERS, uid), {
      nickname: data.nickname,
      email: data.email,
      createdAt: serverTimestamp(),
    });
  },

  clear: () => set({ profile: null, error: null }),
}));
