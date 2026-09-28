/**
 * boards 컬렉션 시드 — 2026-09-07 (v2.1.0 커뮤니티)
 *
 * 게시판은 **코드 상수가 아니라 Firestore 문서**다 (app/src/types/board.ts 머리말).
 * 관리자가 나중에 게시판을 추가해도 앱을 다시 배포할 필요가 없다.
 * 이 스크립트는 **처음 4개만** 만든다. 그 뒤로는 앱의 관리자 화면에서 추가한다.
 *
 * 실행:
 *   cd ~/StudioProjects/routefinding/functions
 *   node ../tools/seed_boards.js
 *
 * ⚠️ 여러 번 돌려도 안전하다 (merge 로 덮어쓴다).
 *    단, 콘솔에서 order/이름을 손봐 뒀다면 되돌아간다.
 *
 * ⚠️ `log`(등반일지) 게시판은 writable:false 다. 사람이 직접 글을 쓰는 곳이 아니라
 *    등반일지를 공개로 바꾸면 자동으로 올라오는 곳이다. 여기를 true 로 바꾸지 말 것.
 */
const admin = require('firebase-admin');

/*
 * ⚠️ 이건 내 노트북에서 도는 스크립트라 자격증명이 필요하다 (Cloud Functions 와 다르다).
 *    functions/serviceAccountKey.json 이 아직 있으면 그걸 쓰고, 없으면 gcloud 기본 자격증명을 쓴다.
 *    키 파일을 지운 뒤라면 먼저 한 번:
 *      gcloud auth application-default login
 */
const PROJECT_ID = 'routefinding09-4b597';
let key = null;
try {
  key = require('../functions/serviceAccountKey.json');
} catch {
  // 없으면 기본 자격증명으로 간다
}
admin.initializeApp(
  key
    ? { projectId: PROJECT_ID, credential: admin.credential.cert(key) }
    : { projectId: PROJECT_ID },
);
const db = admin.firestore();

const BOARDS = [
  {
    id: 'free',
    name: '자유',
    description: '등반 이야기, 질문, 무엇이든',
    type: 'free',
    icon: '💬',
    order: 1,
    writable: true,
  },
  {
    id: 'place',
    name: '등반지',
    description: '바위 상태, 접근로, 최근 다녀온 이야기',
    type: 'place',
    icon: '🧗',
    order: 2,
    writable: true,
  },
  {
    id: 'market',
    name: '중고거래',
    description: '장비 팔기 · 사기 · 나눔',
    type: 'market',
    icon: '🎒',
    order: 3,
    writable: true,
  },
  {
    id: 'party',
    name: '파티 모집',
    description: '같이 갈 사람을 구해 보세요',
    type: 'party',
    icon: '🤝',
    order: 4,
    writable: true,
  },
  {
    id: 'log',
    name: '등반일지',
    description: '공개로 설정한 등반일지가 모입니다',
    type: 'log',
    icon: '📔',
    order: 5,
    writable: false, // ⚠️ 위 머리말 참고 — 직접 글쓰기 금지
  },
];

(async () => {
  for (const b of BOARDS) {
    const { id, ...rest } = b;
    await db.collection('boards').doc(id).set(
      {
        ...rest,
        visible: true,
        postCount: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    console.log(`✓ boards/${id} — ${b.name}`);
  }
  console.log('\n게시판 5개 생성 완료.');
  process.exit(0);
})().catch((e) => {
  console.error('실패:', e.message);
  if (/PERMISSION_DENIED|insufficient permissions|could not load the default credentials/i.test(e.message)) {
    console.error(
      '\n⚠️ 자격증명 문제입니다. 이 스크립트는 보조 수단일 뿐입니다.\n' +
        '   ▶ 가장 쉬운 길: 앱에서 관리자로 로그인 → 마이페이지 ▸ 🔧 게시판 관리 → 게시판 추가\n' +
        '   ▶ 굳이 CLI 로 하려면:  gcloud auth application-default login\n' +
        '      (routefinding09-4b597 프로젝트에 권한이 있는 계정으로)',
    );
  }
  process.exit(1);
});
