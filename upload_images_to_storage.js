const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');   // ✅ mime-types 패키지!

const serviceAccount = require('./routefinding09-4b597-firebase-adminsdk-fbsvc-61bfb17e96.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'routefinding09-4b597.firebasestorage.app',
});
const bucket = admin.storage().bucket();

const LOCAL_IMAGE_ROOT = '/Users/yusungyun/images';
const STORAGE_ROOT = 'route_images';

function walkImages(dir, relPath = []) {
  let list = [];
  fs.readdirSync(dir).forEach(name => {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) {
      list = list.concat(walkImages(full, relPath.concat(name)));
    } else if (/\.(png|jpe?g)$/i.test(name)) {
      list.push({
        relParts: relPath,
        fileName: name,
        localPath: full,
      });
    }
  });
  return list;
}

async function uploadImage({relParts, fileName, localPath}) {
  const storagePath = [STORAGE_ROOT, ...relParts, fileName].join('/');
  // 여기만 수정!!
  const contentType = mime.lookup(fileName) || 'application/octet-stream';
  console.log(`[업로드 시도] ${localPath} → ${storagePath}`);
  await bucket.upload(localPath, {
    destination: storagePath,
    metadata: {
      contentType,
      cacheControl: 'public,max-age=31536000',
    }
  });
  console.log(`✅ 업로드 완료: ${storagePath}`);
}

async function main() {
  const allImages = walkImages(LOCAL_IMAGE_ROOT);
  console.log(`총 ${allImages.length}개 이미지 업로드 시작...`);
  for (let i = 0; i < allImages.length; ++i) {
    try {
      await uploadImage(allImages[i]);
    } catch (err) {
      console.error(`❌ 실패: ${allImages[i].localPath}`, err);
    }
  }
  console.log('\n🎉 모든 이미지 Storage 업로드 완료!');
}

main();
