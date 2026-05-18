// force_set_typeRoot_lead.js

const admin = require('firebase-admin');
const path  = require('path');

// ── Firebase 인증 (서비스 계정 키 JSON 경로를 본인 환경에 맞게 수정하세요) ──
const serviceAccount = require(path.resolve(__dirname,
  'routefinding09-4b597-firebase-adminsdk-fbsvc-61bfb17e96.json'
));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

async function main() {
  console.log('▶️ /route_reports 모든 문서에 typeRoot="리드" 강제 적용 시작…\n');

  // 1) 산 이름별로 문서 가져오기
  const mountains = await db.collection('route_reports').listDocuments();

  for (const mountainRef of mountains) {
    const mountain = mountainRef.id;

    // 2) 해당 산 문서 하위의 '구역' 컬렉션들 리스트업
    const zoneCols = await mountainRef.listCollections();

    for (const zoneCol of zoneCols) {
      const zone = zoneCol.id;

      // 3) 각 구역 컬렉션 내의 루트 문서들 순회
      const routeDocs = await zoneCol.listDocuments();

      for (const routeRef of routeDocs) {
        // 여기서 무조건 덮어씌웁니다 (merge 옵션 없이 update)
        await routeRef.update({ typeRoot: '리드' });
        console.log(`✔️ [업데이트] ${mountain}/${zone}/${routeRef.id}`);
      }
    }
  }

  console.log('\n✅ 완료: 모든 route_reports 문서에 typeRoot="리드" 적용되었습니다.');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ 오류 발생:', err);
  process.exit(1);
});
