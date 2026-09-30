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
  getCountFromServer,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  type FirebaseFirestoreTypes,
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


/* ═══════════════════════════════════════════════════════════════
 * 회원 — 2026-09-30
 *
 * ⚠️ 규칙이 `allow list: if isAdmin()` 이다. 관리자가 아니면 아래 함수는 전부 거부된다.
 *    그게 의도다 — 전에는 로그인한 누구나 전체 회원 이메일을 긁어갈 수 있었다.
 * ═══════════════════════════════════════════════════════════════ */

export interface Member {
  uid: string;
  nickname: string;
  photoUrl?: string;
  /** 마스킹한 이메일 — 원문은 화면에 두지 않는다 */
  emailMasked?: string;
  joinedAt?: Date;
  /** 오늘 만든 필드. 옛 회원에게는 없다 */
  lastSeenDate?: string;
}

/** `yusung790926@gmail.com` → `yus***@gmail.com` */
function maskEmail(v: unknown): string | undefined {
  if (typeof v !== 'string' || !v.includes('@')) {
    return undefined;
  }
  const [id, domain] = v.split('@');
  const head = id.slice(0, Math.min(3, id.length));
  return `${head}***@${domain}`;
}

function toMember(id: string, v: Record<string, unknown>): Member {
  const ts = v.createdAt as FirebaseFirestoreTypes.Timestamp | undefined;
  return {
    uid: id,
    nickname: typeof v.nickname === 'string' && v.nickname ? v.nickname : '이름 없음',
    photoUrl: typeof v.photoUrl === 'string' ? v.photoUrl : undefined,
    emailMasked: maskEmail(v.email),
    joinedAt: ts?.toDate ? ts.toDate() : undefined,
    lastSeenDate: typeof v.lastSeenDate === 'string' ? v.lastSeenDate : undefined,
  };
}

/**
 * 전체 회원 수.
 * ⚠️ 문서를 다 읽지 않는다 — 집계 쿼리는 **읽기 1건** 값이다.
 *    `getDocs` 로 세면 회원이 늘수록 비용이 그대로 늘어난다.
 */
export async function fetchMemberCount(): Promise<number> {
  const snap = await getCountFromServer(collection(db, 'users'));
  return snap.data().count;
}

export const MEMBER_PAGE = 30;

/**
 * 커서 타입을 **직접 쓰지 않고 추론한다.**
 * ⚠️ RNFB 는 모듈러(`QueryDocumentSnapshot`)와 네임스페이스드
 *    (`FirebaseFirestoreTypes.QueryDocumentSnapshot`) 두 타입이 **서로 호환되지 않는다.**
 *    이름으로 골라 쓰면 버전이 바뀔 때마다 깨진다. `getDocs` 가 실제로 돌려주는 것에서 뽑는다.
 */
type Cursor = Awaited<ReturnType<typeof getDocs>>['docs'][number];

export interface MemberPage {
  items: Member[];
  /** 다음 페이지 시작점 — null 이면 끝 */
  cursor: Cursor | null;
}

/**
 * 최근 가입순 한 페이지.
 *
 * 🚨 `orderBy('createdAt')` 는 **그 필드가 없는 문서를 통째로 제외한다.**
 *    v1 시절 회원 중에 `createdAt` 이 없는 사람이 있을 수 있다 —
 *    그러면 목록 수가 전체 회원 수보다 적게 나온다. 화면에서 그 차이를 밝힌다
 *    (조용히 적게 보여주면 "회원이 줄었나?" 로 읽힌다).
 */
export async function fetchMembers(
  after?: Cursor | null,
): Promise<MemberPage> {
  const base = [orderBy('createdAt', 'desc'), limit(MEMBER_PAGE)] as const;
  const q = after
    ? query(collection(db, 'users'), ...base, startAfter(after))
    : query(collection(db, 'users'), ...base);
  const snap = await getDocs(q);
  return {
    items: snap.docs.map((d) => toMember(d.id, d.data() as Record<string, unknown>)),
    cursor: snap.docs.length === MEMBER_PAGE ? snap.docs[snap.docs.length - 1] : null,
  };
}
