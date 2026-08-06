const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

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
