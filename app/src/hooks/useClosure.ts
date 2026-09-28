/**
 * 폐쇄 안내 상태 — 개념도 상세가 쓴다.
 *
 * 하는 일 둘:
 *   ① 루트 폐쇄 + 구역 폐쇄를 합쳐 **실제로 보여줄 하나**를 고른다
 *   ② 큰 안내창(모달)을 **언제 띄울지** 판단한다
 *
 * ⚠️ 닫은 기록을 저장소에 남기지 않는다 (모듈 레벨 Set).
 *    앱을 완전히 껐다 켜면 초기화돼 다시 한 번 뜬다.
 *    `useUpdateGate` 가 같은 선택을 했다 — AsyncStorage 의존성을 새로 들이지 않는 쪽이다.
 *    **여기서는 그게 오히려 맞다.** 폐쇄는 안전에 걸린 정보라, 앱을 새로 켤 때
 *    한 번 더 보는 편이 낫다. 같은 실행 안에서만 조용하다.
 *
 * ⚠️ 안내문이 **바뀌면 닫았던 것도 다시 뜬다** (`closureKey`).
 *    기간이 연장됐는데 조용히 넘어가면 안내를 안 한 것과 같다.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  closureKey,
  effectiveClosure,
  type ActiveClosure,
} from '../types/closure';
import { cragDisplayName, type Crag } from '../types/crag';
import type { Concept } from '../types/concept';

/** 이번 실행에서 이미 닫은 안내 (내용이 바뀌면 열쇠가 달라져 다시 뜬다) */
const dismissed = new Set<string>();

export interface UseClosureResult {
  /** 폐쇄 중이면 안내 내용, 아니면 null */
  closure: ActiveClosure | null;
  /** 큰 안내창을 지금 띄울지 */
  modalOpen: boolean;
  dismissModal: () => void;
  /** 배너를 눌러 큰 안내를 다시 열 때 */
  openModal: () => void;
}

export function useClosure(
  concept: Concept | null | undefined,
  crag: Crag | null | undefined,
): UseClosureResult {
  const closure = useMemo(
    () =>
      concept
        ? effectiveClosure(concept.closure, crag?.closure, {
            routeName: concept.routeName,
            cragName: cragDisplayName(concept.mountain, concept.zone),
          })
        : null,
    [concept, crag],
  );

  const key = concept && closure ? closureKey(concept.id, closure) : null;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!key) {
      setOpen(false);
      return;
    }
    setOpen(!dismissed.has(key));
  }, [key]);

  const dismissModal = useCallback(() => {
    if (key) {
      dismissed.add(key);
    }
    setOpen(false);
  }, [key]);

  const openModal = useCallback(() => setOpen(true), []);

  return { closure, modalOpen: open, dismissModal, openModal };
}
