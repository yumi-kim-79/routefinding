const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");

/*
 * ⚠️ 인자 없이 부른다. Cloud Functions 는 실행 환경에서 자격증명을 **자동으로** 받는다.
 *    예전에는 `serviceAccountKey.json` 을 읽어 `credential.cert()` 로 넘겼는데,
 *    그 파일은 (1) 여기서 전혀 필요가 없고 (2) 저장소에 커밋돼 있어서
 *    유출되면 프로젝트 전체 권한이 그대로 넘어간다.
 *    → 파일을 지우고 콘솔에서 해당 키를 **폐기**할 것.
 */
admin.initializeApp();

const _adminEmail = "yusung790926@gmail.com";

/**
 * 닉네임 중복 확인 (회원가입 화면용) — 2026-08-06
 *
 * ⚠️ 왜 함수가 필요한가:
 *   회원가입은 **로그인 전**에 일어난다. 그런데 firestore.rules 의
 *   `match /users/{userId} { allow read: if isSignedIn(); }` 때문에
 *   클라이언트가 users 컬렉션을 조회할 수 없어 **닉네임 확인이 항상 실패했다**
 *   (앱에 "닉네임 확인 중 오류가 발생했습니다"만 떴다 → 신규 가입 전면 차단).
 *
 *   규칙을 다시 열 수는 없다. users 문서에는 **이메일**이 들어 있어서
 *   누구나 읽게 하면 이메일이 노출된다.
 *   → 서버에서 확인하고 **불리언 하나만** 돌려준다.
 *
 * 응답: { "available": true | false }
 *
 * onCall 이 아니라 onRequest 인 이유: 앱에 `@react-native-firebase/functions`
 * 네이티브 모듈을 새로 넣지 않으려고. fetch 한 번이면 된다.
 */
exports.checkNickname = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  const raw = (req.query.nickname || (req.body && req.body.nickname) || "");
  const nickname = String(raw).trim();

  if (!nickname || nickname.length > 30) {
    res.status(400).json({error: "invalid_nickname"});
    return;
  }

  try {
    const snap = await admin.firestore()
        .collection("users")
        .where("nickname", "==", nickname)
        .limit(1)
        .get();
    res.status(200).json({available: snap.empty});
  } catch (e) {
    console.error("checkNickname 실패:", e);
    res.status(500).json({error: "internal"});
  }
});

// 0) 게시글 생성 시 viewCount/likeCount 초기화
exports.initPostCounters = functions.firestore
  .document("posts/{postId}")
  .onCreate(async (snap) => {
    await snap.ref.set({
      viewCount: 0,
      likeCount: 0,
    }, { merge: true });
  });

// 1) 공지 게시글 알림 - sendAll 방식 사용 (404 오류 회피)
exports.sendNotificationOnNewNoticePost = functions.firestore
  .document("posts/{postId}")
  .onCreate(async (snap, context) => {
    const post = snap.data();
    if (!post || post.category !== "공지" || !post.userId) return;

    let author;
    try {
      author = await admin.auth().getUser(post.userId);
    } catch (e) {
      console.warn("관리자 UID 조회 실패:", post.userId, e);
      return;
    }

    if (author.email !== _adminEmail) return;

    const usersSnap = await admin.firestore().collection("users").get();
    const tokens = usersSnap.docs
      .map(d => d.data().fcmToken)
      .filter(t => typeof t === "string" && t.length > 0);

    if (tokens.length === 0) {
      console.log("보낼 사용자 토큰이 없습니다.");
      return;
    }

    const messages = tokens.map(token => ({
      token,
      notification: {
        title: "[공지] " + (post.title || "새 공지"),
        body: (post.content || "").slice(0, 100),
      },
      data: {
        postId: snap.id,
        type: "notice_post",
      },
    }));

    try {
      const resp = await admin.messaging().sendAll(messages);
      console.log(`✅ 공지 푸시: 성공 ${resp.successCount}, 실패 ${resp.failureCount}`);
    } catch (err) {
      console.error("❌ 공지 푸시 발송 실패:", err);
    }
  });

// 2) notifications 문서 생성 시 1:1 FCM
exports.sendPushOnNotification = functions.firestore
  .document("notifications/{notificationId}")
  .onCreate(async (snap) => {
    const notif = snap.data();
    if (!notif || !notif.receiverId) return;

    const userDoc = await admin.firestore().collection("users").doc(notif.receiverId).get();
    if (!userDoc.exists) {
      console.warn(`알림 대상 사용자 없음: ${notif.receiverId}`);
      return;
    }

    const fcmToken = userDoc.data()?.fcmToken;
    if (!fcmToken) {
      console.warn(`FCM 토큰 없음: users/${notif.receiverId}.fcmToken`);
      return;
    }

    let title = "알림";
    switch (notif.type) {
      case "reply_to_post": title = "댓글 알림"; break;
      case "reply_to_comment": title = "답글 알림"; break;
      case "crew_post": title = "크루 새 글"; break;
      case "crew_chat": title = "크루 채팅"; break;
      case "crew_join_request": title = "크루 가입 요청"; break;
      case "crew_join_approved": title = "가입 승인 알림"; break;
      case "crew_join_rejected": title = "가입 거부 알림"; break;
      case "crew_member_left": title = "크루 탈퇴 알림"; break;
    }

    const message = {
      token: fcmToken,
      notification: { title, body: notif.message || "" },
      data: {
        postId: notif.postId || "",
        commentId: notif.commentId || "",
        crewId: notif.crewId || "",
        type: notif.type || "",
      },
    };

    try {
      await admin.messaging().send(message);
      console.log(`✅ 1:1 푸시 발송 성공: ${title}`);
    } catch (error) {
      console.error("❌ 1:1 푸시 발송 실패:", error);
    }
  });

// 3) 크루 채팅 알림 - send 방식
exports.notifyCrewChat = functions.firestore
  .document("crews/{crewId}/chats/{msgId}")
  .onCreate(async (snap, context) => {
    const { crewId } = context.params;
    const msg = snap.data();
    if (!msg) return;

    const membersSnap = await admin.firestore()
      .collection("crews").doc(crewId).collection("members").get();

    const sendTasks = [];

    for (const memberDoc of membersSnap.docs) {
      if (memberDoc.id === msg.uid) continue;

      const userDoc = await admin.firestore().collection("users").doc(memberDoc.id).get();
      const fcmToken = userDoc.data()?.fcmToken;

      if (fcmToken) {
        sendTasks.push(
          admin.messaging().send({
            token: fcmToken,
            notification: {
              title: "크루 채팅",
              body: `${msg.nickname || "크루원"}: ${(msg.content || "").slice(0, 40)}`
            },
            data: {
              type: "crew_chat",
              crewId,
            },
          })
        );
      }
    }

    try {
      await Promise.all(sendTasks);
      console.log(`✅ notifyCrewChat: sent ${sendTasks.length} notifications`);
    } catch (error) {
      console.error("❌ notifyCrewChat 푸시 실패:", error);
    }
  });

// 4) 크루 새 글 알림 - send 방식
exports.notifyCrewPost = functions.firestore
  .document("crews/{crewId}/board/{postId}")
  .onCreate(async (snap, context) => {
    const { crewId, postId } = context.params;
    const post = snap.data();
    if (!post || !post.userId) return;

    const membersSnap = await admin.firestore()
      .collection("crews").doc(crewId).collection("members").get();

    const sendTasks = [];

    for (const memberDoc of membersSnap.docs) {
      const memberUid = memberDoc.id;
      if (memberUid === post.userId) continue;

      const userDoc = await admin.firestore().collection("users").doc(memberUid).get();
      const fcmToken = userDoc.data()?.fcmToken;

      if (fcmToken) {
        sendTasks.push(
          admin.messaging().send({
            token: fcmToken,
            notification: {
              title: "크루 새 글",
              body: `${post.nickname || "크루원"}님: "${(post.title || "").slice(0, 30)}"`,
            },
            data: {
              type: "crew_post",
              crewId,
              postId,
            },
          })
        );
      }
    }

    try {
      await Promise.all(sendTasks);
      console.log(`✅ notifyCrewPost: sent ${sendTasks.length} notifications`);
    } catch (error) {
      console.error("❌ notifyCrewPost 푸시 실패:", error);
    }
  });

// 5) 크루 가입 요청 → 리더에게 알림 (DB 문서 생성)
exports.notifyCrewJoinRequest = functions.firestore
  .document("crews/{crewId}/joinRequests/{reqUid}")
  .onCreate(async (snap, context) => {
    const req = snap.data();
    if (!req) return;

    const crewId = context.params.crewId;

    const crewSnap = await admin.firestore().collection("crews").doc(crewId).get();
    const crewInfo = crewSnap.data();
    if (!crewInfo) return;

    const leaderUid = crewInfo.leaderUid;
    if (!leaderUid) return;

    await admin.firestore().collection("notifications").add({
      receiverId: leaderUid,
      type: "crew_join_request",
      crewId,
      message: `${req.nickname || "익명"} 님이 가입을 요청했습니다.`,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      checked: false,
    });
  });

// ═══════════════════════════════════════════════════════════════════════════
// 개념도 썸네일 생성 — 2026-08-25
//
// 사용자 피드백: "개념도가 많아 목록 썸네일이 너무 느리고 목록도 잘 안 내려간다."
//
// 원인: 목록 카드는 104×88 px 인데 **카메라 원본(2~5MB)** 을 그대로 받는다.
//       한 화면 채우는 데 20~50MB. 디코딩 비용까지 겹쳐 스크롤이 끊긴다.
//       (docs/14_IMAGE_PERF.md)
//
// ⚠️ 왜 Firebase Extensions 'Resize Images' 를 쓰지 않았나
//    Firebase Extensions 는 **2027-03-31 종료** 예정이다(콘솔 공지).
//    그 이후에는 설치·수정이 불가능해 나중에 다시 옮겨야 한다.
//    어차피 이 저장소에 functions 가 이미 있으므로 직접 만든다 — 종료 리스크가 없고
//    경로·크기·건너뛰기 규칙을 우리가 정확히 통제할 수 있다.
//
// 규약 (앱의 services/imageUrlService.ts 와 반드시 일치해야 한다):
//   원본    route_images/북한산/인수봉/서면슬랩/photo.jpg
//   썸네일  route_images/북한산/인수봉/서면슬랩/photo_400x400.jpg
//   · **같은 폴더**, **확장자 유지**, 접미사 `_400x400`
//   · 셋 중 하나만 어긋나도 앱이 썸네일을 못 찾고 원본으로 되돌아간다(동작은 한다)
// ═══════════════════════════════════════════════════════════════════════════
const {onObjectFinalized} = require("firebase-functions/v2/storage");
const sharp = require("sharp");

/** 썸네일을 만들 경로. 프로필 사진 등은 건드리지 않는다 */
const THUMB_PREFIXES = [
  "route_images/", "pitch_images/", "post_images/", "log_images/",
];
const THUMB_SUFFIX = "_400x400";
const THUMB_MAX = 400;

exports.generateThumbnail = onObjectFinalized(
    {
      // ⚠️ 리전이 버킷과 다르면 배포가 거부된다.
      //    배포 시 리전 오류가 나면 버킷 위치(콘솔 ▸ Storage ▸ 설정)에 맞춰 바꿀 것.
      region: "us-central1",
      memory: "1GiB",
      timeoutSeconds: 120,
      // 원본이 커도 한 번에 하나씩만 처리해 메모리 초과를 피한다
      concurrency: 1,
    },
    async (event) => {
      const object = event.data;
      const filePath = object.name || "";
      const contentType = object.contentType || "";

      // 1) 대상 경로인가
      if (!THUMB_PREFIXES.some((p) => filePath.startsWith(p))) return;

      // 2) 이미지인가
      if (!contentType.startsWith("image/")) return;

      // 3) ⚠️ 자기가 만든 썸네일을 다시 처리하면 **무한 루프**가 된다.
      //    이름과 메타데이터 두 겹으로 막는다.
      const dot = filePath.lastIndexOf(".");
      const slash = filePath.lastIndexOf("/");
      if (dot <= slash) return; // 확장자가 없으면 규약을 만들 수 없다
      const base = filePath.slice(0, dot);
      const ext = filePath.slice(dot);
      if (base.endsWith(THUMB_SUFFIX)) return;
      if (object.metadata && object.metadata.resizedImage === "true") return;

      const thumbPath = `${base}${THUMB_SUFFIX}${ext}`;
      const bucket = admin.storage().bucket(object.bucket);
      const thumbFile = bucket.file(thumbPath);

      // 4) 이미 있으면 다시 만들지 않는다 (백필을 여러 번 돌려도 안전하다)
      const [exists] = await thumbFile.exists();
      if (exists) return;

      try {
        const [buffer] = await bucket.file(filePath).download();
        const resized = await sharp(buffer)
            // fit: "inside" — 잘라내지 않고 긴 변을 400에 맞춘다. 비율 유지
            .resize(THUMB_MAX, THUMB_MAX, {fit: "inside", withoutEnlargement: true})
            .rotate() // EXIF 회전 정보를 실제 픽셀에 반영
            .toBuffer();

        await thumbFile.save(resized, {
          contentType,
          metadata: {
            // 위 3)의 루프 방지 표식
            metadata: {resizedImage: "true"},
            // 썸네일은 한 번 받으면 오래 캐시해도 된다
            cacheControl: "public, max-age=604800",
          },
        });

        console.log(`[thumb] 생성 ${thumbPath} (${buffer.length} → ${resized.length} bytes)`);
      } catch (e) {
        // 썸네일 생성 실패가 업로드 자체를 막으면 안 된다.
        // 앱은 썸네일이 없으면 원본으로 되돌아가므로 화면은 정상 동작한다.
        console.error(`[thumb] 실패 ${filePath}:`, e);
      }
    },
);

// ═══════════════════════════════════════════════════════════════════════════
// 커뮤니티 댓글 수 — 2026-09-07 (v2.1.0)
//
// ⚠️ 왜 서버에서 세는가:
//    클라이언트가 `commentCount` 를 직접 올리면, 규칙으로 "댓글을 실제로 달았을 때만
//    1 증가"를 검증할 방법이 없다. 아무나 남의 글 숫자를 마음대로 바꿀 수 있고,
//    댓글 쓰기는 성공했는데 카운트 업데이트만 실패하면 숫자가 영구히 어긋난다.
//    → 앱은 댓글 문서만 만들고(services/communityService.ts 의 addComment),
//      숫자는 이 트리거가 책임진다.
//
// ⚠️ `increment` 를 쓴다. 읽고-쓰기로 하면 동시에 두 명이 달 때 하나가 사라진다.
// ═══════════════════════════════════════════════════════════════════════════
exports.countCommunityComment = functions.firestore
    .document("community_posts/{postId}/comments/{commentId}")
    .onWrite(async (change, context) => {
      const created = !change.before.exists && change.after.exists;
      const deleted = change.before.exists && !change.after.exists;
      if (!created && !deleted) return null; // 본문 수정은 개수와 무관

      const postRef = admin.firestore()
          .collection("community_posts")
          .doc(context.params.postId);

      try {
        await postRef.update({
          commentCount: admin.firestore.FieldValue.increment(created ? 1 : -1),
        });
      } catch (e) {
        // 글이 이미 지워진 뒤 댓글이 정리되는 경우 — 정상 상황이라 로그만 남긴다
        console.log(`[comment-count] 건너뜀 ${context.params.postId}: ${e.message}`);
      }
      return null;
    });

// ═══════════════════════════════════════════════════════════════════════════
// 등반일지 공개 ↔ 커뮤니티 'log' 게시판 동기화 — 2026-09-07 (v2.1.0)
//
// 일지를 공개로 바꾸면 커뮤니티에 글이 생기고, 비공개로 되돌리거나 일지를 지우면
// 그 글도 사라진다.
//
// ⚠️ 왜 앱이 아니라 서버가 하나:
//    `users/{uid}/climbing_logs` 는 **소유자 전용** 하위 컬렉션이다. 공개용으로 읽으려면
//    규칙을 열어야 하는데, 그러면 **비공개 일지까지 노출된다.** 그래서 공개본을
//    `community_posts` 로 복사한다. 그리고 앱이 두 곳에 직접 쓰면 한쪽만 성공하는 날이
//    반드시 오고, 그때 비공개로 바꾼 일지가 커뮤니티에 그대로 남는다.
//
// ⚠️ **글 문서 ID = 원본 logId.** 매칭용 쿼리도, 중복 생성도 없어진다.
//
// ⚠️ 갱신할 때 `likeCount`/`commentCount`/`likedBy` 를 **건드리지 않는다.**
//    일지를 고칠 때마다 좋아요가 0으로 돌아가면 안 된다. 그래서 만들 때와 고칠 때
//    쓰는 필드가 다르다 (아래 CONTENT / COUNTERS).
// ═══════════════════════════════════════════════════════════════════════════
exports.syncPublicLog = functions.firestore
    .document("users/{uid}/climbing_logs/{logId}")
    .onWrite(async (change, context) => {
      const {uid, logId} = context.params;
      const after = change.after.exists ? change.after.data() : null;
      const postRef = admin.firestore().collection("community_posts").doc(logId);

      // 비공개이거나 일지가 지워졌으면 커뮤니티 글도 없애야 한다
      if (!after || after.isPublic !== true) {
        const snap = await postRef.get();
        if (snap.exists) {
          await postRef.delete();
          console.log(`[log-sync] 삭제 ${logId} (비공개 또는 일지 삭제)`);
        }
        return null;
      }

      // 작성자 표시용 값 — 목록에서 users 를 다시 읽지 않으려고 글에 같이 넣는다
      let nickname = "이름 없음";
      let photoUrl = "";
      try {
        const user = await admin.firestore().collection("users").doc(uid).get();
        const u = user.data() || {};
        nickname = u.nickname || nickname;
        photoUrl = u.photoUrl || "";
      } catch (e) {
        console.warn(`[log-sync] 사용자 조회 실패 ${uid}: ${e.message}`);
      }

      /*
       * 본문 — 일지 필드를 사람이 읽는 순서로 편다.
       * ⚠️ 참석자(partners)는 **넣지 않는다.** 같이 간 사람의 이름이 본인 동의 없이
       *    공개 게시판에 올라가면 안 된다.
       */
      const lines = [];
      if (after.routeName) lines.push(after.routeName);
      if (after.notes) lines.push(after.notes);
      if (after.gear) lines.push(`장비: ${after.gear}`);
      if (after.duration) lines.push(`소요시간: ${after.duration}`);

      const CONTENT = {
        boardId: "log",
        boardType: "log",
        authorUid: uid,
        nickname,
        photoUrl,
        body: lines.join("\n\n"),
        imageUrls: Array.isArray(after.photoUrls) ? after.photoUrls : [],
        logId,
        climbedAt: after.climbedAt || null,
        place: after.place || "",
        routeName: after.routeName || "",
        // 등반지 게시판과 같은 필드를 채워 두면 나중에 산으로 거를 수 있다
        mountain: (after.place || "").split(" ")[0] || "",
        isDeleted: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      const snap = await postRef.get();
      if (snap.exists) {
        // 고칠 때는 내용만. 좋아요·댓글 수는 그대로 둔다 (위 머리말)
        await postRef.update(CONTENT);
        console.log(`[log-sync] 갱신 ${logId}`);
      } else {
        const COUNTERS = {
          likeCount: 0,
          likedBy: [],
          commentCount: 0,
          reportCount: 0,
          // ⚠️ 목록 정렬 기준은 `timestamp` 다 (createdAt 아님 — v1 필드명 규칙)
          timestamp: after.climbedAt || admin.firestore.FieldValue.serverTimestamp(),
        };
        await postRef.set({...CONTENT, ...COUNTERS});
        console.log(`[log-sync] 생성 ${logId}`);
      }
      return null;
    });

// ═══════════════════════════════════════════════════════════════════════════
// 난이도 제안 자동 반영 — 2026-09-07 (v2.2.0)
//
// ⚠️ 배경: 리드 루트 2,995개 중 난이도가 적힌 건 99개(3%)뿐이다(실측).
//    난이도는 루트를 고르는 첫 기준이고, 없으면 완등 기록에 점수를 매길 수 없다.
//    관리자 혼자 5천 개를 채울 수는 없으므로 **본 사람이 알려주게** 하되,
//    한 사람의 착각이 정답이 되면 안 되므로 **같은 값 3명**을 요구한다.
//
// ⚠️ 왜 서버가 하나: "3명이 동의했다"는 조건은 **보안 규칙으로 검증할 수 없다.**
//    클라이언트가 개념도의 difficulty 를 직접 쓰게 두면 아무나 한 번에 덮어쓴다.
//
// ⚠️ 이미 난이도가 있는 루트는 **건드리지 않는다.** 제안으로 기존 값을 뒤엎으면
//    관리자가 확인해 넣은 값이 사라진다.
// ═══════════════════════════════════════════════════════════════════════════
const AGREE_THRESHOLD = 3;

exports.applyDifficultySuggestion = functions.firestore
    .document("difficulty_suggestions/{suggestionId}")
    .onWrite(async (change, context) => {
      const after = change.after.exists ? change.after.data() : null;
      if (!after) return null; // 삭제는 무시 (반영 후 정리하면서 지운다)

      const {conceptId, conceptSource} = after;
      if (!conceptId || !conceptSource) return null;
      if (!["route_reports", "bouldering_reports"].includes(conceptSource)) {
        console.warn(`[difficulty] 알 수 없는 컬렉션: ${conceptSource}`);
        return null;
      }

      const dbx = admin.firestore();
      const conceptRef = dbx.collection(conceptSource).doc(conceptId);
      const snap = await conceptRef.get();
      if (!snap.exists) return null;

      const cur = snap.data() || {};
      const already = [cur.difficulty, cur.avgDifficulty]
          .some((v) => typeof v === "string" && v.trim().length > 0);
      if (already) return null; // 위 머리말: 기존 값을 뒤엎지 않는다

      // 이 루트에 모인 제안을 모두 읽어 최다 득표를 센다
      const all = await dbx.collection("difficulty_suggestions")
          .where("conceptId", "==", conceptId).get();

      const tally = {};
      all.forEach((d) => {
        const v = (d.data().value || "").trim();
        if (v) tally[v] = (tally[v] || 0) + 1;
      });

      let best = null;
      for (const [value, count] of Object.entries(tally)) {
        if (!best || count > best.count) best = {value, count};
      }
      if (!best || best.count < AGREE_THRESHOLD) return null;

      await conceptRef.update({difficulty: best.value});
      console.log(
          `[difficulty] 반영 ${conceptSource}/${conceptId} = ${best.value} (${best.count}표)`,
      );

      // 반영이 끝났으면 제안을 정리한다. 남겨 두면 매 쓰기마다 다시 계산한다
      const batch = dbx.batch();
      all.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      return null;
    });

// ═══════════════════════════════════════════════════════════════════════════
// 완등 통계 — 2026-09-07 (v2.2.0)
//
// `sends` 문서가 생기고 지워질 때 개념도의 sendCount / ratingSum / ratingCount 를 맞춘다.
//
// ⚠️ 왜 서버가 세는가: 클라이언트가 올리면 보안 규칙으로 "정말 완등을 남겼는가"를
//    검증할 수 없다. 아무나 남의 루트 숫자를 바꿀 수 있고, 완등 저장은 성공했는데
//    카운터만 실패하면 숫자가 **영구히** 어긋난다 (커뮤니티 commentCount 와 같은 이유).
//
// ⚠️ **평균 별점을 저장하지 않는다.** 합과 개수만 두고 앱에서 나눈다 —
//    `increment` 로 동시성 문제가 사라진다 (app/src/types/send.ts averageRating).
//
// ⚠️ 별점 수정도 처리해야 한다. 4점 → 5점으로 고치면 ratingSum 만 +1 이고
//    ratingCount 는 그대로여야 한다.
// ═══════════════════════════════════════════════════════════════════════════
exports.countSend = functions.firestore
    .document("sends/{sendId}")
    .onWrite(async (change, context) => {
      const before = change.before.exists ? change.before.data() : null;
      const after = change.after.exists ? change.after.data() : null;

      const src = (after || before || {}).conceptSource;
      const cid = (after || before || {}).conceptId;
      if (!cid || !["route_reports", "bouldering_reports"].includes(src)) return null;

      const rating = (d) => (d && typeof d.rating === "number" ? d.rating : null);
      const rb = rating(before);
      const ra = rating(after);

      const patch = {};
      const inc = admin.firestore.FieldValue.increment;

      // 완등 수
      if (!before && after) patch.sendCount = inc(1);
      else if (before && !after) patch.sendCount = inc(-1);

      // 별점 — 생성/삭제/수정 세 경우를 모두 다룬다
      const sumDelta = (ra || 0) - (rb || 0);
      const countDelta = (ra ? 1 : 0) - (rb ? 1 : 0);
      if (sumDelta !== 0) patch.ratingSum = inc(sumDelta);
      if (countDelta !== 0) patch.ratingCount = inc(countDelta);

      if (Object.keys(patch).length === 0) return null;

      try {
        await admin.firestore().collection(src).doc(cid).update(patch);
      } catch (e) {
        // 개념도가 지워진 뒤 완등이 정리되는 경우 — 정상 상황이라 로그만 남긴다
        console.log(`[send-count] 건너뜀 ${src}/${cid}: ${e.message}`);
      }
      return null;
    });
