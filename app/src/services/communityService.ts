/**
 * 커뮤니티 글 — 목록 조회 · 작성 · 좋아요.
 *
 * ⚠️ 목록은 **실시간 구독이 아니라 페이지 단위 조회**다.
 *    피드에 리스너를 걸면 글이 하나 바뀔 때마다 접속자 전원에게 읽기가 발생한다.
 *    글은 채팅처럼 초 단위로 바뀌지 않으므로 당겨서 새로고침으로 충분하다.
 *    (36~39차에 이미지 로딩으로 겪은 것과 같은 종류의 비용 문제다)
 *
 * ⚠️ 신고 누적 글 숨김은 **클라이언트에서** 거른다.
 *    Firestore 는 부등호 조건과 다른 필드 정렬을 같이 못 쓴다
 *    (`reportCount >= 3` + `orderBy('timestamp')` 는 색인이 성립하지 않는다).
 */
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
  where,
} from '@react-native-firebase/firestore';
import { getDownloadURL, putFile, ref } from '@react-native-firebase/storage';
import { db, storage } from './firebase';
import {
  isHidden,
  type CommunityPost,
  type PostComment,
  type PostDraft,
} from '../types/communityPost';
import type { BoardType } from '../types/board';

const COL = 'community_posts';

/** 한 번에 받아 오는 글 수 */
export const PAGE_SIZE = 10;

/** 글 1개에 붙일 수 있는 사진 수 */
export const MAX_POST_IMAGES = 5;

/*
 * ⚠️ `FirebaseFirestoreTypes.QueryDocumentSnapshot`(네임스페이스 API 타입)을 쓰면 안 된다.
 *    RNFB 25 의 **모듈러 `getDocs` 가 돌려주는 스냅샷은 다른 타입**이라 서로 대입되지 않는다
 *    (`isEqual` 유무 차이). 함수 반환형에서 직접 유도하면 어긋날 일이 없다.
 */
type DocSnap = Awaited<ReturnType<typeof getDocs>>['docs'][number];
type Cursor = DocSnap | null;

export interface PostPage {
  posts: CommunityPost[];
  cursor: Cursor;
  /** false 면 더 받을 게 없다 */
  hasMore: boolean;
}

function toPostFrom(id: string, v: Record<string, unknown>): CommunityPost {
  return {
    id,
    boardId: typeof v.boardId === 'string' ? v.boardId : '',
    boardType: (v.boardType as BoardType) ?? 'free',
    authorUid: typeof v.authorUid === 'string' ? v.authorUid : '',
    nickname: typeof v.nickname === 'string' ? v.nickname : '이름 없음',
    photoUrl: typeof v.photoUrl === 'string' ? v.photoUrl : undefined,
    body: typeof v.body === 'string' ? v.body : '',
    imageUrls: Array.isArray(v.imageUrls) ? (v.imageUrls as string[]).filter(Boolean) : [],
    mountain: typeof v.mountain === 'string' ? v.mountain : undefined,
    zone: typeof v.zone === 'string' ? v.zone : undefined,
    conceptId: typeof v.conceptId === 'string' ? v.conceptId : undefined,
    conceptSource: typeof v.conceptSource === 'string' ? v.conceptSource : undefined,
    price: typeof v.price === 'number' ? v.price : undefined,
    tradeType: v.tradeType as CommunityPost['tradeType'],
    tradeStatus: v.tradeStatus as CommunityPost['tradeStatus'],
    region: typeof v.region === 'string' ? v.region : undefined,
    logId: typeof v.logId === 'string' ? v.logId : undefined,
    climbedAt: v.climbedAt as CommunityPost['climbedAt'],
    place: typeof v.place === 'string' ? v.place : undefined,
    routeName: typeof v.routeName === 'string' ? v.routeName : undefined,
    likeCount: typeof v.likeCount === 'number' ? v.likeCount : 0,
    likedBy: Array.isArray(v.likedBy) ? (v.likedBy as string[]) : [],
    commentCount: typeof v.commentCount === 'number' ? v.commentCount : 0,
    timestamp: v.timestamp as CommunityPost['timestamp'],
    updatedAt: v.updatedAt as CommunityPost['updatedAt'],
    isDeleted: v.isDeleted === true,
    reportCount: typeof v.reportCount === 'number' ? v.reportCount : 0,
  };
}

const toPost = (d: DocSnap): CommunityPost =>
  toPostFrom(d.id, d.data() as Record<string, unknown>);

/**
 * 게시판 글 한 페이지.
 *
 * @param mountain `place` 게시판에서 등반지로 좁힐 때. 없으면 전체
 * @param after    이어받기 커서 (첫 페이지는 null)
 *
 * ⚠️ 복합 색인이 필요하다 (`boardId` + `isDeleted` + `timestamp desc`,
 *    등반지 필터는 `boardId` + `mountain` + `timestamp desc`).
 *    색인 없이 배포하면 **목록이 통째로 빈 화면**이 된다.
 */
export async function fetchPosts(
  boardId: string,
  after: Cursor = null,
  mountain?: string,
): Promise<PostPage> {
  const base = [
    where('boardId', '==', boardId),
    ...(mountain ? [where('mountain', '==', mountain)] : [where('isDeleted', '==', false)]),
    orderBy('timestamp', 'desc'),
    limit(PAGE_SIZE),
  ];
  const q = after
    ? query(collection(db, COL), ...base, startAfter(after))
    : query(collection(db, COL), ...base);

  const snap = await getDocs(q);
  const docs = snap.docs;
  return {
    // 삭제·신고 누적 글은 여기서 거른다 (위 머리말 참조)
    posts: docs.map(toPost).filter((p) => !isHidden(p)),
    cursor: docs.length > 0 ? docs[docs.length - 1] : null,
    hasMore: docs.length === PAGE_SIZE,
  };
}

/** 글 1개 실시간 구독 — 상세 화면에서 좋아요·댓글 수가 바로 반영되게 */
export function subscribePost(
  postId: string,
  onData: (post: CommunityPost | null) => void,
  onError: (message: string) => void,
): () => void {
  return onSnapshot(
    doc(db, COL, postId),
    (d) => {
      const v = d.data() as Record<string, unknown> | undefined;
      onData(v ? toPostFrom(d.id, v) : null);
    },
    (e) => onError(e.message),
  );
}

/** 로컬 파일 1개 업로드 → 다운로드 URL (reportService 와 같은 방식) */
async function upload(path: string, localUri: string): Promise<string> {
  const r = ref(storage, path);
  await putFile(r, localUri);
  return getDownloadURL(r);
}

/**
 * 글 작성.
 *
 * ⚠️ 문서를 **먼저 만들고** 그 ID 로 사진을 올린다.
 *    Storage 경로에 postId 가 들어가야 나중에 글을 지울 때 사진도 같이 지울 수 있다.
 * ⚠️ 사진은 `post_images/` 아래에 둔다 —
 *    `functions/index.js` 의 `generateThumbnail` prefix 에 이 경로를 **반드시 추가**해야
 *    목록에서 40KB 축소본을 쓸 수 있다. 안 하면 원본(1~3MB)을 그대로 받는다.
 */
export async function createPost(
  draft: PostDraft,
  author: { uid: string; nickname: string; photoUrl?: string },
): Promise<string> {
  const docRef = await addDoc(collection(db, COL), {
    boardId: draft.boardId,
    boardType: draft.boardType,
    authorUid: author.uid,
    nickname: author.nickname,
    ...(author.photoUrl ? { photoUrl: author.photoUrl } : {}),
    body: draft.body,
    imageUrls: [],
    ...(draft.mountain ? { mountain: draft.mountain } : {}),
    ...(draft.zone ? { zone: draft.zone } : {}),
    ...(draft.conceptId ? { conceptId: draft.conceptId } : {}),
    ...(draft.conceptSource ? { conceptSource: draft.conceptSource } : {}),
    ...(draft.boardType === 'party'
      ? {
          ...(draft.climbAt ? { climbAt: draft.climbAt } : {}),
          ...(draft.capacity ? { capacity: draft.capacity } : {}),
          partyStatus: 'open',
        }
      : {}),
    ...(draft.boardType === 'market'
      ? {
          price: draft.price ?? 0,
          tradeType: draft.tradeType ?? 'sell',
          tradeStatus: 'selling',
          ...(draft.region ? { region: draft.region } : {}),
        }
      : {}),
    likeCount: 0,
    likedBy: [],
    commentCount: 0,
    timestamp: serverTimestamp(),
    isDeleted: false,
    reportCount: 0,
  });

  const local = draft.images.slice(0, MAX_POST_IMAGES);
  if (local.length > 0) {
    const urls: string[] = [];
    for (let i = 0; i < local.length; i += 1) {
      const uri = local[i];
      // 이미 올라간 사진(수정 시)은 그대로 재사용한다
      urls.push(uri.startsWith('http') ? uri : await upload(`post_images/${docRef.id}/${i}.jpg`, uri));
    }
    await updateDoc(docRef, { imageUrls: urls });
  }

  return docRef.id;
}

/** 본문·사진 수정 (작성자 또는 관리자) */
export async function updatePost(
  postId: string,
  patch: { body?: string; imageUrls?: string[]; tradeStatus?: CommunityPost['tradeStatus'] },
): Promise<void> {
  await updateDoc(doc(db, COL, postId), { ...patch, updatedAt: serverTimestamp() });
}

/**
 * 삭제 — 문서를 실제로 지운다.
 * ⚠️ Storage 사진은 남는다. 사용량이 문제가 되면 Cloud Function 으로 정리할 것.
 */
export async function deletePost(postId: string): Promise<void> {
  await deleteDoc(doc(db, COL, postId));
}

/**
 * 좋아요 토글.
 * ⚠️ `arrayUnion`/`arrayRemove` + `increment` 를 쓴다. 읽고-쓰기로 하면
 *    두 사람이 동시에 누를 때 카운트가 어긋난다.
 */
export async function toggleLike(postId: string, uid: string, liked: boolean): Promise<void> {
  await updateDoc(doc(db, COL, postId), {
    likedBy: liked ? arrayRemove(uid) : arrayUnion(uid),
    likeCount: increment(liked ? -1 : 1),
  });
}

// ── 댓글 ──────────────────────────────────────────────

function toCommentFrom(id: string, v: Record<string, unknown>): PostComment {
  return {
    id,
    authorUid: typeof v.authorUid === 'string' ? v.authorUid : '',
    nickname: typeof v.nickname === 'string' ? v.nickname : '이름 없음',
    photoUrl: typeof v.photoUrl === 'string' ? v.photoUrl : undefined,
    body: typeof v.body === 'string' ? v.body : '',
    timestamp: v.timestamp as PostComment['timestamp'],
    isDeleted: v.isDeleted === true,
    reportCount: typeof v.reportCount === 'number' ? v.reportCount : 0,
  };
}

const toComment = (d: DocSnap): PostComment =>
  toCommentFrom(d.id, d.data() as Record<string, unknown>);

/** 댓글은 **오래된 순** — 대화 흐름대로 읽는다 (인스타와 같다) */
export function subscribeComments(
  postId: string,
  onData: (list: PostComment[]) => void,
  onError: (message: string) => void,
): () => void {
  const q = query(collection(db, COL, postId, 'comments'), orderBy('timestamp', 'asc'));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map(toComment).filter((c) => !isHidden(c))),
    (e) => onError(e.message),
  );
}

/**
 * 댓글 달기.
 * ⚠️ `commentCount` 는 여기서 올리지 않는다. **Cloud Function 이 올린다** —
 *    클라이언트에서 올리면 보안 규칙으로 막을 수 없고, 실패하면 숫자가 어긋난다.
 */
export async function addComment(
  postId: string,
  body: string,
  author: { uid: string; nickname: string; photoUrl?: string },
): Promise<void> {
  await addDoc(collection(db, COL, postId, 'comments'), {
    authorUid: author.uid,
    nickname: author.nickname,
    ...(author.photoUrl ? { photoUrl: author.photoUrl } : {}),
    body,
    timestamp: serverTimestamp(),
    isDeleted: false,
    reportCount: 0,
  });
}

export async function deleteComment(postId: string, commentId: string): Promise<void> {
  await deleteDoc(doc(db, COL, postId, 'comments', commentId));
}
