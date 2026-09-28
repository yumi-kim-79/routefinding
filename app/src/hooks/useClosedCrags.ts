/**
 * 닫힌 구역 id 집합 — 목록·지도에서 배지를 달 때 쓴다.
 *
 * ⚠️ 루트 단위 폐쇄는 여기서 보지 않는다. 그건 개념도 문서의 `closure` 라
 *    이미 목록이 들고 있는 값이다(`conceptService` 가 문서를 통째로 읽는다).
 *    이 훅은 **구역 폐쇄를 루트에 내려 꽂기 위한 것**이다.
 */
import { useEffect, useState } from 'react';
import { subscribeClosedCragIds } from '../services/cragService';
import { cragIdOf } from '../types/crag';
import { isClosed } from '../types/closure';
import type { Concept } from '../types/concept';

export function useClosedCrags(): {
  closedCragIds: Set<string>;
  /** 이 루트가 (루트 단위든 구역 단위든) 닫혀 있는가 */
  isConceptClosed: (c: Concept) => boolean;
} {
  const [ids, setIds] = useState<Set<string>>(new Set());

  useEffect(
    () =>
      subscribeClosedCragIds(setIds, (msg) => {
        // 실패해도 목록은 그대로 보여준다 — 배지만 안 달린다
        // eslint-disable-next-line no-console
        console.warn('[crags] 폐쇄 구역 구독 실패:', msg);
      }),
    [],
  );

  const isConceptClosed = (c: Concept): boolean => {
    if (isClosed(c.closure)) {
      return true;
    }
    const id = cragIdOf(c.mountain, c.zone);
    return id ? ids.has(id) : false;
  };

  return { closedCragIds: ids, isConceptClosed };
}
