/**
 * 등반일지 서비스 — `users/{uid}/climbing_logs`
 *
 * CLAUDE.md: Firestore 호출은 service 모듈로 격리한다.
 * 목록은 실시간 구독(onSnapshot) — 작성/수정 직후 별도 재조회가 필요 없다.
 *
 * ⚠️ firestore.rules에 `users/{userId}/climbing_logs` 규칙이 **배포**돼 있어야 동작한다.
 *    (규칙 파일은 수정해 뒀고 배포는 사용자가 직접 — CLAUDE.md: 규칙 변경은 승인·별도 배포)
 *
 * 🚨 `doc(doc(db, USERS, uid), SUB, logId)` 처럼 **DocumentReference 를 부모로 doc() 을 부르면 안 된다.**
 *    RNFB 모듈러 `doc(parent, ...)` 은 내부에서 `parent.doc.call(parent, ...)` 을 하는데
 *    **DocumentReference 에는 `.doc()` 이 없다** → `Cannot read property 'call' of undefined`.
 *    (`collection(doc(...), ...)` 는 정상이다 — DocumentReference 에 `.collection()` 은 있다)
 *    → 부모로는 **Firestore 또는 CollectionReference** 만 쓴다.
 *    2026-09-08 실기기에서 등반일지 **수정·삭제가 항상 실패**하던 원인이었다.
 *
 * ⚠️ 공개(`isPublic`)는 여기서 커뮤니티 글을 만들지 **않는다.** 일지 문서만 고치고,
 *    커뮤니티 `log` 게시판 글은 Cloud Function `syncPublicLog` 이 맞춘다.
 *    클라이언트가 두 곳에 직접 쓰면 한쪽만 성공하는 날이 반드시 오고,
 *    그때 비공개로 바꾼 일지가 커뮤니티에 그대로 남는다 (되돌릴 방법이 없다).
 */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from '@react-native-firebase/firestore';
import { getDownloadURL, putFile, ref } from '@react-native-firebase/storage';
import { db, storage } from './firebase';
import { COLLECTIONS } from '../constants/firestoreFields';
import { MAX_LOG_PHOTOS, type ClimbingLog, type ClimbingLogInput } from '../types/climbingLog';

const SUB = 'climbing_logs';

function logsCollection(uid: string) {
  return collection(doc(db, COLLECTIONS.USERS, uid), SUB);
}

/**
 * 등반일지 실시간 구독 (최신 등반일 순).
 * @returns 구독 해제 함수
 */
export function subscribeClimbingLogs(
  uid: string,
  onData: (logs: ClimbingLog[]) => void,
  onError: (message: string) => void,
): () => void {
  const q = query(logsCollection(uid), orderBy('climbedAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ClimbingLog, 'id'>),
        })),
      );
    },
    (e) => onError(e.message),
  );
}

/**
 * 사진 업로드 — 이미 올라간 https URL 은 그대로 재사용한다 (수정 시 재업로드 방지).
 * ⚠️ 경로는 `log_images/`. `functions/index.js` 의 `generateThumbnail` prefix 에
 *    이 경로가 들어 있어야 목록에서 축소본을 쓴다.
 */
async function uploadPhotos(
  uid: string,
  logId: string,
  photos: string[],
): Promise<string[]> {
  const out: string[] = [];
  const list = photos.slice(0, MAX_LOG_PHOTOS);
  for (let i = 0; i < list.length; i += 1) {
    const uri = list[i];
    if (uri.startsWith('http')) {
      out.push(uri);
      continue;
    }
    const r = ref(storage, `log_images/${uid}/${logId}/${i}.jpg`);
    await putFile(r, uri);
    out.push(await getDownloadURL(r));
  }
  return out;
}

/** 폼 입력 → Firestore 문서 필드 */
function toDocData(input: ClimbingLogInput) {
  return {
    climbedAt: input.climbedAt,
    endedAt: input.endedAt ?? null,
    place: input.place.trim(),
    routeName: input.routeName?.trim() ?? '',
    gear: input.gear?.trim() ?? '',
    duration: input.duration?.trim() ?? '',
    partners: input.partners?.trim() ?? '',
    notes: input.notes?.trim() ?? '',
    // ⚠️ 값이 없으면 **비공개**가 기본이다. undefined 로 두면 안 된다 —
    //    필드가 없는 문서를 서버 함수가 "공개였다가 지워진 것"과 구분하지 못한다
    isPublic: input.isPublic === true,
    updatedAt: serverTimestamp(),
  };
}

/**
 * 새 일지.
 *
 * ⚠️ 문서를 **먼저 만들고** 그 ID 로 사진을 올린다 (커뮤니티 글과 같은 이유).
 *    Storage 경로에 logId 가 들어가야 나중에 일지를 지울 때 사진도 찾아 지울 수 있다.
 */
export async function createClimbingLog(
  uid: string,
  input: ClimbingLogInput,
): Promise<void> {
  const docRef = await addDoc(logsCollection(uid), {
    ...toDocData(input),
    photoUrls: [],
    // 개념도에서 작성한 경우에만 원본 루트를 연결
    ...(input.conceptId
      ? {
          conceptId: input.conceptId,
          conceptSource: input.conceptSource ?? '',
        }
      : {}),
    createdAt: serverTimestamp(),
  });

  if (input.photos && input.photos.length > 0) {
    const urls = await uploadPhotos(uid, docRef.id, input.photos);
    await updateDoc(docRef, { photoUrls: urls });
  }
}

export async function updateClimbingLog(
  uid: string,
  logId: string,
  input: ClimbingLogInput,
): Promise<void> {
  /*
   * 사진을 **먼저** 올리고 한 번에 저장한다.
   * ⚠️ 두 번 나눠 쓰면 공개 상태와 사진이 어긋난 중간 상태가 커뮤니티에 그대로 나간다
   *    (syncPublicLog 이 매 쓰기마다 돈다).
   */
  const photoUrls = input.photos ? await uploadPhotos(uid, logId, input.photos) : undefined;

  // ⚠️ 부모는 CollectionReference 여야 한다 (머리말의 doc() 함정)
  await updateDoc(doc(logsCollection(uid), logId), {
    ...toDocData(input),
    ...(photoUrls ? { photoUrls } : {}),
  });
}

export async function deleteClimbingLog(
  uid: string,
  logId: string,
): Promise<void> {
  // ⚠️ 부모는 CollectionReference 여야 한다 (머리말의 doc() 함정)
  await deleteDoc(doc(logsCollection(uid), logId));
}
