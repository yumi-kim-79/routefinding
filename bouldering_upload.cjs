// bouldering_upload.cjs

const admin = require('firebase-admin');
const fs    = require('fs');
const path  = require('path');
const csv   = require('csv-parser');

// Firebase 초기화
const serviceAccount = require(path.resolve(__dirname, 'routefinding09-4b597-firebase-adminsdk-fbsvc-61bfb17e96.json'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

// CSV 파일 경로
const CSV_FILE_PATH = path.resolve(__dirname, 'bouldering_data.csv');

// CSV→NFC 변환 함수(필요시)
function nfc(str) {
  return (str || '').toString().normalize('NFC');
}

// 메인 함수
async function uploadFromCSV() {
  const rows = [];

  fs.createReadStream(CSV_FILE_PATH)
    .pipe(csv({
      mapHeaders: ({ header }) => header.trim(),
      mapValues:  ({ value })  => value.trim(),
    }))
    .on('data', row => rows.push(row))
    .on('end', async () => {
      console.log(`총 ${rows.length}개 행을 읽었습니다. 업로드 시작합니다…\n`);
      let count = 0;

      for (const row of rows) {
        try {
          // latitude/longitude 파싱: number로
          let latitude = null, longitude = null;
          if (row.latitude && row.longitude) {
            latitude = parseFloat(row.latitude);
            longitude = parseFloat(row.longitude);
          } else if (row.coords) {
            // 혹시 coords라는 필드가 있다면 "lat,lon" 파싱
            const [lat, lng] = row.coords.split(',').map(s => s.trim());
            latitude  = parseFloat(lat);
            longitude = parseFloat(lng);
          }

          // 나머지 필드도 NFC(완성형)으로 통일 (선택)
          const mountain   = nfc(row.mountain);
          const zone       = nfc(row.zone);
          const routeName  = nfc(row.routeName);
          const difficulty = nfc(row.difficulty);
          const directions = nfc(row.directions);
          const description= nfc(row.description);

          // Firestore에 저장할 데이터
          const data = {
            mountain,
            zone,
            routeName,
            difficulty,
            latitude,
            longitude,
            directions,
            description,
            no: row.no ? parseInt(row.no, 10) : null,
            status: 'approved',
            typeRoot: '볼더링',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
          };

          // 문서 ID 예시 (필요시 고유하게!)
          const docId = `${mountain}|${zone}|${routeName}`;

          // 업로드
          await db.collection('bouldering_reports').doc(docId).set(data, { merge: true });

          count++;
          console.log(`✅ [${count}/${rows.length}] ${mountain}·${zone}·${routeName} 업로드 완료`);
        } catch (err) {
          console.error(`❌ 업로드 실패 (행 ${count + 1}):`, err);
        }
      }
      console.log(`\n모두 완료! 총 ${count}개 볼더링 루트 업로드/덮어쓰기 완료`);
      process.exit(0);
    })
    .on('error', err => {
      console.error('CSV 읽기 중 오류:', err);
      process.exit(1);
    });
}

uploadFromCSV().catch(err => {
  console.error('스크립트 실행 중 오류:', err);
  process.exit(1);
});
