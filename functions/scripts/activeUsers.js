#!/usr/bin/env node
/**
 * 사용자 현황 — 가입자 수와 **실제 사용량**을 본다.
 *
 *   cd ~/StudioProjects/routefinding/functions
 *   node scripts/activeUsers.js
 *
 * ── 무엇을 세는가 ────────────────────────────────────────────────────────
 *  · 가입자    Firebase Auth 계정 수
 *  · 활성      `lastRefreshTime` 기준. 앱이 ID 토큰을 갱신한 시각이라
 *              **앱을 실제로 켰을 때** 갱신된다 → "쓰고 있는 사람"에 가장 가깝다
 *              (`lastSignInTime` 은 로그인할 때만 바뀌어서, 로그인 상태를 유지하는
 *               사용자는 몇 달 전 값으로 남는다 — 활성 지표로 쓰면 안 된다)
 *  · 콘텐츠    등반일지·제보·개념도 사진·문의 건수 (참여도)
 *
 * ⚠️ 정확한 DAU/MAU·화면별 사용은 Firebase Analytics, Play Console,
 *    App Store Connect 를 봐야 한다. 이 스크립트는 **로그인 기반 근사치**다.
 *    (비로그인 방문자는 잡히지 않는다)
 */
const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");

if (!admin.apps.length) {
  admin.initializeApp({credential: admin.credential.cert(serviceAccount)});
}

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();

/** 며칠 전인지 */
const daysAgo = (iso) => (iso ? (now - new Date(iso).getTime()) / DAY : Infinity);

async function countAuthUsers() {
  const buckets = {d1: 0, d7: 0, d30: 0, d90: 0, never: 0};
  const signupBuckets = {d7: 0, d30: 0, d90: 0};
  let total = 0;
  let pageToken;

  do {
    const res = await admin.auth().listUsers(1000, pageToken);
    for (const u of res.users) {
      total += 1;
      // 앱을 켜면 토큰이 갱신된다 → 실제 사용에 가장 가까운 신호
      const used = daysAgo(u.metadata.lastRefreshTime || u.metadata.lastSignInTime);
      if (used <= 1) buckets.d1 += 1;
      if (used <= 7) buckets.d7 += 1;
      if (used <= 30) buckets.d30 += 1;
      if (used <= 90) buckets.d90 += 1;
      if (!Number.isFinite(used)) buckets.never += 1;

      const joined = daysAgo(u.metadata.creationTime);
      if (joined <= 7) signupBuckets.d7 += 1;
      if (joined <= 30) signupBuckets.d30 += 1;
      if (joined <= 90) signupBuckets.d90 += 1;
    }
    pageToken = res.pageToken;
  } while (pageToken);

  return {total, buckets, signupBuckets};
}

/** 컬렉션 문서 수 (서버에서 집계 — 문서를 내려받지 않는다) */
async function countDocs(path) {
  try {
    const snap = await admin.firestore().collection(path).count().get();
    return snap.data().count;
  } catch (e) {
    return `조회 실패 (${e.code || e.message})`;
  }
}

/** 승인된 것만 */
async function countApproved(path) {
  try {
    const snap = await admin.firestore()
        .collection(path).where("status", "==", "approved").count().get();
    return snap.data().count;
  } catch (e) {
    return `조회 실패 (${e.code || e.message})`;
  }
}

(async () => {
  const {total, buckets, signupBuckets} = await countAuthUsers();

  console.log("\n═══ 사용자 ═══");
  console.log(`가입자 총계            ${total}명`);
  console.log(`  최근 1일 사용        ${buckets.d1}명`);
  console.log(`  최근 7일 사용        ${buckets.d7}명`);
  console.log(`  최근 30일 사용       ${buckets.d30}명   ← 월간 활성에 가장 가까움`);
  console.log(`  최근 90일 사용       ${buckets.d90}명`);
  console.log(`  한 번도 안 씀        ${buckets.never}명`);

  console.log("\n═══ 신규 가입 ═══");
  console.log(`  최근 7일             ${signupBuckets.d7}명`);
  console.log(`  최근 30일            ${signupBuckets.d30}명`);
  console.log(`  최근 90일            ${signupBuckets.d90}명`);

  console.log("\n═══ 콘텐츠 (참여도) ═══");
  console.log(`route_reports 전체     ${await countDocs("route_reports")}`);
  console.log(`  그중 승인            ${await countApproved("route_reports")}`);
  console.log(`bouldering_reports     ${await countDocs("bouldering_reports")}`);
  console.log(`concept_photos         ${await countDocs("concept_photos")}`);
  console.log(`user_messages (문의)   ${await countDocs("user_messages")}`);
  console.log(`users 문서             ${await countDocs("users")}`);

  console.log("\n⚠️ 로그인 기반 근사치다. 비로그인 방문자와 화면별 사용은 잡히지 않는다.");
  console.log("   정확한 지표는 Firebase Analytics · Play Console · App Store Connect 참조.\n");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
