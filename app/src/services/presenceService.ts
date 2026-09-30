/**
 * 실시간 접속 현황 — **Realtime Database** (Firestore 아님).
 *
 * ⚠️ **왜 Firestore 가 아닌가.** Firestore 에는 `onDisconnect()` 가 없다.
 *    앱을 강제 종료하거나 산에서 신호가 끊기면 "나갔다"를 기록할 방법이 없어
 *    접속 중 목록에 유령이 계속 쌓인다. 이 앱은 산에서 쓰는 앱이라 그게 예외가 아니다.
 *    RTDB 는 **서버가** 연결 종료를 감지해 미리 등록해 둔 삭제를 대신 실행한다.
 *
 * ⚠️ 순서가 중요하다: **`onDisconnect` 를 먼저 걸고 그 다음에 쓴다.**
 *    거꾸로 하면 쓰기와 예약 사이에 끊겼을 때 유령이 영원히 남는다.
 *
 * ⚠️ 통계(`stats_daily`)는 **여기서 쓰지 않는다.** Cloud Function 이 이 노드를 보고 센다.
 *    클라이언트가 직접 올리면 누구나 숫자를 조작할 수 있다.
 *
 * 🚨 선행 작업: Firebase 콘솔에서 **Realtime Database 를 만들어야** 동작한다.
 *    만든 뒤 `google-services.json` · `GoogleService-Info.plist` 를 다시 받아야
 *    앱이 접속할 주소를 안다. 지금 두 파일에는 URL 이 없다 (2026-09-30 확인).
 */
import { Platform } from 'react-native';
import {
  getDatabase,
  onDisconnect,
  onValue,
  ref,
  remove,
  serverTimestamp,
  set,
  update,
} from '@react-native-firebase/database';

export interface PresenceUser {
  uid: string;
  nickname: string;
  photoUrl?: string;
  platform: string;
  /** 접속 시작 (RTDB 서버 시각, ms) */
  since?: number;
}

const PATH = 'presence';

/**
 * 접속 표시 시작. 반환값을 호출하면 표시를 지운다.
 *
 * `.info/connected` 는 RTDB 가 스스로 관리하는 특수 노드다. 연결이 살아날 때마다
 * true 로 바뀌므로, **재연결될 때마다 onDisconnect 를 다시 걸어야 한다** —
 * 한 번 실행된 예약은 사라지기 때문이다.
 */
export function goOnline(
  uid: string,
  getIdentity: () => { nickname: string; photoUrl?: string },
): () => void {
  const db = getDatabase();
  const myRef = ref(db, `${PATH}/${uid}`);
  const connectedRef = ref(db, '.info/connected');

  const unsub = onValue(connectedRef, (snap) => {
    if (snap.val() !== true) {
      return;
    }
    const me = getIdentity();
    // ① 먼저 "끊기면 지워라"를 예약하고 ② 그 다음에 쓴다
    onDisconnect(myRef)
      .remove()
      .then(() =>
        set(myRef, {
          nickname: me.nickname || '이름 없음',
          ...(me.photoUrl ? { photoUrl: me.photoUrl } : {}),
          platform: Platform.OS,
          since: serverTimestamp(),
        }),
      )
      .catch(() => {
        // 접속 표시는 **실패해도 앱이 멈추면 안 된다**. 통계일 뿐이다.
      });
  });

  return () => {
    unsub();
    void remove(myRef).catch(() => undefined);
  };
}

/**
 * 닉네임·사진만 덮어쓴다.
 *
 * 🚨 **지우고 다시 쓰지 않는다.** 집계 함수가 `onValueCreated` 라, 다시 만들면
 *    접속 횟수가 한 번 더 세어진다. 덮어쓰기는 생성이 아니라 집계를 건드리지 않는다.
 */
export function touchIdentity(
  uid: string,
  me: { nickname: string; photoUrl?: string },
): void {
  const db = getDatabase();
  void update(ref(db, `${PATH}/${uid}`), {
    nickname: me.nickname || '이름 없음',
    ...(me.photoUrl ? { photoUrl: me.photoUrl } : {}),
  }).catch(() => undefined);
}

/** 지금 접속 중인 사람들 (관리자 대시보드) */
export function subscribePresence(
  onData: (list: PresenceUser[]) => void,
  onError?: (message: string) => void,
): () => void {
  const db = getDatabase();
  return onValue(
    ref(db, PATH),
    (snap) => {
      const v = (snap.val() ?? {}) as Record<string, Record<string, unknown>>;
      const list: PresenceUser[] = Object.entries(v).map(([uid, d]) => ({
        uid,
        nickname: typeof d.nickname === 'string' ? d.nickname : '이름 없음',
        photoUrl: typeof d.photoUrl === 'string' ? d.photoUrl : undefined,
        platform: typeof d.platform === 'string' ? d.platform : '-',
        since: typeof d.since === 'number' ? d.since : undefined,
      }));
      // 최근 접속이 위로
      list.sort((a, b) => (b.since ?? 0) - (a.since ?? 0));
      onData(list);
    },
    (e: Error) => onError?.(e.message),
  );
}
