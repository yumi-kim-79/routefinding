// bouldering_upload.js

const admin = require('firebase-admin');
const fs    = require('fs');
const path  = require('path');
const csv   = require('csv-parser');

// ── Firebase 초기화 ──
// 서비스 계정 키 JSON 경로를 환경에 맞게 수정하세요.
const serviceAccount = require(path.resolve(
  __dirname,
  'routefinding09-4b597-firebase-adminsdk-fbsvc-61bfb17e96.json'
));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// ── CSV 파일 경로 ──
const CSV_FILE_PATH = path.resolve(__dirname, 'bouldering_data_nfc.csv');

// ── 메인 함수 ──
async function uploadFromCSV() {
  const rows = [];

  // CSV 읽기
  fs.createReadStream(CSV_FILE_PATH)
    .pipe(csv({
      mapHeaders: ({ header }) => header.trim(),   // 헤더 공백 제거
      mapValues:  ({ value })  => value.trim(),    // 값 공백 제거
    }))
    .on('data', row => rows.push(row))
    .on('end', async () => {
      console.log(`총 ${rows.length}개 행 읽음. bouldering_reports 컬렉션에 업로드 시작…\n`);
      let count = 0;

      for (const row of rows) {
        try {
          // coords 필드에서 위도/경도 분리
          let latitude = null, longitude = null;
          if (row.coords) {
            const [lat, lng] = row.coords.split(',').map(s => s.trim());
            latitude  = parseFloat(lat);
            longitude = parseFloat(lng);
          }

          // 업로드할 데이터 객체
          const data = {
            mountain:    row.mountain    || '',
            zone:        row.zone        || '',
            routeName:   row.routeName   || '',
            difficulty:  row.difficulty   || '',
            latitude,
            longitude,
            directions:  row.directions  || '',
            description: row.description || '',
            no:          row.no ? parseInt(row.no, 10) : null,
            status:      'approved',
            typeRoot:    '볼더링',
            timestamp:   admin.firestore.FieldValue.serverTimestamp(),
          };

          // 중복 방지용 doc ID 생성 (공백 → 언더스코어)
          const docId = `${data.mountain}_${data.zone}_${data.routeName}`
            .replace(/\s+/g, '_');

          // 덮어쓰기(set): 기존 문서가 있으면 덮어쓰고, 없으면 새로 생성
          await db
            .collection('bouldering_reports')
            .doc(docId)
            .set(data);

          count++;
          console.log(`✅ [${count}/${rows.length}] 업로드/덮어쓰기: ${data.routeName}`);
        } catch (err) {
          console.error(`❌ 업로드 실패 (행 ${count + 1}):`, err);
        }
      }

      console.log(`\n모두 완료! 총 ${count}개 볼더링 루트가 bouldering_reports 에 업로드/덮어쓰였습니다.`);
      process.exit(0);
    })
    .on('error', err => {
      console.error('CSV 읽기 오류:', err);
      process.exit(1);
    });
}

// 실행
uploadFromCSV().catch(err => {
  console.error('스크립트 실행 중 예기치 못한 오류:', err);
  process.exit(1);
});
