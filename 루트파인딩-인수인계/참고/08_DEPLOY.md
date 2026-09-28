# 🚀 08_DEPLOY.md — 배포 가이드

> 작성일: 2026-08-04
> 결론 요약: **웹은 지금 배포 가능. 안드로이드·iOS는 아직 배포할 수 없다.**

---

## 1. 웹 — ✅ 지금 배포 가능

Firebase Hosting. 프로젝트 `routefinding09-4b597`, 산출물 `dist/`.

```bash
cd ~/routefinding-web

# 1) 배포 대상 프로젝트 확인 (프로젝트가 두 개라 반드시 확인)
firebase use routefinding09-4b597

# 2) 빌드
npm run build

# 3) 배포 — 호스팅만
firebase deploy --only hosting
```

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
| 지도 | ⛔ `MapScreen.tsx` = 플레이스홀더. 지도 SDK 미결정 (`[TBD] Google Maps vs Kakao Map`) |
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

### 2-5. 출시 전 체크리스트
- [ ] `versionCode` > 스토어 최신값
- [ ] release 서명 키 = v1과 동일
- [ ] App Check를 `playIntegrity`로 (현재 `__DEV__` 분기는 이미 되어 있음)
- [ ] Firestore/Storage 규칙 배포 완료
- [ ] 실기기에서 로그인 → 4탭 전부 동작 확인
- [ ] 개인정보 처리방침 URL (Play Console 필수)

---

## 3. iOS — ⛔ 빌드 자체가 안 됨

`docs/06_iOS_BUILD_NOTES.md` 참조. 요약:

- Xcode 26.x와 firebase-ios-sdk가 끌어오는 gRPC-C++ 가 충돌해 **빌드 실패** 상태(보류 트랙)
- 단, **재시도 트리거는 충족됐다**: RNFB 24.0.0 → 최신 **26.1.0**(2026-08-03)

재개 순서:
```bash
cd ~/StudioProjects/routefinding/app
corepack yarn up '@react-native-firebase/*'    # 24 → 26 (메이저 2단계, breaking change 확인 필수)
# Podfile의 gRPC post_install 패치를 주석 처리한 뒤
cd ios && pod install && cd ..
yarn ios
```

빌드가 되면 그다음:
- [ ] `pod install` 재실행 (2026-08-04에 추가된 `react-native-image-picker`)
- [ ] 프로필 사진 업로드 실기기 검증 (`putFile`의 URI 형식)
- [ ] Info.plist 권한 문구는 채워둠 ✅
- [ ] Apple Developer 계정 / 인증서 / 프로비저닝 프로파일
- [ ] App Store Connect 앱 등록 (번들 ID `com.yusungyun.RouteFinding`)

---

## 4. 권장 순서

```
① 웹 배포                          ← 지금 가능
② 앱 지도 SDK 결정 (Google/Kakao)
③ 앱 지도 탭 + 루트제보 작성 화면 구현
④ 앱 개념도 사진/라인 그리기 이식
⑤ v1 서명 키 확보 + 버전 정리
⑥ 안드로이드 내부 테스트 배포
⑦ RNFB 26 업그레이드 → iOS 빌드 복구
⑧ iOS TestFlight
⑨ 양 플랫폼 정식 출시
```

**웹을 먼저 배포해도 안전하다.** 앱(v1)과 데이터를 공유하지만 이번 리뉴얼에서
Firestore 스키마를 바꾸지 않았고, 새로 추가한 것(`climbing_logs`, `concept_photos`)은
v1이 읽지 않는 별도 컬렉션이다.
