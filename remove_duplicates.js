const admin = require("firebase-admin");
const serviceAccount = require("./routefinding09-4b597-firebase-adminsdk-fbsvc-61bfb17e96.json");
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function migrateRouteReports() {
  const mountainSnap = await db.collection('route_reports').listCollections();

  let count = 0;
  for (const mountainCol of mountainSnap) {
    // 예: 거제도
    const areaSnap = await mountainCol.listCollections();
    for (const areaCol of areaSnap) {
      // 예: 계룡산암장
      const routeSnap = await areaCol.get();
      for (const routeDoc of routeSnap.docs) {
        // 예: 계룡산
        const routeData = routeDoc.data();

        // 원본 document 경로: route_reports/{산이름}/{암장명}/{루트명}
        // 복사할 document 경로: route_reports/{루트명}_{암장명}_{산이름}
        const newDocId = `${routeDoc.id}_${areaCol.id}_${mountainCol.id}`;

        await db.collection('route_reports').doc(newDocId).set({
          ...routeData,
          mountain: mountainCol.id,
          area: areaCol.id,
          originPath: routeDoc.ref.path,
        }, { merge: true });

        count++;
        console.log(`[${count}] 복사 완료: ${newDocId}`);
      }
    }
  }

  console.log(`\n✅ 최상위 route_reports로 복사 완료! 총 ${count}개`);
}

migrateRouteReports()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("오류 발생:", err);
    process.exit(1);
  });
