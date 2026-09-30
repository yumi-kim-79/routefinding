/**
 * 접속 표시를 앱 전체에서 **한 번만** 건다.
 *
 * ⚠️ `MainTabNavigator` 에서 부른다 — 로그인 후 반드시 지나는 지점이다.
 *    화면마다 붙이는 방식은 쓰지 않는다. 프로필 버그가 그렇게 두 번 재발했다
 *    (CHANGELOG 65차). 같은 실수를 반복하지 않는다.
 *
 * ⚠️ 앱이 **백그라운드로 가면 표시를 지운다.** "접속 중"은 지금 앱을 보고 있다는 뜻이어야
 *    쓸모가 있다. RTDB 연결은 백그라운드에서도 한동안 살아 있어서, 그대로 두면
 *    주머니 속 폰이 전부 접속 중으로 잡힌다.
 */
import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useAuthStore } from '../stores/authStore';
import { useUserStore } from '../stores/userStore';
import { goOnline } from '../services/presenceService';

export function usePresence(): void {
  const uid = useAuthStore((s) => s.user?.uid);
  const profile = useUserStore((s) => s.profile);
  const nickname = profile?.nickname ?? '';
  const photoUrl = profile?.photoUrl;

  useEffect(() => {
    if (!uid) {
      return;
    }
    let stop: (() => void) | null = null;

    const start = () => {
      if (!stop) {
        stop = goOnline({ uid, nickname, photoUrl });
      }
    };
    const end = () => {
      stop?.();
      stop = null;
    };

    if (AppState.currentState === 'active') {
      start();
    }

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        start();
      } else {
        end();
      }
    });

    return () => {
      sub.remove();
      end();
    };
  }, [uid, nickname, photoUrl]);
}
