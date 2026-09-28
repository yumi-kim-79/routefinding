/**
 * 폐쇄 안내 — 루트 단위 · 구역(암장) 단위.
 *
 * 왜 필요한가 (2026-09-15 요청):
 *   자연암벽은 사유지 분쟁·낙석·산불·문화재 보수·새 번식기 같은 이유로 **한동안 닫혔다가
 *   다시 열린다.** 닫혔다고 개념도를 지우면, 열렸을 때 자료를 처음부터 다시 만들어야 한다.
 *
 * ⚠️ 그래서 폐쇄는 **삭제가 아니다.**
 *    · 개념도는 그대로 보인다 (사진·피치·난이도 전부)
 *    · 제보·수정·완등 기록도 막지 않는다
 *    · 관리자가 체크만 풀면 원래대로 돌아온다
 *    막아 버리면 "닫혔으니 지우자"로 이어지고, 그게 자료가 사라지는 경로다.
 *
 * ⚠️ 두 단위가 **겹칠 수 있다.** 구역이 통째로 닫혔는데 그 안의 루트에도 따로
 *    폐쇄가 걸린 경우다. 그때는 **루트 쪽을 먼저 보여준다** (`effectiveClosure`) —
 *    더 좁고 구체적인 안내가 사용자에게 쓸모 있다.
 */
import type { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

export interface Closure {
  /** 이 값만 false 로 바꾸면 해제된다. 문서를 지우지 않는다 — 이력이 남아야 한다 */
  closed: boolean;
  /** 안내문 본문. 비어 있으면 기본 문구를 쓴다 */
  reason?: string;
  /** 'YYYY-MM-DD' — 표시용. 비워도 된다 */
  since?: string;
  /** 'YYYY-MM-DD' — 비우면 '해제 시까지' 로 표시한다 */
  until?: string;
  updatedBy?: string;
  updatedAt?: FirebaseFirestoreTypes.Timestamp;
}

/** 어느 단위에서 온 폐쇄인지 — 안내문 제목이 달라진다 */
export type ClosureLevel = 'route' | 'crag';

export interface ActiveClosure extends Closure {
  level: ClosureLevel;
  /** '인수봉 동면2' — 구역 폐쇄일 때 어디가 닫혔는지 */
  scopeName: string;
}

export const DEFAULT_CLOSURE_REASON =
  '현재 등반이 제한되고 있습니다. 자세한 사정은 확인 중입니다.';

export function isClosed(c: Closure | undefined | null): boolean {
  return c?.closed === true;
}

/**
 * 루트 폐쇄와 구역 폐쇄를 합쳐 **실제로 보여줄 하나**를 고른다.
 * 루트가 우선이다 (위 머리말 참조).
 */
export function effectiveClosure(
  route: Closure | undefined | null,
  crag: Closure | undefined | null,
  names: { routeName?: string; cragName?: string },
): ActiveClosure | null {
  if (isClosed(route)) {
    return {
      ...(route as Closure),
      level: 'route',
      scopeName: names.routeName?.trim() || '이 루트',
    };
  }
  if (isClosed(crag)) {
    return {
      ...(crag as Closure),
      level: 'crag',
      scopeName: names.cragName?.trim() || '이 구역',
    };
  }
  return null;
}

/** 기간 한 줄 — '2026-09-01부터 해제 시까지' */
export function closurePeriod(c: Closure): string {
  const from = c.since?.trim();
  const to = c.until?.trim();
  if (!from && !to) {
    return '';
  }
  if (from && to) {
    return `${from} ~ ${to}`;
  }
  if (from) {
    return `${from}부터 해제 시까지`;
  }
  return `${to}까지`;
}

/**
 * 안내문이 **바뀌었는지** 판단하는 열쇠.
 *
 * 모달은 한 번만 띄우되(사용자 결정), **내용이 바뀌면 다시 띄워야 한다.**
 * 기간이 연장됐거나 사유가 달라졌는데 조용히 넘어가면 안내를 안 한 것과 같다.
 */
export function closureKey(conceptId: string, c: ActiveClosure): string {
  return [conceptId, c.level, c.reason ?? '', c.since ?? '', c.until ?? ''].join('|');
}
