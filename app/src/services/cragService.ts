/**
 * 암장 정보 — `crags`.
 *
 * ⚠️ 좌표는 **입력받지 않는다.** 루트 문서 100%에 좌표가 있고 구역 단위로 같은 값이라
 *    (2026-09-07 실측) 그 구역 루트에서 그대로 가져오면 된다.
 * ⚠️ 문서가 없는 암장이 대부분이다(967개 구역). 없으면 조용히 `null` 을 돌려준다 —
 *    화면은 '정보 없음' 대신 **아무것도 안 그리는 쪽**이 낫다.
 *
 * 🚨 Firestore 는 값이 `undefined` 인 필드를 **거부한다**
 *    (`Unsupported field value: undefined`). 편집 폼은 손대지 않은 칸이 `undefined` 라
 *    그대로 넘기면 저장이 통째로 실패한다 — 2026-09-08 실기기에서 겪은 문제다.
 *    → `stripUndefined` 로 반드시 걸러서 쓴다.
 */
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from '@react-native-firebase/firestore';
import { db } from './firebase';
import { cragDisplayName, cragIdOf, type Crag } from '../types/crag';

const COL = 'crags';

/**
 * `undefined` 필드를 걷어낸다.
 * ⚠️ `null` 은 남긴다 — "값을 지운다"는 뜻으로 쓸 수 있어야 하고, Firestore 도 받는다.
 */
function stripUndefined<T extends Record<string, unknown>>(o: T): Partial<T> {
  const out: Record<string, unknown> = {};
  Object.entries(o).forEach(([k, v]) => {
    if (v !== undefined) {
      out[k] = v;
    }
  });
  return out as Partial<T>;
}

function toCrag(id: string, v: Record<string, unknown>): Crag {
  const num = (x: unknown) => (typeof x === 'number' ? x : undefined);
  const str = (x: unknown) => (typeof x === 'string' && x.trim() ? x : undefined);
  return {
    id,
    mountain: typeof v.mountain === 'string' ? v.mountain : '',
    zone: typeof v.zone === 'string' ? v.zone : '',
    displayName: typeof v.displayName === 'string' ? v.displayName : id,
    description: str(v.description),
    latitude: num(v.latitude),
    longitude: num(v.longitude),
    approachLevel: v.approachLevel as Crag['approachLevel'],
    approachText: str(v.approachText),
    approachMin: num(v.approachMin),
    parking: str(v.parking),
    transit: str(v.transit),
    sun: str(v.sun),
    seasons: Array.isArray(v.seasons) ? (v.seasons as string[]) : undefined,
    toilet: v.toilet === true,
    water: v.water === true,
    notice: str(v.notice),
    /*
     * 🚨 2026-09-15: 이 줄이 빠져 있어서 **구역 폐쇄가 상세 화면에 안 떴다.**
     *    목록 배지는 `subscribeClosedCragIds` 가 쿼리 결과의 문서 id 만 쓰므로 멀쩡했고,
     *    상세만 이 함수를 거쳐서 `closure` 가 사라졌다 — "배지는 보이는데 배너가 없다".
     *
     * ⚠️ **이 함수는 필드를 하나씩 옮긴다.** `Crag` 에 항목을 추가하면 여기도 반드시
     *    같이 고쳐야 한다. 안 고치면 타입은 통과하는데 값만 조용히 사라진다.
     *    (`Concept` 쪽은 스프레드라 이런 일이 안 생긴다 — conceptService.toConcept)
     */
    closure: (v.closure as Crag['closure']) ?? undefined,
    contributors: Array.isArray(v.contributors) ? (v.contributors as string[]) : undefined,
    updatedAt: v.updatedAt as Crag['updatedAt'],
    updatedBy: str(v.updatedBy),
  };
}

export async function fetchCrag(mountain?: string, zone?: string): Promise<Crag | null> {
  const id = cragIdOf(mountain, zone);
  if (!id) {
    return null;
  }
  const snap = await getDoc(doc(db, COL, id));
  const data = snap.data();
  return data ? toCrag(snap.id, data as Record<string, unknown>) : null;
}

export function subscribeCrag(
  mountain: string | undefined,
  zone: string | undefined,
  onData: (crag: Crag | null) => void,
): () => void {
  const id = cragIdOf(mountain, zone);
  if (!id) {
    onData(null);
    return () => undefined;
  }
  return onSnapshot(
    doc(db, COL, id),
    (d) => {
      const v = d.data();
      onData(v ? toCrag(d.id, v as Record<string, unknown>) : null);
    },
    // 실패해도 개념도 화면은 그대로 보여야 한다
    () => onData(null),
  );
}

/**
 * 저장 — **로그인한 사용자면 누구나** (2026-09-07 정책).
 *
 * ⚠️ 제보를 승인 없이 바로 올리기로 한 결정과 같은 방향이다.
 *    관리자 혼자 967개 구역의 접근 정보를 채울 수는 없다.
 *    잘못된 값은 지우면 되지만, 아무도 못 쓰면 정보 자체가 안 생긴다.
 *
 * ⚠️ 대신 **누가 무엇을 바꿨는지 남긴다** (`crags/{id}/edits`).
 *    되돌릴 근거가 없으면 개방은 위험하다. 이력이 사후 관리의 전부다.
 *
 * ⚠️ `setDoc(..., {merge:true})` 를 쓴다. 문서가 없을 수도 있고,
 *    한 번에 일부 항목만 채워 넣는 일이 대부분이다.
 */
export async function saveCrag(
  mountain: string,
  zone: string,
  patch: Partial<Omit<Crag, 'id' | 'mountain' | 'zone' | 'displayName'>>,
  editor: { uid: string; nickname: string },
  coords?: { latitude: number; longitude: number },
): Promise<void> {
  const id = cragIdOf(mountain, zone);
  if (!id) {
    throw new Error('등반지 이름이 없어 저장할 수 없습니다.');
  }
  const who = editor.nickname || editor.uid;

  await setDoc(
    doc(db, COL, id),
    {
      mountain: mountain.trim(),
      zone: zone.trim(),
      displayName: cragDisplayName(mountain, zone),
      // 🚨 undefined 가 하나라도 있으면 저장 전체가 거부된다 (머리말)
      ...stripUndefined(patch as Record<string, unknown>),
      ...(coords ? { latitude: coords.latitude, longitude: coords.longitude } : {}),
      // 이름을 남기는 것이 정보를 채우는 실제 동기다
      contributors: arrayUnion(who),
      updatedAt: serverTimestamp(),
      updatedBy: who,
    },
    { merge: true },
  );

  /*
   * 편집 이력 — 되돌릴 근거.
   * ⚠️ 실패해도 저장 자체는 이미 끝났다. 이력 때문에 저장이 실패한 것처럼 보이면 안 된다.
   */
  try {
    await addDoc(collection(db, COL, id, 'edits'), {
      uid: editor.uid,
      nickname: who,
      patch: stripUndefined(patch as Record<string, unknown>),
      createdAt: serverTimestamp(),
    });
  } catch {
    /* 이력 실패는 무시 */
  }
}

export interface CragEdit {
  id: string;
  uid: string;
  nickname: string;
  patch: Record<string, unknown>;
  createdAt?: { toDate: () => Date };
}

/** 편집 이력 (관리자 확인용) — 최근 20건 */
export async function fetchCragEdits(cragId: string): Promise<CragEdit[]> {
  const snap = await getDocs(
    query(collection(db, COL, cragId, 'edits'), orderBy('createdAt', 'desc'), limit(20)),
  );
  return snap.docs.map((d) => {
    const v = d.data() as Record<string, unknown>;
    return {
      id: d.id,
      uid: typeof v.uid === 'string' ? v.uid : '',
      nickname: typeof v.nickname === 'string' ? v.nickname : '',
      patch: (v.patch as Record<string, unknown>) ?? {},
      createdAt: v.createdAt as CragEdit['createdAt'],
    };
  });
}


/**
 * **닫힌 구역 id 집합** 구독 — 목록·지도 배지용.
 *
 * ⚠️ `crags` 전체를 읽지 않는다. `where('closure.closed','==',true)` 로 좁힌다.
 *    닫힌 구역은 많아야 몇 개고, 구역 문서는 967개까지 늘 수 있다.
 *    ⚠️ 중첩 필드 쿼리라 **단일 필드 색인이 필요하다.** Firestore 는 중첩 필드에도
 *       기본 색인을 자동으로 만들어 주므로 복합 색인 파일에는 넣지 않았다.
 *       (혹시 failed-precondition 이 나면 콘솔 링크로 만들면 된다)
 *
 * ⚠️ 규칙이 `allow read: if true` 라 이 쿼리는 조건을 더 붙이지 않아도 통과한다.
 *    (sends 사고와 다른 점 — 66차 참고)
 */
export function subscribeClosedCragIds(
  onData: (ids: Set<string>) => void,
  onError?: (message: string) => void,
): () => void {
  return onSnapshot(
    query(collection(db, COL), where('closure.closed', '==', true)),
    (snap) => onData(new Set(snap.docs.map((d) => d.id))),
    (e) => onError?.(e.message),
  );
}
