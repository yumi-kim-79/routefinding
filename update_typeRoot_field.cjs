const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// 서비스 계정 키 경로
const serviceAccount = require(path.resolve(__dirname, 'routefinding09-4b597-firebase-adminsdk-fbsvc-61bfb17e96.json'));

// Firebase Admin 초기화
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function updateAllRouteReports() {
  const snapshot = await db.collection('route_reports').get();

  console.log(`총 ${snapshot.size}개의 문서가 발견됨. 업데이트 시작!`);

  let updated = 0;

  for (const doc of snapshot.docs) {
    // 이미 typeRoot 필드가 있으면 건너뛰기
    if (doc.data().hasOwnProperty('typeRoot')) {
      continue;
    }

    // 기존 type 필드 내용 백업
    const oldType = doc.data().type || '';
    // 신규 구분 필드 기본값: '리드'
    await doc.ref.update({
      typeRoot: '리드', // ← 기존 루트는 "리드"로 세팅
      oldTypeValue: oldType, // ← 기존 type 내용 백업(원하면 삭제)
    });
    updated++;
    console.log(`[${doc.id}] => typeRoot: '리드' 추가, oldType: '${oldType}'`);
  }

  console.log(`업데이트 완료! 총 ${updated}개 문서가 수정됨.`);
}

updateAllRouteReports()
  .then(() => {
    console.log('모든 작업 완료!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('오류 발생:', err);
    process.exit(1);
  });
