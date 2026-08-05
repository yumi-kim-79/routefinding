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

키를 찾은 뒤 설정:
```properties
# android/gradle.properties  (⚠️ git에 커밋하지 말 것)
ROUTEFINDING_UPLOAD_STORE_FILE=routefinding-upload.jks
ROUTEFINDING_UPLOAD_KEY_ALIAS=upload
ROUTEFINDING_UPLOAD_STORE_PASSWORD=***
ROUTEFINDING_UPLOAD_KEY_PASSWORD=***
```
```gradle
// android/app/build.gradle
signingConfigs {
    release {
        if (project.hasProperty('ROUTEFINDING_UPLOAD_STORE_FILE')) {
            storeFile file(ROUTEFINDING_UPLOAD_STORE_FILE)
            storePassword ROUTEFINDING_UPLOAD_STORE_PASSWORD
            keyAlias ROUTEFINDING_UPLOAD_KEY_ALIAS
            keyPassword ROUTEFINDING_UPLOAD_KEY_PASSWORD
        }
    }
}
buildTypes {
    release {
        signingConfig signingConfigs.release   // debug → release
    }
}
```

### 2-3. 🚨 버전이 v1보다 낮다

```gradle
versionCode 1        // v1은 이미 빌드 39 → Play Console이 거부
versionName "1.0"    // v1이 1.2.3 → 사용자에게 다운그레이드로 보임
```
v1의 실제 최신 빌드 번호를 Play Console에서 확인하고 **그보다 큰 값**으로 올려야 한다.
(예: `versionCode 40`, `versionName "2.0.0"`)
v1 긴급 패치를 낼 여지를 두려면 여유 있게 잡는 편이 낫다 (예: 100).

### 2-4. 빌드 명령 (위 세 가지 해결 후)

```bash
cd ~/StudioProjects/routefinding/app
yarn install
cd android && ./gradlew clean bundleRelease   # AAB (Play Store 업로드용)
# 산출물: android/app/build/outputs/bundle/release/app-release.aab

# 실기기 확인용 APK
./gradlew assembleRelease
```

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
