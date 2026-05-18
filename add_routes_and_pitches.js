const admin = require('firebase-admin');
const fs = require('fs');
const csv = require('fast-csv');
const path = require('path');

// Firebase 인증
const serviceAccount = require('./routefinding09-4b597-firebase-adminsdk-fbsvc-61bfb17e96.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

// 경로 설정
const CSV_PATH    = path.join(__dirname, 'final_merged_nfc.csv');
const IMAGES_ROOT = '/Users/yusungyun/images';

// 비교(매칭)용: 공백, 특수문자, 대소문자 무시 후 완성형(NFC)
function normalize(str) {
  return (str||'')
    .toString()
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .toLowerCase();
}

// 실제 Firestore/URL/필드 저장용: NFC
function nfc(str) {
  return (str||'').toString().normalize('NFC');
}

// 모든 이미지 파일 목록 수집 (폴더, 파일명도 NFC)
function collectAllImages(root) {
  const infos = [];
  function walk(dir, parts) {
    fs.readdirSync(dir).forEach(name => {
      const full = path.join(dir, name);
      const nName = nfc(name);
      if (fs.statSync(full).isDirectory()) {
        walk(full, [...parts, nName]);
      } else if (/\.(png|jpe?g)$/i.test(nName)) {
        infos.push({ parts, file: nName, fullPath: full });
      }
    });
  }
  walk(root, []);
  return infos;
}

// Storage URL 생성 (폴더/파일명 NFC)
function makeStorageUrl(parts, fileName) {
  const enc = parts.map(x => encodeURIComponent(nfc(x))).join('%2F');
  return `https://firebasestorage.googleapis.com/v0/b/routefinding09-4b597.firebasestorage.app/o/route_images%2F${enc}%2F${encodeURIComponent(nfc(fileName))}?alt=media`;
}

async function main() {
  // 1. 이미지 전체 목록 수집
  const allImages = collectAllImages(IMAGES_ROOT);

  // 2. CSV 파싱 (모든 값 NFC 변환)
  const rows = [];
  await new Promise((resolve, reject) => {
    fs.createReadStream(CSV_PATH)
      .pipe(csv.parse({ headers: true, skipEmptyLines: true }))
      .on('error', reject)
      .on('data', row => {
        Object.keys(row).forEach(k => { row[k] = nfc(row[k]); });
        if (Object.values(row).every(v=>!v||v.trim()==='')) return;
        rows.push(row);
      })
      .on('end', resolve);
  });

  // 3. 루트 데이터 그룹핑 (산/구역/루트이름 NFC로)
  const routesMap = new Map();

  for (const row of rows) {
    const mountain   = nfc((row['산이름']   || '').trim());
    const zone       = nfc((row['구역']     || '').trim());
    const routeName  = nfc((row['루트이름'] || '').trim());
    const overview   = nfc((row['등반개요'] || '').trim());
    const type       = nfc((row['등반형태'] || '').trim());
    const typeRoot   = '리드';
    const equipment  = nfc((row['등반장비'] || '').trim());
    const avgDifficulty = nfc((row['평균난이도'] || '').trim());
    const pioneer    = nfc((row['개척자']   || '').trim());
    const latitude   = nfc((row['위도']     || '').trim());
    const longitude  = nfc((row['경도']     || '').trim());

    if (!mountain || !zone || !routeName) continue;

    // 비교는 normalize, 저장·경로는 nfc
    const nMountain = normalize(mountain);
    const nZone     = normalize(zone);
    const nRoute    = normalize(routeName);

    // 이미지 매칭: 폴더구조(산/구역/루트) NFC
    const routeImages = allImages.filter(info =>
      info.parts.length >= 3 &&
      normalize(info.parts[0]) === nMountain &&
      normalize(info.parts[1]) === nZone &&
      normalize(info.parts[2]) === nRoute
    );

    // 대표 이미지: "0."으로 시작하거나 "대표" 키워드
    const mainImg = routeImages.find(i => /^0\./.test(i.file) || /대표/.test(i.file));
    const imageUrl = mainImg
      ? makeStorageUrl([mountain, zone, routeName], mainImg.file)
      : '';

    // 문서ID: "산이름|구역|루트이름" (완성형, 구분용 |, 한글순 정렬 O)
    const routeDocId = `${mountain}|${zone}|${routeName}`;
    if (!routesMap.has(routeDocId)) {
      routesMap.set(routeDocId, {
        data: {
          mountain, zone, routeName, overview, type, typeRoot, equipment, avgDifficulty, pioneer,
          latitude, longitude, imageUrl, status: 'approved',
          authorUid: "TtLuDvHKG2g7EXAkHMw15z1avu03",
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        },
        pitches: []
      });
    }

    // 피치 처리
    const pitchRaw = nfc((row['피치이름'] || '').trim() || '1피치');
    const nPitch   = normalize(pitchRaw);
    const numMatch = pitchRaw.match(/(\d+)/);
    const pAlias   = numMatch ? numMatch[1] + '피치' : '1피치';

    // 피치 이미지 찾기
    const pitchImg = routeImages.find(info => {
      const fn = normalize(info.file);
      return (
        (fn.startsWith(numMatch ? numMatch[1] : '1')) &&
        (fn.includes(nRoute) || fn.includes(nPitch) || fn.includes(pAlias))
      );
    });
    const pitchImgUrl = pitchImg
      ? makeStorageUrl([mountain, zone, routeName], pitchImg.file)
      : '';

    routesMap.get(routeDocId).pitches.push({
      name:       pitchRaw,
      length:     nfc((row['피치길이']   || '').trim()),
      difficulty: nfc((row['피치난이도']|| '').trim()),
      style:      nfc((row['피치형태']   || '').trim()),
      gear:       nfc((row['피치장비']   || '').trim()),
      imageUrl:   pitchImgUrl,
      timestamp:  admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  // 4. 가나다(사전)순으로 업로드
  const sortedKeys = Array.from(routesMap.keys()).sort((a, b) => a.localeCompare(b, 'ko'));

  for (const routeKey of sortedKeys) {
    const route = routesMap.get(routeKey);
    // 문서ID를 routeDocId로 직접 지정! (| 포함, 한글 정렬 그대로 사용)
    const ref = db.collection('route_reports').doc(routeKey);
    await ref.set(route.data, { merge: true });
    console.log(`[루트] ${route.data.mountain}/${route.data.zone}/${route.data.routeName} 업로드 (docId: ${routeKey})`);
    for (const p of route.pitches) {
      if (!p.name) continue;
      await ref.collection('pitches').doc(p.name).set(p, { merge: true });
      console.log(`  [피치] ${p.name} 업로드 (imageUrl: ${p.imageUrl ? "O" : "-"})`);
    }
  }
  console.log('\n✅ 모든 루트 및 피치 Firestore 가나다순 업로드 완료!');
}

main().catch(err => {
  console.error('❌ 오류:', err);
  process.exit(1);
});
