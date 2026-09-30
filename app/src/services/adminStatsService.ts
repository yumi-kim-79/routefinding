/**
 * 접속 통계 읽기 — **관리자 전용**.
 *
 * ⚠️ 쓰기는 없다. `stats_daily` 는 Cloud Function `countPresence` 만 쓴다
 *    (functions/index.js 머리말). 앱이 직접 올리면 숫자를 조작할 수 있다.
 *
 * ⚠️ 날짜 문자열은 **한국 시간** 기준이다. Function 도 같은 기준으로 쓴다.
 *    한쪽만 UTC 를 쓰면 자정 무렵 하루가 어긋난다.
 */
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
} from '@react-native-firebase/firestore';
import { db } from './firebase';

export interface DailyStat {
  date: string;
  /** 그날 처음 들어온 사람 수 (DAU) */
  users: number;
  /** 앱을 연 횟수 (재접속 포함) */
  opens: number;
  /** 시간대별 접속 횟수 — 길이 24 */
  hours: number[];
}

const COL = 'stats_daily';

/** 오늘 날짜 (한국 시간) 'YYYY-MM-DD' */
export function seoulToday(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

function toDaily(id: string, v: Record<string, unknown>): DailyStat {
  const raw = (v.hours ?? {}) as Record<string, unknown>;
  const hours = Array.from({ length: 24 }, (_, h) => {
    const n = raw[String(h)];
    return typeof n === 'number' ? n : 0;
  });
  return {
    date: typeof v.date === 'string' ? v.date : id,
    users: typeof v.users === 'number' ? v.users : 0,
    opens: typeof v.opens === 'number' ? v.opens : 0,
    hours,
  };
}

/**
 * 최근 N일 (최신이 앞).
 * ⚠️ 규칙이 `allow list: if isAdmin()` 이라 쿼리에 조건을 더 붙이지 않아도 통과한다.
 *    (sends 사고와 다른 점 — CHANGELOG 66차)
 */
export function subscribeRecentStats(
  days: number,
  onData: (list: DailyStat[]) => void,
  onError?: (message: string) => void,
): () => void {
  return onSnapshot(
    query(collection(db, COL), orderBy('date', 'desc'), limit(days)),
    (snap) =>
      onData(
        snap.docs.map((d) => toDaily(d.id, d.data() as Record<string, unknown>)),
      ),
    (e) => onError?.(e.message),
  );
}
