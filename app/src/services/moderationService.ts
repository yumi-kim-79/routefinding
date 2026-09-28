/**
 * 신고 · 차단 — 사용자 생성 콘텐츠(UGC) 안전장치.
 *
 * ⚠️ 이 파일은 **선택 기능이 아니다.** Apple 심사지침 1.2 는 UGC 앱에
 *    (1) 불쾌한 콘텐츠 신고, (2) 사용자 차단, (3) 신고 콘텐츠 자동/수동 제거,
 *    (4) 24시간 내 처리, (5) 연락 수단 을 **전부** 요구한다.
 *    하나라도 빠지면 반려된다. 지우거나 화면에서 떼어내지 말 것.
 *
 * 동작 방식:
 *   신고 → abuse_reports 문서 1개 + 대상의 reportCount +1
 *   reportCount 가 HIDE_REPORT_THRESHOLD(3) 이상이면 **관리자 확인 전에 자동으로 숨는다**
 *   (types/communityPost.ts 의 isHidden — 목록·상세 양쪽에서 거른다).
 *
 * ⚠️ 자동숨김을 서버 쿼리로 하지 않는 이유: Firestore 는 부등호 조건과
 *    다른 필드 정렬을 같이 못 쓴다. 그래서 클라이언트에서 거른다
 *    (communityService.ts 머리말과 같은 이유).
 */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from '@react-native-firebase/firestore';
import { db } from './firebase';

export type ReportTarget = 'post' | 'comment' | 'user';

/** 신고 사유 — 목록 순서가 그대로 화면에 뜬다 */
export const REPORT_REASONS = [
  '욕설 · 비방',
  '음란물 · 혐오',
  '스팸 · 광고',
  '사기 의심 (거래)',
  '개인정보 노출',
  '기타',
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

/**
 * 신고 접수.
 *
 * @param postId  댓글을 신고할 때만 필요 (댓글은 글의 하위 컬렉션이라 경로에 글 ID 가 든다)
 *
 * ⚠️ 신고 문서와 카운터 증가는 **두 번의 쓰기**다. 트랜잭션이 아니어서
 *    카운터만 실패하면 자동숨김이 늦어질 수 있지만, 관리자 목록에는 남는다.
 *    반대로 하면(카운터 먼저) 신고 기록 없이 숫자만 오르므로 이 순서를 지킬 것.
 */
export async function reportContent(args: {
  targetType: ReportTarget;
  targetId: string;
  postId?: string;
  reason: ReportReason | string;
  detail?: string;
  reporterUid: string;
  authorUid?: string;
}): Promise<void> {
  await addDoc(collection(db, 'abuse_reports'), {
    targetType: args.targetType,
    targetId: args.targetId,
    ...(args.postId ? { postId: args.postId } : {}),
    ...(args.authorUid ? { authorUid: args.authorUid } : {}),
    reason: args.reason,
    detail: args.detail ?? '',
    reporterUid: args.reporterUid,
    status: 'open',
    createdAt: serverTimestamp(),
  });

  if (args.targetType === 'post') {
    await updateDoc(doc(db, 'community_posts', args.targetId), { reportCount: increment(1) });
  } else if (args.targetType === 'comment' && args.postId) {
    await updateDoc(doc(db, 'community_posts', args.postId, 'comments', args.targetId), {
      reportCount: increment(1),
    });
  }
}

// ── 차단 ──────────────────────────────────────────────
//
// 차단은 **내 화면에서만** 상대가 사라지는 단방향 기능이다.
// 상대에게 알리지 않고, 상대 화면에는 내 글이 그대로 보인다.

export async function blockUser(myUid: string, targetUid: string, nickname?: string): Promise<void> {
  await setDoc(doc(db, 'users', myUid, 'blocked', targetUid), {
    nickname: nickname ?? '',
    createdAt: serverTimestamp(),
  });
}

export async function unblockUser(myUid: string, targetUid: string): Promise<void> {
  await deleteDoc(doc(db, 'users', myUid, 'blocked', targetUid));
}

/** 차단 목록 실시간 구독 — 문서 ID 가 곧 차단된 uid 다 */
export function subscribeBlocked(
  myUid: string,
  onData: (uids: Set<string>) => void,
): () => void {
  return onSnapshot(
    collection(db, 'users', myUid, 'blocked'),
    (snap) => onData(new Set(snap.docs.map((d) => d.id))),
    // 실패해도 화면이 멈추면 안 된다 — 차단이 안 걸린 상태로 계속 본다
    (e) => console.warn('[blocked]', e.message),
  );
}

/** 마이페이지 ▸ 차단 관리용 */
export async function fetchBlocked(myUid: string): Promise<{ uid: string; nickname: string }[]> {
  const snap = await getDocs(collection(db, 'users', myUid, 'blocked'));
  return snap.docs.map((d) => ({
    uid: d.id,
    nickname: (d.data() as { nickname?: string }).nickname || '(이름 없음)',
  }));
}

// ── 관리자 ────────────────────────────────────────────
//
// ⚠️ Apple 심사지침 1.2 는 **24시간 내 처리**를 요구한다.
//    아래 화면(마이페이지 ▸ 신고 관리)이 그 처리 창구다.

export interface AbuseReport {
  id: string;
  targetType: ReportTarget;
  targetId: string;
  postId?: string;
  authorUid?: string;
  reason: string;
  detail: string;
  reporterUid: string;
  status: 'open' | 'removed' | 'ignored';
  createdAt?: { toDate: () => Date };
}

/**
 * 신고 목록 (관리자 전용).
 *
 * ⚠️ `orderBy('createdAt')` 단독이라 복합 색인이 필요 없다.
 *    상태로 거르는 건 화면에서 한다 — 조건을 붙이면 색인이 하나 더 필요해진다.
 */
export function subscribeReports(
  onData: (list: AbuseReport[]) => void,
  onError: (message: string) => void,
): () => void {
  const q = query(collection(db, 'abuse_reports'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) =>
      onData(
        snap.docs.map((d) => {
          const v = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            targetType: (v.targetType as ReportTarget) ?? 'post',
            targetId: typeof v.targetId === 'string' ? v.targetId : '',
            postId: typeof v.postId === 'string' ? v.postId : undefined,
            authorUid: typeof v.authorUid === 'string' ? v.authorUid : undefined,
            reason: typeof v.reason === 'string' ? v.reason : '',
            detail: typeof v.detail === 'string' ? v.detail : '',
            reporterUid: typeof v.reporterUid === 'string' ? v.reporterUid : '',
            status: (v.status as AbuseReport['status']) ?? 'open',
            createdAt: v.createdAt as AbuseReport['createdAt'],
          };
        }),
      ),
    (e) => onError(e.message),
  );
}

/** 신고 처리 — '삭제함' 또는 '문제 없음' */
export async function resolveReport(
  reportId: string,
  status: 'removed' | 'ignored',
): Promise<void> {
  await updateDoc(doc(db, 'abuse_reports', reportId), {
    status,
    resolvedAt: serverTimestamp(),
  });
}

/**
 * 신고된 콘텐츠 삭제 (관리자).
 * 신고 문서는 남긴다 — 처리 이력이 있어야 재신고를 판단할 수 있다.
 */
export async function removeReported(r: AbuseReport): Promise<void> {
  if (r.targetType === 'post') {
    await deleteDoc(doc(db, 'community_posts', r.targetId));
  } else if (r.targetType === 'comment' && r.postId) {
    await deleteDoc(doc(db, 'community_posts', r.postId, 'comments', r.targetId));
  }
  await resolveReport(r.id, 'removed');
}
