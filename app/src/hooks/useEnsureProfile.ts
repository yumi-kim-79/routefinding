/**
 * 로그인한 사용자의 프로필(`users/{uid}`)이 스토어에 없으면 한 번 읽어 온다.
 *
 * ⚠️ 왜 필요한가 (2026-09-07 실측):
 *    `useUserStore.profile` 은 **마이페이지를 열 때만** 채워졌다 (`useMyPage`).
 *    그래서 앱을 켜고 곧장 커뮤니티로 가면 profile 이 null 이라
 *    **글쓰기 버튼이 아예 안 그려졌다.** 글에 닉네임·사진을 같이 저장해야 해서
 *    profile 을 조건에 넣었는데, 그 값이 어디서 채워지는지가 화면마다 달랐던 것이다.
 *
 * ⚠️ 이미 있으면 다시 읽지 않는다. 화면을 오갈 때마다 문서를 읽으면 그만큼 비용이 된다.
 */
import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useUserStore } from '../stores/userStore';

export function useEnsureProfile(): void {
  const uid = useAuthStore((s) => s.user?.uid);
  const profile = useUserStore((s) => s.profile);
  const fetchProfile = useUserStore((s) => s.fetchProfile);

  useEffect(() => {
    if (uid && profile?.uid !== uid) {
      fetchProfile(uid).catch(() => {
        /* 실패해도 화면은 그대로 — 글쓰기만 잠깐 막힌다 */
      });
    }
  }, [uid, profile?.uid, fetchProfile]);
}
