/**
 * useMyPage — 마이페이지 프로필 로딩 (v1: users/{uid} StreamBuilder).
 * v2 1차: authStore의 uid로 userStore.fetchProfile 호출(1-shot).
 * TODO: 실시간 스냅샷 필요 시 userStore에 구독 액션 추가(v1은 snapshots()).
 */
import { useEffect } from 'react';
import { useAuthStore } from '../../../stores/authStore';
import { useUserStore } from '../../../stores/userStore';

export function useMyPage() {
  const uid = useAuthStore((s) => s.user?.uid);
  const profile = useUserStore((s) => s.profile);
  const isLoading = useUserStore((s) => s.isLoading);
  const fetchProfile = useUserStore((s) => s.fetchProfile);

  useEffect(() => {
    if (uid) {
      fetchProfile(uid).catch(() => {
        /* 에러는 userStore.error에 반영 */
      });
    }
  }, [uid, fetchProfile]);

  return { uid, profile, isLoading };
}
