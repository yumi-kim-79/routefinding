# 14. 개념도 이미지 로딩 성능

> 2026-08-25. 사용자 피드백: "개념도가 많아 목록 썸네일이 너무 느리고, 목록도 잘 안 내려간다."

---

## 1. 왜 느린가 — 원인은 **두 가지**다

### 원인 A. 썸네일 한 장마다 네트워크 왕복이 **한 번 더** 있다
DB에 저장된 이미지 주소가 `https://storage.googleapis.com/...` (GCS 원본)이라
그대로 쓰면 403이다. 그래서 `getDownloadURL()` 로 토큰이 붙은 주소를 **다시 물어본다**
(`services/imageUrlService.ts`).

목록이 한 번에 10장을 그리면 이 왕복이 **동시에 10건** 나간다. 스크롤하면 계속 쌓인다.
요청들이 서로를 밀어내서 **지금 보이는 썸네일조차 늦게** 뜬다(head-of-line blocking).

캐시는 있지만 **메모리 전용**이라 앱을 껐다 켜면 처음부터 다시 한다.

### 원인 B. 🚨 104×88 자리에 **원본 사진**을 받는다 — 이게 더 크다
목록 카드 썸네일 크기는 `104 × 88` px 인데, 받는 것은 카메라 원본이다.
장당 2~5MB면 화면 하나 채우는 데 20~50MB를 내려받는 셈이다.
디코딩 비용도 그대로 들어가 **스크롤이 끊기는 직접 원인**이 된다.

---

## 2. 코드로 한 것 (2026-08-25 적용)

원인 A를 정리하고 체감을 크게 개선한다. **원인 B는 코드로 못 고친다** (→ §3).

| 조치 | 파일 | 효과 |
|---|---|---|
| 동시 변환 요청을 **4건**으로 제한 | `services/imageUrlService.ts` | 요청이 서로를 밀어내지 않는다 |
| 대기열을 **LIFO**로 처리 | 〃 | 빠르게 내리면 지나간 카드보다 **지금 보이는 카드**가 먼저 뜬다 |
| `priority: 'high'` (상세·전체화면 뷰어) | 〃 + `RemoteImage` | 보고 있는 사진이 목록 썸네일에 밀리지 않는다 |
| 목록 교체 시 대기 중 요청 폐기 | `dropPendingThumbnails()` | 검색어를 바꾸면 옛 요청이 새 결과를 막지 않는다 |
| 변환된 URL은 **첫 렌더에 바로** 사용 | `RemoteImage` | 되돌아왔을 때 깜빡임이 없다 |
| 상세 캐러셀 **순차 로딩** | `ConceptDetailScreen` | 앞 2장만 먼저, 한 장 뜰 때마다 한 장씩 |
| 렌더 예산 축소 (10/10/7 → 6/4/5) | `ConceptListScreen` | 한 번에 만드는 카드 수를 줄여 스크롤이 부드러워진다 |
| `fadeDuration={0}` | `RemoteImage` | 안드로이드 기본 페이드가 목록에서 잔상처럼 보였다 |

⚠️ 이건 **왕복 횟수와 바이트를 줄이는 게 아니라 순서를 정리하는** 최적화다.
   사진이 여전히 원본이라는 사실은 그대로다.

---

## 3. 🎯 근본 해결 — **썸네일을 따로 만든다**

### ✅ 앱 코드는 이미 준비됐다 (2026-08-25)
`resolveThumbnailUrl()` 이 축소본을 먼저 찾고, **없으면 자동으로 원본으로 되돌아간다.**
그래서 익스텐션을 아직 설치하지 않아도 앱은 지금과 똑같이 동작한다.

⚠️ 없는 파일을 매번 물어보면 왕복만 늘어 오히려 느려지므로,
   **처음 4번 연속 실패하면 그 실행 동안은 축소본을 시도하지 않는다.**
   설치·백필한 뒤 앱을 다시 켜면 첫 성공과 함께 자동으로 켜진다 —
   **앱 재배포나 설정 변경이 필요 없다.**

썸네일을 쓰는 곳: `ConceptCard`(목록), `RouteDetailSheet`(지도 마커 카드).
상세·전체화면 뷰어는 확대해서 보는 곳이라 **원본 그대로** 쓴다.

---

## 3-1. 썸네일 생성 함수 (직접 작성 — 익스텐션 대신)

### ⚠️ 왜 Firebase Extensions 를 안 쓰나
콘솔 공지: **Firebase Extensions 는 2027-03-31 종료.** 그 이후에는 설치·수정이 불가능하다.
지금 설치해도 나중에 다시 옮겨야 한다. 이 저장소에는 이미 `functions/` 가 있으므로
**직접 만든다** — 종료 리스크가 없고 경로·크기·건너뛰기 규칙을 정확히 통제할 수 있다.

`functions/index.js` 의 **`generateThumbnail`** (2026-08-25 추가).

### 규약 — 앱과 반드시 일치해야 한다
```
원본    route_images/북한산/인수봉/서면슬랩/photo.jpg
썸네일  route_images/북한산/인수봉/서면슬랩/photo_400x400.jpg
```
· **같은 폴더** · **확장자 유지** · 접미사 **`_400x400`**
셋 중 하나만 어긋나도 앱이 못 찾고 원본으로 되돌아간다(동작은 하지만 느린 채로).

### 안전장치
| 항목 | 내용 |
|---|---|
| 무한 루프 | 이름(`_400x400`)과 메타데이터(`resizedImage`) **두 겹**으로 차단 |
| 중복 생성 | 이미 있으면 건너뛴다 → **백필을 여러 번 돌려도 안전** |
| 실패 처리 | 로그만 남기고 끝낸다. 업로드 자체를 막지 않는다 |
| 대상 경로 | `route_images/`, `pitch_images/` 만. 프로필 사진은 건드리지 않는다 |
| 원본 | **지우지 않는다.** 상세·전체화면이 원본을 쓴다 |

### ① 배포
```bash
cd /Users/yusungyun/StudioProjects/routefinding/functions
npm install                     # sharp 설치
cd /Users/yusungyun/StudioProjects/routefinding
unset FIREBASE_TOKEN
firebase deploy --only functions:generateThumbnail \
  --project routefinding09-4b597 \
  --account routefinding2025@gmail.com
```
⚠️ **리전은 버킷과 같아야 한다.** 이 프로젝트 버킷은 `US-CENTRAL1` 이라
   `region: "us-central1"` 그대로 맞다 (콘솔 ▸ Storage ▸ 버킷 선택기에서 확인).

### ⚠️ 첫 배포에서 실패한다 — IAM 전파 문제 (2026-08-27 실측)
2세대 Storage 트리거를 **처음** 만들 때 이 오류가 난다:
```
HTTP Error: 403, Validation failed for trigger ...
Permission "storage.buckets.get" denied on "Bucket ... could not be validated.
Please verify that the bucket exists and that the Eventarc service account has permission."
```

원인은 권한 설정이 틀린 게 아니라 **타이밍**이다. 같은 배포 로그 앞부분에
```
i  functions: generating the service identity for pubsub.googleapis.com...
i  functions: generating the service identity for eventarc.googleapis.com...
```
가 찍힌다 — 서비스 계정이 **그 배포 중에 방금 만들어졌고**, 권한이 전파되기 전에
트리거를 만들려다 막힌 것이다.

→ **3~5분 기다렸다가 같은 명령을 다시 실행하면 된다.** 실제로 그렇게 통과했다.

그래도 실패하면 (Eventarc 는 Pub/Sub 을 전송 계층으로 쓴다):
```bash
SA=$(gcloud storage service-agent --project=routefinding09-4b597)
gcloud projects add-iam-policy-binding routefinding09-4b597 \
  --member="serviceAccount:${SA}" --role="roles/pubsub.publisher"
```

여전히 `storage.buckets.get` 이면:
```bash
NUM=$(gcloud projects describe routefinding09-4b597 --format='value(projectNumber)')
gcloud projects add-iam-policy-binding routefinding09-4b597 \
  --member="serviceAccount:service-${NUM}@gcp-sa-eventarc.iam.gserviceaccount.com" \
  --role="roles/storage.legacyBucketReader"
```

최후 수단: **1세대 트리거**(`functions.storage.object().onFinalize`)로 바꾸면
Eventarc 를 아예 쓰지 않아 이 문제가 없다. 나머지 함수 6개도 전부 1세대다.

### ⚠️ Node 20 은 2026-10-30 에 종료된다
배포 로그 경고: *"Runtime Node.js 20 ... will be decommissioned on 2026-10-30,
after which you will not be able to deploy"*.
`functions/package.json` 의 `"engines": {"node": "20"}` 을 **22** 로 올려야
그 뒤에도 배포할 수 있다. 급한 수정이 필요할 때 배포가 막히면 곤란하다.

### ✅ 실측 결과 (2026-08-28)
`route_images/무의도/하나개 암장/테스트/` 에 사진 한 장을 올려 확인:

| 파일 | 크기 |
|---|---|
| `root_1.jpg` (원본) | **938.24 KB** |
| `root_1_400x400.jpg` (썸네일) | **40.45 KB** |

**23배 감소.** 같은 폴더·확장자 유지·`_400x400` 접미사 모두 앱 규약과 일치.

### ② 동작 확인 (백필 전에)
앱에서 개념도 사진을 **한 장 새로 등록**해 보고,
Storage 같은 폴더에 `_400x400` 파일이 생기는지 본다.
안 생기면 로그를 본다:
```bash
firebase functions:log --only generateThumbnail \
  --project routefinding09-4b597 --account routefinding2025@gmail.com
```
⚠️ `Failed to list log entries` 가 나오면 CLI 문제다(로그 조회 권한 또는 낡은 버전).
   Cloud Console ▸ Logging 에서 보면 된다. 썸네일 파일이 실제로 생겼다면 함수는 정상이다.

### ③ 기존 사진 백필
함수는 **새로 올라오는 파일만** 처리한다. 기존 5,400여 건은 한 번 훑어야 한다.
객체를 자기 자신으로 다시 써서 업로드 트리거를 발생시킨다:

⚠️ **먼저 계정을 확인할 것.** 이 개발 환경은 CLI 기본 계정이 계속 어긋난다
   (Firebase CLI = `gangtalk815@gmail.com`, gcloud = `smbsh2017@gmail.com` 로 설정돼 있었다).
   프로젝트 소유자는 **`routefinding2025@gmail.com`** 이다.

```bash
gcloud auth login                                   # 브라우저에서 routefinding2025@gmail.com
gcloud config set account routefinding2025@gmail.com
gcloud config set project routefinding09-4b597
gcloud auth list                                    # * 가 맞는 계정에 붙었는지 확인
gcloud storage ls gs://routefinding09-4b597.firebasestorage.app/route_images/ | head
```
⚠️ 위 명령들을 **주석(`#`)과 같은 줄에 붙여 붙여넣지 말 것.**
   셸 설정에 따라 주석이 인자로 넘어가 `unrecognized arguments` 로 실패한다.

```bash
# ⚠️ 먼저 작은 폴더 하나로 시험
gsutil -m rewrite -r -s standard \
  gs://routefinding09-4b597.firebasestorage.app/route_images/무의도/

# _400x400 이 생긴 것을 확인한 뒤 전체
gsutil -m rewrite -r -s standard \
  gs://routefinding09-4b597.firebasestorage.app/route_images/
gsutil -m rewrite -r -s standard \
  gs://routefinding09-4b597.firebasestorage.app/pitch_images/
```

`gsutil` 이 없는 최신 gcloud 라면 같은 효과의 대체 명령:
```bash
gcloud storage objects update --recursive --storage-class=STANDARD \
  gs://routefinding09-4b597.firebasestorage.app/route_images/
```
- `-m` 병렬 · `-r` 하위 전체 · `-s standard` 스토리지 클래스를 다시 써 새 세대를 만든다
- 함수가 만든 `_400x400` 파일은 메타데이터로 걸러지므로 재귀 처리되지 않는다

### ✅ 백필 실측 (2026-08-28)
| | |
|---|---|
| `route_images/` 이미지 | **4,871장** |
| 썸네일 생성 | **4,862장** (99.8%) — 남은 9장은 손상/비이미지 추정 |
| 늘어난 객체 수 | 8,635 → 9,733 (백필 중 측정) |
| 크기 예시 | 938 KB → **40 KB** (23배) |

`gcloud storage objects update --recursive --storage-class=STANDARD` 로 rewrite 를 걸면
명령은 **금방 끝나지만 썸네일 생성은 함수가 뒤이어** 처리한다.
명령 종료 ≠ 완료. `--dry` 로 남은 수를 세어 0 에 가까워지는지 확인할 것.

남은 것이 있으면 `node scripts/backfillThumbnails.js route_images/` 로
**빠진 것만** 다시 요청한다. 반복해도 안전하다(있으면 건너뛴다).

### ④ 비용·시간
- 5,400장 × 평균 3MB 를 함수가 다운로드·리사이즈·업로드한다.
  Blaze 요금으로 **수 달러 수준**, **수십 분~한두 시간**
- 저장 용량은 5,400 × ~40KB ≈ **220MB** 증가 (무시할 수준)
- 진행 중 `firebase functions:log` 로 실패 건을 확인할 것

### ⑤ 앱에서 확인
1. Storage 에서 `_400x400` 파일 존재 확인
2. 앱을 **완전히 종료 후 재실행** (썸네일 사용 여부를 실행 시점에 판단한다)
3. 목록 스크롤 속도 확인

---

## 4. 검토했다가 **안 한 것**

| 방법 | 왜 안 했나 |
|---|---|
| 토큰 없는 `firebasestorage.googleapis.com/...?alt=media` 직접 조립 | Storage 규칙이 `allow read: if request.auth != null` 이라 토큰 없이는 못 읽는다. `<Image>` 는 인증 헤더를 못 붙인다 |
| 다운로드 URL을 디스크에 영구 캐시 | AsyncStorage·react-native-fs 둘 다 미설치. **네이티브 의존성을 늘리지 않기로** 한 결정(2026-08-17)에 걸린다 |
| `react-native-fast-image` | 같은 이유. 게다가 원본 크기 문제는 그대로 남는다 |
| 변환된 URL을 Firestore 문서에 저장 | 5,400건 일괄 갱신이 필요하고, 토큰이 바뀌면 다시 틀어진다 |
