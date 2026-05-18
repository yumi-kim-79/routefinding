const admin = require('firebase-admin');
const serviceAccount = require('./routefinding09-4b597-firebase-adminsdk-fbsvc-61bfb17e96.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

async function fixCollectionLatLng(collection) {
  const snap = await db.collection(collection).get();
  let count = 0, updated = 0, skipped = 0;
  for (const doc of snap.docs) {
    const d = doc.data();
    let lat = d.latitude, lng = d.longitude;

    // 이미 number 타입이면 skip
    if (typeof lat === 'number' && typeof lng === 'number') {
      skipped++;
      continue;
    }

    // string일 때만 변환
    let updateNeeded = false;
    if (typeof lat === 'string') {
      lat = parseFloat(lat);
      updateNeeded = true;
    }
    if (typeof lng === 'string') {
      lng = parseFloat(lng);
      updateNeeded = true;
    }
    if (updateNeeded && !isNaN(lat) && !isNaN(lng)) {
      await doc.ref.update({ latitude: lat, longitude: lng });
      updated++;
      console.log(`[${collection}] [변환] ${doc.id} → latitude: ${lat}, longitude: ${lng}`);
    } else {
      console.warn(`[${collection}] [스킵] ${doc.id} → lat:${lat}, lng:${lng} (변환 불가)`);
    }
    count++;
  }
  console.log(`\n[${collection}] 전체: ${count}개, 변환: ${updated}개, 이미 number: ${skipped}개`);
}

async function main() {
  await fixCollectionLatLng('route_reports');
  await fixCollectionLatLng('bouldering_reports');
}

main().catch(e => {
  console.error('오류 발생:', e);
  process.exit(1);
});
