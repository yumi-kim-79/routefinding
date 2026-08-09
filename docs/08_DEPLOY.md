# 🚀 08_DEPLOY.md — 배포 가이드

> 작성일: 2026-08-04 (최종 갱신 2026-08-04 후속 세션)
> 결론 요약: **웹은 지금 배포 가능. 안드로이드·iOS는 아직 배포할 수 없다.**

---

## 1. 웹 — ✅ 지금 배포 가능

Firebase Hosting. 프로젝트 `routefinding09-4b597`, 산출물 `dist/`.

```bash
cd ~/routefinding-web

# 0) ⚠️ 계정 함정 — 셸에 FIREBASE_TOKEN이 설정돼 있으면 로그인 계정을 덮어써서
#    "프로젝트 없음" 에러가 난다. CLI 기본 로그인(gangtalk815@)이 아니라
#    프로젝트 소유자(routefinding2025@)로 배포해야 한다.
unset FIREBASE_TOKEN

# 1) 배포 대상 프로젝트 확인 (프로젝트가 두 개라 반드시 확인)
firebase use routefinding09-4b597

# 2) 빌드
npm run build

# 3) 배포 — 호스팅만 (--account 명시 권장)
firebase deploy --only hosting \
  --project routefinding09-4b597 \
  --account routefinding2025@gmail.com
```

> ✅ 2026-08-04 배포 완료: https://routefinding09-4b597.web.app (커스텀 도메인 `routefinding.kr`)

### 배포 전 확인
- [ ] `npm run build` 가 에러 없이 끝나는가 (vite 빌드 실패 시 배포 중단할 것)
- [ ] `firebase use` 가 `routefinding09-4b597` 인가
- [ ] Firestore 규칙은 이미 배포됨(2026-08-04). 규칙을 또 고쳤다면 `--only firestore:rules` 도 함께

### 배포 후 확인 (실사용 경로)
1. 로그인 → 지도 탭이 첫 화면으로 뜨는가
2. 개념도 검색 → 결과·이미지
3. 개념도 📷 → 사진 등록 → 라인 그리기 → 저장
4. 마이페이지 → 제보 관리에서 승인 · 추가 / 교체
5. 마이페이지 → 등반일지 작성
6. 루트제보 → 현재위치 / 지도에서 선택

### 롤백
```bash
firebase hosting:versions:list          # 이전 버전 확인
firebase hosting:rollback               # 직전 버전으로
```

> ⚠️ `routefinding-web`은 **git 저장소가 아니다.** 배포 후 문제가 생겨도 코드를 되돌릴 수단이
> Hosting 롤백뿐이다. git 초기화를 권한다 (`git init && git add -A && git commit`).

---

## 2. 안드로이드 — ⛔ 아직 배포 불가

막는 것이 세 가지다. 순서대로 해결해야 한다.

### 2-1. 🚨 기능이 절반만 완성됨

4탭 중 **2개가 빈 화면(PlaceholderScreen)** 이다.

| 탭 | 상태 |
|---|---|
| 지도 | ⛔ `MapScreen.tsx` = 플레이스홀더. **지도 SDK는 Google Maps(`react-native-maps`)로 결정**(2026-08-04) — 아직 미도입 |
| 개념도 | ✅ 검색·목록·상세·뷰어 완성 |
| 루트제보 | ⛔ `ReportListScreen.tsx` = 플레이스홀더. 제보 **작성 화면 자체가 없음** |
| 마이페이지 | ✅ 제보관리·등반일지·프로필(사진 변경 포함) 완성 |

웹에만 있고 앱에 없는 기능:
- 개념도 사진 등록 + 라인 그리기 (`concept_photos`)
- 루트제보 작성 (위도/경도 입력 포함)
- 관리자 승인 흐름

### 2-1-1. ✅ 기능 완성 (2026-08-05)
2-1의 빈 화면들은 모두 채워졌다 — 지도 · 루트제보 작성 · 개념도 사진/라인 · 관리자 승인 흐름 · GPX 접근로 · AdMob 배너.
남은 배포 차단 요소는 **서명 키(2-2)와 versionCode(2-3)** 둘뿐이다.

### 2-2. 🚨 서명 키가 없다 — **가장 위험한 항목**

현재 `android/app/build.gradle`:
```gradle
buildTypes {
    release {
        signingConfig signingConfigs.debug   // ← debug 키로 서명 중
    }
}
```
`app/debug.keystore` 만 있고 **release keystore가 없다.** debug 서명 AAB는 Play Console이 거부한다.

**핵심**: v1(`v1.2.3`, 빌드 39)이 이미 스토어에 있고 패키지명이 같다
(`com.yusung.routefinding`). 업데이트로 올리려면 **v1과 동일한 키로 서명**해야 한다.
키가 다르면 Play Console이 업로드를 거부하고, 되돌릴 방법이 없다.

- [ ] **v1 업로드 키(.jks/.keystore)를 찾을 것** — 이게 최우선
- [ ] Play Console → 설정 → 앱 서명에서 **Play 앱 서명이 켜져 있는지** 확인.
      켜져 있으면 업로드 키 분실 시 재설정 요청이 가능하다. 꺼져 있는데 키를 잃었다면
      **같은 패키지명으로는 영영 업데이트할 수 없다** (새 앱으로 올려야 함)

#### 키를 찾은 뒤 — **gradle 쪽 작업은 이미 끝나 있다** (2026-08-05)
`app/build.gradle`에 release 서명 블록을 넣어 두었다. **값만 채우면 된다.**
비밀번호는 저장소가 아니라 **홈 디렉터리**에 적는다 (git에 들어갈 일이 없다):

```properties
# ~/.gradle/gradle.properties   ← 저장소 밖!
ROUTEFINDING_UPLOAD_STORE_FILE=/Users/yusungyun/keys/routefinding-upload.jks
ROUTEFINDING_UPLOAD_KEY_ALIAS=upload
ROUTEFINDING_UPLOAD_STORE_PASSWORD=***
ROUTEFINDING_UPLOAD_KEY_PASSWORD=***
```

값이 없으면 release 빌드는 **debug 키로 서명되고 경고를 찍는다**:
`⚠️ 출시 서명 키가 없어 debug 키로 서명합니다 — Play Console에 올릴 수 없습니다.`
실기기 확인용으로는 쓸 수 있지만 **Play에는 못 올린다.**

#### ✅ 확인 완료 (2026-08-05): **Play 앱 서명 켜져 있음**
`앱 무결성 → 앱 서명`에 인증서가 **두 개**(앱 서명 키 / 업로드 키)로 분리돼 있다.
→ 업로드 키를 잃어도 **재설정 요청으로 복구 가능**하다. 최악(같은 패키지명 영구 불가)은 면했다.

| | SHA-1 |
|---|---|
| **앱 서명 키** (Google이 보관, 사용자 기기에 설치되는 서명) | `3C:79:9A:EC:35:87:C5:98:AC:04:67:DA:AE:17:8D:93:57:AB:6C:9D` |
| **업로드 키** (우리가 서명해서 올릴 때 쓰는 키) | `C4:29:26:ED:11:3E:9A:CD:A9:29:57:84:66:7B:B6:66:7E:40:6A:F3` |

앱 서명 키 SHA-256:
`B9:89:49:5B:E4:0E:AA:30:13:28:A7:E4:AD:BC:1A:BA:BA:F8:12:57:B9:97:F2:43:21:F3:ED:18:82:0A:90:D7`

#### 키가 어디 있는지 모를 때 — 확인 순서
1. **Play Console → 설정 → 앱 서명**
   - "Play 앱 서명 사용 중"이면 → **업로드 키 재설정 요청이 가능하다.**
     새 키를 만들고 `keytool -export -rfc` 로 인증서를 뽑아 Google에 제출한다(승인까지 며칠).
   - 이 화면 자체가 없으면(구형 앱) → 업로드 키 = 앱 서명 키다. **잃으면 복구 불가**,
     같은 패키지명으로는 영영 업데이트할 수 없다.
2. **맥 안을 뒤진다**: `find ~ -name "*.jks" -o -name "*.keystore" 2>/dev/null`
   Flutter 프로젝트라면 `android/key.properties` 나 `android/app/*.jks` 에 있었을 가능성이 크다.
3. **v1 프로젝트 폴더 / 예전 백업 / 다른 PC**도 확인한다.

### 2-3. ✅ 버전 — 기본값 설정 완료 (2026-08-05)

`versionCode 100` / `versionName "2.0.0"` 이 기본값이다 (v1 빌드 39보다 충분히 크고,
v1 긴급 패치 여지도 남긴다). **Play Console에서 v1의 실제 최신 versionCode를 확인**하고
100보다 크면 아래로 덮어쓴다:

```properties
# ~/.gradle/gradle.properties 또는 CLI
ROUTEFINDING_VERSION_CODE=101
ROUTEFINDING_VERSION_NAME=2.0.1
```
```bash
./gradlew bundleRelease -PROUTEFINDING_VERSION_CODE=101
```

### 2-3-1. ✅ 대상 API 34 → 35 (2026-08-05)

Play는 **2025-08-31부터 대상 API 35 이상**만 받는다. 34로는 업로드 자체가 거부된다.
`android/build.gradle`의 `targetSdkVersion = 35` 로 올렸다 (compileSdk는 이미 35, 툴체인 변경 없음).

⚠️ **Android 15 edge-to-edge 강제**: targetSdk 35 앱은 화면 가장자리까지 그리기가 강제돼
상태바·네비바 아래로 내용이 들어간다. 이번 출시는 "Play가 받아주게 만드는 것"이 목적이라
`styles.xml`에 `android:windowOptOutEdgeToEdgeEnforcement=true` 로 **일단 껐다.**
실기기(Android 15 이상)에서 헤더·하단 탭이 잘리지 않는지 확인할 것.

### 2-5-1. 🚨 **Play 앱 서명 = 앱의 지문이 바뀐다** (2026-08-05 발견)

우리가 업로드 키로 서명해 올리면, **Google이 그걸 벗겨내고 앱 서명 키로 다시 서명해서** 배포한다.
즉 **사용자 기기에 설치되는 앱의 SHA-1은 우리 로컬 키가 아니라 앱 서명 키**다.

`3C:79:9A:EC:35:87:C5:98:AC:04:67:DA:AE:17:8D:93:57:AB:6C:9D`

지문으로 앱을 식별하는 서비스에 **이 값을 등록하지 않으면, 개발 중에는 멀쩡하다가
스토어 버전에서만 조용히 깨진다.** 이 프로젝트에서 해당되는 것:

- [ ] **Google Maps Android API 키** (`AndroidManifest.xml`의 `com.google.android.geo.API_KEY`)
      Google Cloud Console → API 및 서비스 → 사용자 인증 정보 → 해당 키 → **Android 앱 제한**
      → 패키지명 `com.yusung.routefinding` + **SHA-1 `3C:79:...:6C:9D`** 추가.
      ⚠️ 빠뜨리면 **스토어 버전에서 지도가 회색으로만 나온다.** (개발 빌드는 디버그 키라 정상)
- [ ] **Firebase** → 프로젝트 설정 → 내 앱(Android) → **디지털 지문 추가**
      SHA-1 `3C:79:...` + SHA-256 `B9:89:...:90:D7`
      App Check(Play Integrity)와 Auth가 앱을 식별하는 근거다. 빠뜨리면 **스토어 버전에서
      App Check 토큰 발급이 실패**해 Firestore·Storage 접근이 막힐 수 있다.
      추가 후 `google-services.json`을 **다시 받아 교체**할 것.
- [ ] 개발 편의를 위해 **디버그 키 SHA-1도 함께** 등록해 두면 좋다:
      `keytool -list -v -keystore android/app/debug.keystore -alias androiddebugkey -storepass android | grep SHA1`

> 이건 "빌드가 깨지는" 종류가 아니라 **스토어에 올린 뒤에야 드러나는** 문제다.
> 내부 테스트 트랙에 먼저 올려 지도와 로그인을 확인하고 프로덕션으로 승격하는 것을 권한다.

### 2-5-2. 🚨 16KB 메모리 페이지 크기 (2026-08-06 발견)

프로덕션 버전 만들기에서 **오류**로 뜬다: `앱이 16KB 메모리 페이지 크기를 지원하지 않습니다`.

**실측** — AAB 의 `arm64-v8a` 네이티브 라이브러리 15개 중 **14개가 4KB 정렬**이다:
```
libreactnative.so  libhermes.so  libjsi.so  libfbjni.so  libc++_shared.so
libhermestooling.so  libimagepipeline.so  libnative-filters.so
libnative-imagetranscoder.so  libappmodules.so  librnscreens.so
libreact_codegen_{rnscreens,rnsvg,safeareacontext}.so
```

**우리 빌드 설정으로는 못 고친다.** 대부분 React Native 가 배포하는 **미리 빌드된 .so** 다
(`com.facebook.react:react-android:0.76.9` AAR 안에 들어 있다).
→ **React Native 0.77 부터 16KB 를 지원**한다.

확인 방법(다음에 또 볼 때):
```bash
cd /tmp && rm -rf aabx && mkdir aabx && cd aabx
unzip -q <경로>/app-release.aab 'base/lib/arm64-v8a/*'
python3 - <<'EOF'
import glob, struct, os
def align(p):
    d=open(p,'rb').read()
    if d[:4]!=b'\x7fELF' or d[4]!=2: return None
    off,sz,n=struct.unpack_from('<Q',d,0x20)[0],struct.unpack_from('<H',d,0x36)[0],struct.unpack_from('<H',d,0x38)[0]
    return min(struct.unpack_from('<Q',d,off+i*sz+0x30)[0]
               for i in range(n) if struct.unpack_from('<I',d,off+i*sz)[0]==1)
for p in sorted(glob.glob('base/lib/arm64-v8a/*.so')):
    a=align(p)
    print(('✅' if a and a>=16384 else '❌'), os.path.basename(p), a)
EOF
```

**당장은** 콘솔의 `무시하고 계속하기` 로 넘어간다(2026-08-06 기준 우회 버튼이 있다).
**근본 해결은 아래 §2-6 과 같은 작업**이다 — RN 업그레이드 하나로 둘 다 풀린다.

### 2-6. ⏳ 대상 API 36 + 16KB 페이지 — **2026-08-31까지** (별도 작업)

그날 이후 업데이트를 내려면 **API 36**이 필요하다. 지금 못 올린 이유:

| 필요한 것 | 현재 | 필요 |
|---|---|---|
| Gradle | 8.10.2 | 8.11+ |
| AGP | 8.6.0 (RN 0.76.9 기본) | 8.9+ |
| compileSdk | 35 | 36 |
| edge-to-edge | opt-out으로 회피 중 | **opt-out이 무시됨 → 정식 대응 필요** |

**RN 0.77+ 업그레이드 하나로 두 가지가 같이 풀린다:**
- Gradle·AGP·Kotlin 이 함께 올라가 **compileSdk 36** 이 가능해진다
- RN 0.77 부터 **16KB 페이지 크기**를 지원한다 (§2-5-2)

그때 `react-native-google-mobile-ads` 도 15.x 로 같이 올린다(docs/10_ADMOB.md §5).
Kotlin 2.x 가 기본이 되므로 광고 SDK 의 Kotlin 2.1 요구도 자연히 해소된다.

⚠️ 이 저장소의 전례상 **네이티브 의존성 버전이 줄줄이 걸린다.**
   react-native-maps / svg / screens / safe-area-context / view-shot / documents-picker /
   google-mobile-ads 를 한 번에 올려야 할 가능성이 크다. 하루 이상 잡을 것.

### 2-7. Play Console 권장 조치 3건 — **v1 것이다**

콘솔에 뜬 3건은 모두 `출시 이름: RouteFinding v1.2.3` 태그가 붙어 있다. v2에는 해당 없음:

| 경고 | v2 상태 |
|---|---|
| `play-services-safetynet` 심각한 SDK 메모 | ✅ 의존성에 없음. App Check는 **Play Integrity**를 쓴다 (`services/firebase.ts`) |
| 더 넓은 화면이 표시되지 않을 수 있음 | ✅ 매니페스트에 `screenOrientation` 고정 없음 |
| 더 넓은 화면용 지원 중단 API 사용 | ✅ v1(Flutter) 코드 문제 |

**v2를 올리면 셋 다 자연히 사라진다.**

### 2-4. 빌드 명령

```bash
cd ~/StudioProjects/routefinding/app
corepack yarn install

cd android
./gradlew clean

# Play Store 업로드용 AAB  ← 서명 키가 설정돼 있어야 의미가 있다
./gradlew bundleRelease
# 산출물: android/app/build/outputs/bundle/release/app-release.aab

# 실기기 확인용 APK (서명 키 없어도 됨)
./gradlew assembleRelease
# 산출물: android/app/build/outputs/apk/release/app-release.apk
```

**업로드 전 확인** — debug 키로 서명된 AAB는 Play가 거부한다. 서명 주체를 직접 본다:
```bash
keytool -printcert -jarfile app/build/outputs/bundle/release/app-release.aab | head -20
```
`CN=Android Debug` 가 보이면 **아직 debug 키다.** §2-2를 먼저 해결할 것.

### 2-4-1. ⚡ APK 크기 최적화 (2026-08-05 적용)

**실측 — 최적화 전 release APK 59MB의 구성**

| 항목 | 크기 | 비고 |
|---|---|---|
| `lib/` (네이티브) | 58.0MB | 이 중 **x86 16.2 + x86_64 15.6 = 31.8MB가 에뮬레이터 전용** |
| `classes*.dex` | 9.1MB | 코드 축소를 끄고 있었다 |
| `assets/` (JS 번들) | 0.9MB | 문제 없음 |
| `res/` | 0.4MB | 문제 없음 |

**적용한 것**

1. **ABI 필터** — release는 `arm64-v8a` + `armeabi-v7a`만 담는다.
   x86 계열은 실기기에서 한 번도 쓰이지 않는다. **debug는 그대로**라 에뮬레이터 개발에 지장 없다
   (Apple Silicon 맥의 에뮬레이터는 arm64라 release도 그대로 돈다.
   Intel 맥 에뮬레이터에서 release를 돌려야 하면 `x86_64`를 다시 추가할 것)
2. **R8 코드 축소 + 리소스 축소** — `enableProguardInReleaseBuilds = true`.
   리플렉션을 쓰는 것들(RN JNI, Firebase, 네이티브 모듈 6개)은 `proguard-rules.pro`에 keep 규칙을 뒀다

**되돌리기** — 문제가 생기면 `android/app/build.gradle`의
`enableProguardInReleaseBuilds`를 `false`로 바꾸면 코드 축소만 즉시 꺼진다.
증상은 보통 "특정 화면만 죽는다"로 나타난다.

**검증 방법** — 빌드 후 크기와 구성을 직접 확인:
```bash
ls -lh app/build/outputs/apk/release/app-release.apk
unzip -l app/build/outputs/apk/release/app-release.apk | grep "lib/" | awk '{print $4}' | cut -d/ -f2 | sort -u
```

### 2-5. 출시 전 체크리스트
- [ ] `versionCode` > 스토어 최신값
- [ ] release 서명 키 = v1과 동일
- [ ] App Check를 `playIntegrity`로 (현재 `__DEV__` 분기는 이미 되어 있음)
- [ ] Firestore/Storage 규칙 배포 완료
- [ ] 실기기에서 로그인 → 4탭 전부 동작 확인
- [ ] 개인정보 처리방침 URL (Play Console 필수)
- [ ] 🗺️ **release 서명 키의 SHA-1을 `Maps Android (routefinding v2)` 키 제한에 추가**
      (지금은 debug 키 SHA-1만 등록돼 있어, release 서명으로 바꾸면 지도가 회색으로 뜬다)

---

## 3. iOS — ✅ 실기기 빌드 성공 (2026-08-04)

> **2026-08-04 갱신.** 이 문서의 이전 판은 "RNFB 26으로 올려라"라고 적혀 있었으나
> **그 지침은 폐기됐다.** v26은 New Architecture가 필수라 RN 0.76.9에서 쓸 수 없다.
> 최종 결정은 **25.1.0** — 근거는 `docs/09_RNFB_UPGRADE.md`.

`docs/06_iOS_BUILD_NOTES.md` 참조. 현황 요약:

- `@react-native-firebase/*` **25.1.0** 적용 완료 (firebase-ios-sdk **12.15.0**)
- 빌드 실패의 진짜 원인은 Xcode 26이 아니라 **`use_modular_headers!`** 였다.
  RNFB 공식 권장인 **static framework 링크**로 전환하고 gRPC 패치를 모두 제거 → **`pod install` 통과** ✅
- ✅ **Xcode 실기기 빌드 성공** (2026-08-04). 번들 ID를 `com.yusung.routefinding`으로 바꾸고
  Firebase에 iOS 앱을 신규 등록한 뒤 통과. 상세는 `06_iOS_BUILD_NOTES.md` §2 (8~10차)
- ⚠️ 번들 ID가 **`com.yusungyun.RouteFinding` → `com.yusung.routefinding`으로 변경**됐다.
  v1 iOS는 App Store 미출시라 잃을 사용자가 없고, 안드로이드 `applicationId`와 통일됐다.

### 3-1. 빌드 방법 (재현용)

```bash
open ~/StudioProjects/routefinding/app/ios/RouteFinding.xcworkspace
```
- ⚠️ `.xcodeproj`가 아니라 **`.xcworkspace`** (CocoaPods 프로젝트)
- Signing & Capabilities → Automatically manage signing → **Team 선택**
- 번들 ID `com.yusungyun.RouteFinding`
- **Product → Scheme → Edit Scheme → Run → Build Configuration = `Release`**
  (Metro 없이 실기기 단독 실행)
- `⌘R`

**빌드가 깨지면 임의 패치를 덧붙이지 말 것**(CLAUDE.md). 에러 원문을
`docs/06_iOS_BUILD_NOTES.md` §2 표에 누적 기록하고 보고한다.
`use_frameworks!`는 *모든* pod의 링크 방식을 바꾸므로
`react-native-screens` / `react-native-image-picker` / `safe-area-context`에서
새 에러가 나올 수 있다.

### 3-2. 빌드가 되면 그다음

- [ ] 프로필 사진 업로드 실기기 검증 (`services/profilePhoto.ts`의 `putFile`이 받는 URI 형식)
- [ ] 로그인 → Auth · Firestore · App Check 동작 1회 검증
- [ ] `06_iOS_BUILD_NOTES.md` §0-1의 iOS 전용 체크리스트 소진
      (키보드 회피, 전체화면 뷰어 회전, 등반일지 날짜 입력감)
- [ ] Info.plist 권한 문구는 채워둠 ✅ (카메라 촬영을 쓰게 되면 `NSCameraUsageDescription` 추가 필요)
- [ ] Apple Developer 계정 / 인증서 / 프로비저닝 프로파일
- [ ] App Store Connect 앱 등록 (번들 ID **`com.yusung.routefinding`**)

### 3-2-1. 📢 App Store 배포 시 **광고 때문에 반드시 챙길 것** (2026-08-05 추가)

> 사용자 요청: "iOS 실제 배포할 때 따로 알려달라". 잊지 않도록 여기 남긴다.
> AdMob 연동 자체는 끝났고 실기기에서 광고 노출까지 확인됐다(docs/10_ADMOB.md).

- [ ] **`FORCE_TEST_ADS`를 `false`로** — `app/src/constants/ads.ts`.
      지금은 연동 검증용으로 `true`라 **테스트 광고만 나가고 수익이 0이다.**
      이걸 안 되돌리면 배포해도 한 푼도 안 벌린다. **가장 놓치기 쉬운 항목.**
- [ ] **AdMob 앱을 App Store 앱과 연결** — AdMob → 앱 → 앱 설정 → '앱 스토어에 등록됨'.
      지금은 미등록 상태라 광고 채워지는 양이 제한된다. 출시 후 연결해야 정상화된다.
- [ ] **App Store Connect 앱 개인정보 설문**에 광고 항목을 답해야 심사를 통과한다.
      AdMob은 기기 식별자·사용 데이터를 수집한다 → "제3자 광고" 관련 항목 체크.
      (문항은 애플이 자주 바꾸므로 그때 화면을 보고 판단할 것)
- [ ] **ATT(App Tracking Transparency) 결정** — 지금은 **요청하지 않는다**.
      그래서 iOS는 비개인화 광고로 나가고 단가가 낮다.
      넣기로 하면 `NSUserTrackingUsageDescription` 문구 + 첫 실행 팝업 + 심사 설명이 필요하다.
      **넣지 않아도 심사에는 문제없다.** 수익을 올리고 싶을 때 별도 작업으로 진행.
- [ ] **SKAdNetwork 항목(Info.plist)** — 광고 노출에는 필요 없고 전환 추적용이다.
      광고를 **집행**할 때(우리가 광고주가 될 때) 의미가 생긴다. 지금은 생략해도 된다.
- [ ] 심사 리뷰어가 보는 화면에 광고가 겹쳐 조작을 막지 않는지 확인
      (배너는 하단 탭 위에 두었으므로 문제없을 것)

### 3-2-2. ✅ 수출 규정 준수 — Info.plist 로 해결 (2026-08-06)

업로드할 때마다 App Store Connect 가 **'앱 암호화 문서'** 팝업을 띄우고,
답하기 전까지 **빌드가 TestFlight 에 나타나지 않는다**(목록에 '규정 준수 문서 누락'으로 뜬다).

`Info.plist` 에 아래를 넣어 매번 묻지 않게 했다:
```xml
<key>ITSAppUsesNonExemptEncryption</key>
<false/>
```

근거: 이 앱이 쓰는 암호화는 **HTTPS/TLS 와 로그인 인증뿐**이다. 자체 알고리즘을 만들지 않았고
애플 OS 암호화를 대체할 목적의 것도 없다(Firebase 내부 TLS 도 용도가 같다) → **면제 대상**.
⚠️ 앱에 자체 암호화를 넣게 되면 이 선언을 다시 검토할 것.

**이미 올라간 빌드**는 콘솔에서 한 번 답해줘야 한다:
빌드 목록 → '관리' → **"위에 언급된 알고리즘에 모두 해당하지 않음"** → 저장.

### 3-2-3. TestFlight 내부 테스트 — 심사 없이 바로 된다

내부 테스트는 **App Store 심사를 거치지 않는다.** 순서:
1. 빌드 업로드 → **처리 5~30분** (그동안 목록에 안 보인다)
2. 수출 규정 준수 답변 (§3-2-2) — 이걸 안 하면 계속 안 보인다
3. TestFlight 탭 → **내부 테스팅** → 그룹에 테스터(App Store Connect 사용자) 추가
4. 테스터 폰의 TestFlight 앱에서 설치

'배포(App Store)' 탭의 **'심사에 추가'는 누르지 않아도 된다** — 그건 정식 출시용이다.

### 3-3. 하지 말 것

- ❌ **RNFB 26으로 업그레이드** — New Architecture 필수. RN 업그레이드와 묶어 별도 진행
- ❌ `use_modular_headers!` 복구 — 이게 원인이었다

---

## 4. 권장 순서

```
① 웹 배포                          ← ✅ 완료 (2026-08-04)
② 앱 지도 SDK 결정                  ← ✅ 완료: Google Maps (react-native-maps)
③ iOS Xcode 실기기 빌드 검증        ← ✅ 완료 (2026-08-04)
④ 안드로이드 assembleRelease APK 확인   ← ✅ 완료 (2026-08-04, 59MB)
⑤ 앱 지도 탭 + 루트제보 작성 화면 구현   ← 지금 여기
⑥ 앱 개념도 사진/라인 그리기 이식
⑦ v1 서명 키 확보 + versionCode 정리   ← 가장 위험. Play 앱 서명 켜짐 여부 먼저 확인
⑧ 안드로이드 내부 테스트 배포
⑨ iOS TestFlight
⑩ 양 플랫폼 정식 출시
```

> ③④는 macOS 툴체인(Xcode·CocoaPods·Gradle)이 필요해 **사용자가 직접 실행**해야 한다.
> `react-native-maps` 도입(⑤)은 네이티브 재빌드를 부르므로 **③ 이후에 시작**하는 편이
> 빌드 실패 원인을 분리하기 쉽다.

**웹을 먼저 배포해도 안전하다.** 앱(v1)과 데이터를 공유하지만 이번 리뉴얼에서
Firestore 스키마를 바꾸지 않았고, 새로 추가한 것(`climbing_logs`, `concept_photos`)은
v1이 읽지 않는 별도 컬렉션이다.
