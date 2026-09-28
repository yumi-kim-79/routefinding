/**
 * 게시판 목록 — Firestore `boards` 컬렉션.
 *
 * 앱이 시작할 때(정확히는 커뮤니티 화면을 열 때) 읽어서 탭을 그린다.
 * **관리자가 게시판을 추가하면 앱 배포 없이 즉시 나타난다.** (types/board.ts 머리말)
 *
 * ⚠️ 실시간 구독을 쓰는 이유: 관리자가 순서를 바꾸거나 새 게시판을 만들면
 *    쓰고 있는 사용자 화면에도 바로 반영돼야 한다. 문서가 몇 개뿐이라 비용도 무시할 만하다.
 */
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from '@react-native-firebase/firestore';
import { db } from './firebase';
import {
  LOG_BOARD_ID,
  isValidBoardId,
  type Board,
  type BoardInput,
  type BoardType,
} from '../types/board';

const COL = 'boards';

function toBoard(id: string, d: Record<string, unknown>): Board {
  return {
    id,
    name: typeof d.name === 'string' ? d.name : id,
    description: typeof d.description === 'string' ? d.description : undefined,
    type: (d.type as BoardType) ?? 'free',
    icon: typeof d.icon === 'string' ? d.icon : undefined,
    order: typeof d.order === 'number' ? d.order : 999,
    // ⚠️ 값이 없으면 **보이는 쪽**이 기본이다. 시드 문서에 필드를 빠뜨려도 게시판이 사라지지 않는다
    visible: d.visible !== false,
    // 반대로 쓰기는 **명시해야** 열린다. log 게시판이 실수로 열리면 안 된다
    writable: d.writable === true && id !== LOG_BOARD_ID,
    postCount: typeof d.postCount === 'number' ? d.postCount : undefined,
  };
}

/** 보이는 게시판만, order 순 */
export function subscribeBoards(
  onData: (list: Board[]) => void,
  onError: (message: string) => void,
): () => void {
  /*
   * ⚠️ `where('visible','==',true)` 를 쓰지 않는다.
   *    시드 문서에 `visible` 을 안 넣으면 쿼리에서 통째로 빠져 게시판이 하나도 안 보인다.
   *    문서가 몇 개뿐이니 전부 받아 클라이언트에서 거른다.
   */
  return onSnapshot(
    collection(db, COL),
    (snap) => {
      const list = snap.docs
        .map((d) => toBoard(d.id, d.data() as Record<string, unknown>))
        .filter((b) => b.visible)
        .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
      onData(list);
    },
    (e) => onError(e.message),
  );
}

/** 관리자 화면용 — 숨긴 것까지 전부 */
export async function fetchAllBoards(): Promise<Board[]> {
  const snap = await getDocs(collection(db, COL));
  return snap.docs
    .map((d) => toBoard(d.id, d.data() as Record<string, unknown>))
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

/**
 * 게시판 추가 (관리자).
 * ⚠️ 문서 ID 를 직접 정한다(`setDoc`). 자동 ID 를 쓰면 글이 들고 있는 `boardId` 가
 *    읽기 어려운 난수가 되고, 나중에 사람이 콘솔에서 손볼 수 없다.
 */
export async function createBoard(input: BoardInput): Promise<void> {
  if (!isValidBoardId(input.id)) {
    throw new Error('게시판 ID 는 영문 소문자로 시작하는 2~24자여야 합니다 (예: gear-review)');
  }
  if (input.id === LOG_BOARD_ID) {
    throw new Error(`'${LOG_BOARD_ID}' 는 등반일지 전용 시스템 게시판이라 만들 수 없습니다.`);
  }
  await setDoc(doc(db, COL, input.id), {
    name: input.name,
    description: input.description ?? '',
    type: input.type,
    icon: input.icon ?? '',
    order: input.order,
    visible: true,
    writable: true,
    postCount: 0,
    createdAt: serverTimestamp(),
  });
}

/**
 * 게시판 수정 (관리자).
 * ⚠️ `type` 과 `id` 는 바꾸지 못한다 — 이미 쓴 글의 필수 필드가 달라져 기존 글이 깨진다.
 */
export async function updateBoard(
  id: string,
  patch: Partial<Pick<Board, 'name' | 'description' | 'icon' | 'order' | 'visible' | 'writable'>>,
): Promise<void> {
  const safe = { ...patch };
  if (id === LOG_BOARD_ID) {
    // 등반일지 게시판은 어떤 경로로도 글쓰기가 열리면 안 된다
    safe.writable = false;
  }
  await updateDoc(doc(db, COL, id), safe);
}

/**
 * 게시판 삭제 (관리자).
 * ⚠️ 글이 남아 있으면 갈 곳 없는 글이 된다. 보통은 **숨김(visible=false)** 을 쓴다.
 *    호출부에서 글 수를 먼저 확인하고, 0 일 때만 부르도록 되어 있다.
 */
export async function deleteBoard(id: string): Promise<void> {
  if (id === LOG_BOARD_ID) {
    throw new Error('등반일지 게시판은 삭제할 수 없습니다.');
  }
  await deleteDoc(doc(db, COL, id));
}
