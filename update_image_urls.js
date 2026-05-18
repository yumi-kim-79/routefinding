const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const Account = require('./routefinding09-4b597-firebase-adminsdk-fbsvc-61bfb17e96.json');

admin.initializeApp({
  credential: admin.credential.cert(Account),
  storageBucket: 'routefinding09-4b597.firebasestorage.app',
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

// 문자열 정규화 (띄어쓰기만 제거)
function normalize(str) {
  return (str || '').replace(/\s+/g, '').toLowerCase();
}

// 파일명에서 '1P', '1피치' 등 제거 (피치 구분자 제거)
function cleanPitchSuffix(name) {
  return name.replace(/^\d+\s*(p|피치)?/i, '').trim();
}

// 파일 base 정리 (예: '1.거룡 1P' → '1.거룡')
function simplifyFileBase(base) {
  return base.replace(/\s*(\d+p|\d+\s*피치)$/i, '').trim();
}

const failedList = [];

// 대표 이미지 업데이트
async function updateRouteMainImage(routeDoc, mountain, zone, routeName, files) {
  const normMountain = normalize(mountain);
  const normZone = normalize(zone);
  const normRoute = normalize(routeName);
  const targetFileName = `0.${routeName}`;
  const normalizedTarget = normalize(targetFileName);

  for (const file of files) {
    const [_, m, z, r] = file.name.split('/');
    if (!m || !z || !r) continue;
    if (
      normalize(m) !== normMountain ||
      normalize(z) !== normZone ||
      normalize(r) !== normRoute
    ) continue;

    const fname = file.name.split('/').pop();
    if (!/\.(png|jpe?g|webp)$/i.test(fname)) continue;

    const base = fname.replace(/\.[^.]+$/, '');
    if (normalize(base) === normalizedTarget) {
      const [url] = await file.getSignedUrl({ action: 'read', expires: '2050-01-01' });
      await routeDoc.ref.update({ imageUrl: url });
      console.log(`[대표이미지] ${mountain}/${zone}/${routeName} → 업데이트 완료`);
      return;
    }
  }

  await routeDoc.ref.update({ imageUrl: '' });
  failedList.push({ mountain, zone, routeName, target: `0.${routeName}` });
  console.error(`[실패] 대표 이미지 없음: ${mountain}/${zone}/${routeName}/0.${routeName}`);
}

// 피치 이미지 업데이트
async function updatePitchesImages(routeDoc, mountain, zone, routeName, files) {
  const snapshot = await routeDoc.ref.collection('pitches').get();
  const normMountain = normalize(mountain);
  const normZone = normalize(zone);
  const normRoute = normalize(routeName);

  const tasks = snapshot.docs.map(async (pitchDoc) => {
    const data = pitchDoc.data();
    const rawName = data.pitchName || data.name || data.피치이름 || '';

    let pitchNum = '1';
    const match = rawName.match(/^(\d+)/);
    if (match) pitchNum = match[1];

    const expectedBase = normalize(`${pitchNum}.${routeName}`);

    for (const file of files) {
      const [_, m, z, r] = file.name.split('/');
      if (!m || !z || !r) continue;
      if (
        normalize(m) !== normMountain ||
        normalize(z) !== normZone ||
        normalize(r) !== normRoute
      ) continue;

      const fname = file.name.split('/').pop();
      if (!/\.(png|jpe?g|webp)$/i.test(fname)) continue;

      const base = fname.replace(/\.[^.]+$/, '');
      const simplifiedBase = normalize(simplifyFileBase(base));

      if (simplifiedBase === expectedBase) {
        const [url] = await file.getSignedUrl({ action: 'read', expires: '2050-01-01' });
        await pitchDoc.ref.update({ imageUrl: url });
        console.log(`[피치이미지] ${mountain}/${zone}/${routeName}/${rawName} → 매칭됨`);
        return;
      }
    }

    await pitchDoc.ref.update({ imageUrl: '' });
    failedList.push({ mountain, zone, routeName, target: `${pitchNum}.${routeName}` });
    console.error(`[실패] 피치 이미지 없음: ${mountain}/${zone}/${routeName}/${pitchNum}.${routeName}`);
  });

  await Promise.all(tasks);
}

// 전체 실행
async function updateAllImagesParallel() {
  const routes = await db.collection('route_reports').get();
  const [files] = await bucket.getFiles({ prefix: 'route_images/' });

  const tasks = routes.docs.map(async (doc) => {
    const data = doc.data();
    await updateRouteMainImage(doc, data.mountain, data.zone, data.routeName, files);
    await updatePitchesImages(doc, data.mountain, data.zone, data.routeName, files);
  });

  await Promise.all(tasks);

  // 실패 로그 저장
  const csv = 'mountain,zone,routeName,target\n' +
    failedList.map(e => `${e.mountain},${e.zone},${e.routeName},${e.target}`).join('\n');
  fs.writeFileSync(path.join(__dirname, 'failures.csv'), csv, 'utf8');
  console.log(`\n=== 완료됨: 실패 ${failedList.length}건 저장됨 ===`);
}

// 실행
updateAllImagesParallel()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
