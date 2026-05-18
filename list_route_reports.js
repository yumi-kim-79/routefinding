const admin = require("firebase-admin");
const serviceAccount = require("./routefinding09-4b597-firebase-adminsdk-fbsvc-61bfb17e96.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function listDocs() {
  // 1) route_reports
  const snap1 = await db.collection('route_reports').get();
  console.log('route_reports 문서 개수:', snap1.size);
  for (const doc of snap1.docs) {
    console.log('route_reports 문서ID:', doc.id);
  }

  // 2) bouldering_reports
  const snap2 = await db.collection('bouldering_reports').get();
  console.log('bouldering_reports 문서 개수:', snap2.size);
  for (const doc of snap2.docs) {
    console.log('bouldering_reports 문서ID:', doc.id);
  }
}

listDocs();
