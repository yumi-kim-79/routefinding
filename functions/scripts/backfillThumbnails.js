#!/usr/bin/env node
/**
 * 썸네일 백필 — 기존 사진에 `_400x400` 을 만들어 준다.
 *
 * `functions/index.js` 의 `generateThumbnail` 은 **새로 올라오는 파일만** 처리한다.
 * 이미 있는 5,400여 건은 한 번 훑어야 하는데, 그 방법이 이 스크립트다.
 *
 * ── 어떻게 동작하나 ──────────────────────────────────────────────────────
 *  각 객체의 스토리지 클래스를 **자기 자신으로 다시 써서**(rewrite) 새 세대를 만든다.
 *  GCS 는 "객체의 새 세대가 만들어질 때"(복사·rewrite 포함) OBJECT_FINALIZE 를 보내므로
 *  `generateThumbnail` 이 그대로 동작한다.
 *
 *  ⚠️ **파일을 내려받지 않는다.** rewrite 는 서버 쪽에서 끝나므로
 *     로컬로 수 GB 를 당겨오지 않는다. 느린 회선에서도 안전하다.
 *
 * ── 왜 gsutil 을 안 쓰나 ────────────────────────────────────────────────
 *  `gsutil -m rewrite` 가 정석이지만 gsutil 은 Python 3.8~3.12 만 지원한다.
 *  이 개발 머신은 Python 3.14 라 실행이 거부된다 (2026-08-28 실측).
 *  `gcloud storage objects update --storage-class` 로도 되지만,
 *  진행 상황·건너뛴 건수를 보려면 이 스크립트가 낫다.
 *
 * ── 사용법 ─────────────────────────────────────────────────────────────
 *   cd ~/StudioProjects/routefinding/functions
 *   node scripts/backfillThumbnails.js route_images/무의도/     # 먼저 한 폴더만
 *   node scripts/backfillThumbnails.js route_images/
 *   node scripts/backfillThumbnails.js pitch_images/
 *
 *   --dry  실제로 건드리지 않고 대상만 센다
 *
 * ⚠️ 여러 번 돌려도 안전하다. 이미 썸네일이 있으면 건너뛴다.
 */
const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");

const BUCKET = "routefinding09-4b597.firebasestorage.app";
const THUMB_SUFFIX = "_400x400";
/** 동시에 진행할 rewrite 수. 너무 높이면 함수가 몰려 실패가 늘어난다 */
const CONCURRENCY = 8;

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: BUCKET,
});

const prefix = process.argv[2];
const dryRun = process.argv.includes("--dry");

if (!prefix) {
  console.error("사용법: node scripts/backfillThumbnails.js <경로접두사> [--dry]");
  console.error("예:    node scripts/backfillThumbnails.js route_images/무의도/");
  process.exit(1);
}

/** 썸네일을 만들 대상인가 */
function isTarget(name) {
  const dot = name.lastIndexOf(".");
  const slash = name.lastIndexOf("/");
  if (dot <= slash) return false;                    // 확장자 없음
  if (name.slice(0, dot).endsWith(THUMB_SUFFIX)) return false; // 이미 썸네일
  return /\.(jpe?g|png|webp)$/i.test(name);
}

function thumbName(name) {
  const dot = name.lastIndexOf(".");
  return `${name.slice(0, dot)}${THUMB_SUFFIX}${name.slice(dot)}`;
}

(async () => {
  const bucket = admin.storage().bucket();
  console.log(`대상 접두사: ${prefix}${dryRun ? "  (dry run)" : ""}`);

  const [files] = await bucket.getFiles({prefix});
  const targets = files.filter((f) => isTarget(f.name));
  const existing = new Set(files.map((f) => f.name));

  const todo = targets.filter((f) => !existing.has(thumbName(f.name)));
  console.log(
      `전체 ${files.length}개 / 이미지 ${targets.length}개 / ` +
      `썸네일 없는 것 ${todo.length}개`,
  );

  if (dryRun || todo.length === 0) {
    console.log(dryRun ? "dry run 이라 여기서 멈춘다." : "할 일이 없다.");
    return;
  }

  let done = 0;
  let failed = 0;

  // 동시 실행 수를 제한해 순차적으로 소화한다
  const queue = [...todo];
  const workers = Array.from({length: CONCURRENCY}, async () => {
    for (;;) {
      const file = queue.pop();
      if (!file) return;
      try {
        // 자기 자신으로 다시 쓴다 → 새 세대 → OBJECT_FINALIZE → generateThumbnail 실행
        await file.setStorageClass("standard");
        done += 1;
      } catch (e) {
        failed += 1;
        console.error(`  실패 ${file.name}: ${e.message}`);
      }
      if ((done + failed) % 50 === 0) {
        console.log(`  진행 ${done + failed} / ${todo.length}`);
      }
    }
  });
  await Promise.all(workers);

  console.log(`\n완료: 요청 ${done}개, 실패 ${failed}개`);
  console.log("⚠️ 썸네일 생성은 함수가 뒤이어 처리한다. 몇 분 뒤 Storage 에서 확인할 것.");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
