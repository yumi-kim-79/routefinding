/**
 * 접속 표시를 앱 전체에서 **한 번만** 건다.
 *
 * ⚠️ `MainTabNavigator` 에서 부른다 — 로그인 후 반드시 지나는 지점이다.
 *    화면마다 붙이는 방식은 쓰지 않는다. 프로필 버그가 그렇게 두 번 재발했다(65차).
 *
 * ⚠️ 앱이 **백그라운드로 가면 표시를 지운다.** "접속 중"은 지금 앱을 보고 있다는 뜻이어야
 *    쓸모가 있다. RTDB 연결은 백그라운드에서도 한동안 살아 있어서, 그대로 두면
 *    주머니 속 폰이 전부 접속 중으로 잡힌다.
 *
 * 🚨 **연결은 `uid` 에만 매단다. 닉네임·사진 변화로 다시 연결하지 않는다.**
 *    처음엔 `[uid, nickname, photoUrl]` 을 의존성에 뒀는데, 그러면 앱을 켤 때마다
 *      ① 프로필이 아직 없는 상태로 한 번 쓰고(닉네임 빈칸)
 *      ② 프로필이 도착하면 지웠다가 다시 쓴다
 *    가 되어 노드가 **두 번 생성**된다. 집계 함수는 `onValueCreated` 라
 *    **접속 횟수와 시간대 통계가 그대로 2배가 된다.** 정작 이 기능이 보려던 숫자가 틀어진다.
 *    → 표시용 값이 바뀌면 지우지 말고 `touchIdentity()` 로 **덮어쓰기만** 한다.
 *       (덮어쓰기는 생성이 아니라서 집계가 다시 돌지 않는다)
 *
 * ⚠️ 앱 전환으로 잠깐 나갔다 오는 것은 세지 않는다(REENTRY_GRACE_MS).
 *    카톡 확인하고 돌아올 때마다 '접속 1회'가 쌓이면 시간대 그래프가 의미를 잃는다.
 */
import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useAuthStore } from '../stores/authStore';
import { useUserStore } from '../stores/userStore';
import { goOnline, touchIdentity } from '../services/presenceService';

/** 이 시간 안에 돌아오면 같은 접속으로 본다 */
const REENTRY_GRACE_MS = 60_000;

export function usePresence(): void {
  const uid = useAuthStore((s) => s.user?.uid);
  const profile = useUserStore((s) => s.profile);
  const nickname = profile?.nickname ?? '';
  const photoUrl = profile?.photoUrl;

  /** goOnline 이 쓸 최신 표시값 — 의존성에 넣지 않으려고 ref 로 든다 */
  const idRef = useRef({ nickname, photoUrl });
  idRef.current = { nickname, photoUrl };

  const onlineRef = useRef(false);
  const leftAtRef = useRef(0);

  useEffect(() => {
    if (!uid) {
      return;
    }
    let stop: (() => void) | null = null;

    const start = () => {
      if (stop) {
        return;
      }
      stop = goOnline(uid, () => idRef.current);
      onlineRef.current = true;
    };
    const end = () => {
      stop?.();
      stop = null;
      onlineRef.current = false;
      leftAtRef.current = Date.now();
    };

    if (AppState.currentState === 'active') {
      start();
    }

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        start();
      } else if (Date.now() - leftAtRef.current > REENTRY_GRACE_MS || onlineRef.current) {
        end();
      }
    });

    return () => {
      sub.remove();
      end();
    };
  }, [uid]);

  /** 표시값만 갱신 — 노드를 다시 만들지 않는다 (위 머리말) */
  useEffect(() => {
    if (uid && onlineRef.current && nickname) {
      touchIdentity(uid, { nickname, photoUrl });
    }
  }, [uid, nickname, photoUrl]);
}
