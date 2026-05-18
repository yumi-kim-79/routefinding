/*
 * update_route_coords.cjs
 * ---------------------------------------------
 * 이 스크립트는 final_merged_route_data.csv 파일에서
 * '위도'(BOM 있는 경우 포함)와 '경도' 값이 채워진 행을 찾아
 * Firestore의 route_reports 컬렉션내 문서를 다음 순서로 매칭하여 좌표를 업데이트합니다:
 *  1) 산이름 + 구역 필드 일치
 *  2) (구역 미기재 시) 산이름 + 루트명 필드 일치
 *  3) (위 조건 모두 미일치 시) 산이름만 일치
 *
 * 사용법:
 *   npm install firebase-admin csv-parse
 *   node update_route_coords.cjs
 */

const fs = require('fs');
const path = require('path');
const parse = require('csv-parse/sync');
const admin = require('firebase-admin');

// --- 설정 ---
const CSV_PATH = path.join(__dirname, 'final_merged_route_data.csv');
const SERVICE_ACCOUNT_KEY = path.join(__dirname, 'serviceAccountKey.json');

// --- Firebase 초기화 ---
const serviceAccount = require(SERVICE_ACCOUNT_KEY);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
console.log('Firestore projectId:', serviceAccount.project_id);

// --- CSV 읽기 및 BOM 제거 ---
let rawCsv = fs.readFileSync(CSV_PATH, 'utf-8');
rawCsv = rawCsv.replace(/^\uFEFF/, '');

// --- CSV 파싱 ---
const records = parse.parse(rawCsv, { columns: true, skip_empty_lines: true });
console.log(`총 레코드 수: ${records.length}`);

// 유효 좌표 행 필터링
const coords = records.filter(r => r['위도'] && r['경도']);
console.log(`좌표가 채워진 행: ${coords.length}`);

// 산이름 중복 제거
const seen = new Set();
const uniqueCoords = coords.filter(r => {
  const key = `${r['산이름']}-${r['구역'] || ''}-${r['루트명'] || ''}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});
console.log(`중복 제거 후 행 수: ${uniqueCoords.length}`);

// --- 업데이트 ---
(async () => {
  for (const row of uniqueCoords) {
    const mountain = row['산이름'];
    const zone     = row['구역'];
    const route    = row['루트명'];
    const lat      = parseFloat(row['위도']);
    const lng      = parseFloat(row['경도']);

    let query = db.collection('route_reports')
                  .where('산이름', '==', mountain);
    if (zone) {
      query = query.where('구역', '==', zone);
    } else if (route) {
      query = query.where('루트명', '==', route);
    }

    const snapshot = await query.get();
    if (snapshot.empty) {
      console.warn(`문서 미발견: ${mountain}${zone? '/' + zone : ''}${route? '/' + route : ''}`);
      continue;
    }

    snapshot.forEach(doc => {
      try {
        doc.ref.set({
          latitude: lat,
          longitude: lng,
          location: new admin.firestore.GeoPoint(lat, lng)
        }, { merge: true });
        console.log(`Upserted ${doc.id} (${mountain}/${zone || '-'} / ${route || '-'})`);
      } catch (err) {
        console.error(`업데이트 실패 ${doc.id}:`, err.message);
      }
    });
  }
  console.log('All done! 좌표 업데이트 완료.');
})();
