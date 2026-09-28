/**
 * 폐쇄 설정 — 관리자 전용 쓰기.
 *
 * ⚠️ `closure` 필드 **하나만** 건드린다. 루트 문서를 통째로 덮어쓰지 않는다 —
 *    제보 화면의 저장과 섞이면 서로의 값을 지운다.
 * ⚠️ 해제는 문서를 지우는 게 아니라 `closed: false` 로 둔다.
 *    누가 언제 풀었는지가 남아야 하고, 다시 닫을 때 사유를 다시 안 써도 된다.
 */
import {
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from '@react-native-firebase/firestore';
import { db } from './firebase';
import { cragIdOf } from '../types/crag';
import type { Closure } from '../types/closure';
import type { ConceptSource } from '../types/concept';

export interface ClosureInput {
  closed: boolean;
  reason?: string;
  since?: string;
  until?: string;
}

/** Firestore 는 undefined 를 거부한다 (cragService 와 같은 이유) */
function payload(input: ClosureInput, uid: string): Closure {
  return {
    closed: input.closed,
    reason: input.reason?.trim() ?? '',
    since: input.since?.trim() ?? '',
    until: input.until?.trim() ?? '',
    updatedBy: uid,
    updatedAt: serverTimestamp() as unknown as Closure['updatedAt'],
  };
}

/** 루트 하나 */
export async function setRouteClosure(
  source: ConceptSource,
  conceptId: string,
  input: ClosureInput,
  uid: string,
): Promise<void> {
  await updateDoc(doc(db, source, conceptId), { closure: payload(input, uid) });
}

/**
 * 구역(암장) 통째.
 * ⚠️ `crags` 문서가 **없는 구역이 대부분이다**(967개 중 대부분 비어 있음).
 *    그래서 updateDoc 이 아니라 merge setDoc 이다 — 없으면 만들어야 한다.
 */
export async function setCragClosure(
  mountain: string,
  zone: string | undefined,
  input: ClosureInput,
  uid: string,
): Promise<void> {
  const id = cragIdOf(mountain, zone);
  if (!id) {
    throw new Error('등반지 이름이 없어 폐쇄를 설정할 수 없습니다.');
  }
  await setDoc(
    doc(db, 'crags', id),
    {
      mountain,
      zone: zone ?? '',
      closure: payload(input, uid),
    },
    { merge: true },
  );
}
