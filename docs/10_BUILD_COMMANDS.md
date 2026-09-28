# 🔨 10_BUILD_COMMANDS.md — 빌드 명령 모음

> 수정 작업이 끝날 때마다 이 명령들로 빌드한다.
> 경로 기준: `/Volumes/Dev/StudioProjects/routefinding/app`

---

## 0. 현재 버전 관리 방식

저장소에 적힌 값은 언제나 **다음에 낼 버전**이다. 출시가 끝나면 곧바로 올려 둔다
(규칙 전문은 `CLAUDE.md` ▸ '출시 버전 규칙').

| | 지금 값 (= 다음 출시) | 어디서 |
|---|---|---|
| Android `versionCode` | **111** (기본값, `-P`로 덮어쓰기 가능) | `android/app/build.gradle` |
| Android `versionName` | `-P` 없으면 **`app/package.json`의 `version`** = **2.0.9** | 위와 같음 |
| iOS `MARKETING_VERSION` | **2.0.9** | Xcode 또는 `project.pbxproj` (**2곳**) |
| iOS `CURRENT_PROJECT_VERSION` | **12** (빌드 번호) | 위와 같음 (**2곳**) |

값이 이미 맞춰져 있으므로 **옵션 없이 그냥 빌드하면 된다.**

⚠️ 스토어에 올릴 때는 **이전보다 큰 값**이어야 한다.
App Store는 `CURRENT_PROJECT_VERSION`, Play는 `versionCode`를 본다. 한 번 올라간 값은 못 내린다.

### 출시 이력
| 날짜 | Play (code / name) | App Store (name / build) |
|---|---|---|
| 2026-08-28 | — | 2.0.4 / 7 |
| 2026-08-29 | 106 / **2.0.4** | **2.0.5** / 8 |
| 2026-08-31 | 107 / 2.0.6 | 2.0.6 / 9 |
| 2026-08-31 (소진) | 108 · 109 / 2.0.7 | 2.0.6 / 9, 2.0.7 / 10 · 11 |
| 2026-09-01 **출시** | 110 / **2.0.8** | **2.0.8** / 11 |

⚠️ **스토어 최신은 Play 2.0.4(106) / App Store 2.0.5(8)**. 2.0.6·2.0.7 은 나가지 않았다.

⚠️ 08-29 에 표시 버전이 어긋났었다 — Android 를 `package.json` 을 올리기 **전에** 빌드했다.
2.0.6 에서 다시 맞췄다. **버전을 먼저 올리고 빌드한다.**

---

## 1. 개발 중 실기기 확인

```bash
cd /Volumes/Dev/StudioProjects/routefinding/app

# 터미널 A — Metro (코드 고친 뒤엔 --reset-cache 권장)
yarn start --reset-cache

# 터미널 B
yarn android                 # 연결된 안드로이드 기기/에뮬
yarn ios --device            # 연결된 아이폰
yarn ios --simulator "iPhone 17"
```

Metro가 옛 번들을 물고 있으면 검은 화면이 난다. 그럴 땐:
```bash
lsof -ti:8081 | xargs kill -9 2>/dev/null
```

---

## 2. 안드로이드 — APK (사이드로딩 / 테스터 전달)

JS 번들이 안에 포함돼 **Metro 없이 단독 실행**된다.

```bash
cd /Volumes/Dev/StudioProjects/routefinding/app/android
./gradlew assembleRelease
# → app/build/outputs/apk/release/app-release.apk

adb install -r app/build/outputs/apk/release/app-release.apk
```

버전을 지정하려면:
```bash
./gradlew assembleRelease \
  -PROUTEFINDING_VERSION_CODE=102 \
  -PROUTEFINDING_VERSION_NAME=2.0.1
```

---

## 3. 안드로이드 — AAB (Play Console 업로드)

```bash
cd /Volumes/Dev/StudioProjects/routefinding/app/android
./gradlew bundleRelease \
  -PROUTEFINDING_VERSION_CODE=102 \
  -PROUTEFINDING_VERSION_NAME=2.0.1
# → app/build/outputs/bundle/release/app-release.aab
```

### 서명 키 (확인 완료 2026-08-12)

업로드 키는 **이미 설정돼 있다.** 빌드된 AAB의 인증서를 직접 확인한 결과
`META-INF/UPLOAD.RSA` / 주체 `yusung yun` — debug 키가 아닌 정식 업로드 키다.

⚠️ 서명 속성은 `android/gradle.properties`가 **아니라 `~/.gradle/gradle.properties`**
(홈 디렉터리)에 있다. 자격증명을 저장소 밖에 두는 권장 방식이다.
프로젝트 파일만 보고 "키 없음"으로 판단하면 안 된다.

서명 상태를 확인하려면 산출물을 직접 뜯어본다:
```bash
cd /Volumes/Dev/StudioProjects/routefinding/app/android
unzip -p app/build/outputs/bundle/release/app-release.aab META-INF/UPLOAD.RSA \
  | strings | head
# 'Android Debug' 가 보이면 debug 서명, 이름이 보이면 정식 업로드 키
```

---

## 4. iOS — Xcode (실기기 / App Store 제출)

```bash
cd /Volumes/Dev/StudioProjects/routefinding/app/ios && pod install && cd ..
open ios/RouteFinding.xcworkspace
```
⚠️ `.xcodeproj`가 아니라 **`.xcworkspace`**.

**실기기 실행**
1. 상단에서 연결한 아이폰 선택
2. Signing & Capabilities → Team 선택 (Bundle ID `com.yusungyun.RouteFinding`)
3. Product → Scheme → Edit Scheme → Run → Build Configuration = **Release**
   (Metro 없이 단독 실행)
4. `⌘R`

**App Store 제출**
1. 상단 기기를 **Any iOS Device (arm64)** 로
2. 빌드 번호 올리기 — 타깃 → General → Build (`CURRENT_PROJECT_VERSION`)
3. **Product → Archive**
4. Organizer → **Distribute App** → App Store Connect → Upload

---

## 5. iOS — CLI 아카이브 (선택)

```bash
cd /Volumes/Dev/StudioProjects/routefinding/app/ios

xcodebuild -workspace RouteFinding.xcworkspace \
  -scheme RouteFinding \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath build/RouteFinding.xcarchive \
  archive

xcodebuild -exportArchive \
  -archivePath build/RouteFinding.xcarchive \
  -exportOptionsPlist ExportOptions.plist \
  -exportPath build/ipa
```
`ExportOptions.plist`는 최초 1회 Xcode Organizer에서 내보낼 때 생성되는 것을 재사용한다.

---

## 6. 클린 빌드 (이상 동작 시)

```bash
cd /Volumes/Dev/StudioProjects/routefinding/app

# 안드로이드
cd android && ./gradlew clean && cd ..

# iOS — 링크 방식이나 의존성이 바뀌었을 때
cd ios && rm -rf Pods Podfile.lock build && pod install && cd ..
rm -rf ~/Library/Developer/Xcode/DerivedData/RouteFinding-*

# JS
yarn start --reset-cache
```

---

## 7. 웹 (참고)

```bash
cd /Volumes/Dev/routefinding-web
unset FIREBASE_TOKEN
npm run build
firebase deploy --only hosting \
  --project routefinding09-4b597 \
  --account routefinding2025@gmail.com
```
