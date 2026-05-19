# 🚀 GETTING_STARTED.md — 개발 환경 셋업

> RouteFinding v2 (React Native) 개발 환경 셋업 가이드

---

## ✅ 사전 요구사항

### 공통

| 도구 | 버전 | 설치 |
|---|---|---|
| Node.js | **20.x LTS** | https://nodejs.org/ 또는 `nvm install 20` |
| yarn | 최신 | `npm install -g yarn` |
| Git | 최신 | 이미 설치됨 ✅ |
| Firebase CLI | 최신 | `npm install -g firebase-tools` |
| Watchman (macOS) | 최신 | `brew install watchman` |

### iOS (Mac만 가능)

| 도구 | 버전 |
|---|---|
| Xcode | **15+** (App Store) |
| Xcode Command Line Tools | `xcode-select --install` |
| CocoaPods | `sudo gem install cocoapods` 또는 `brew install cocoapods` |
| Ruby | 3.0+ (CocoaPods 의존) |

### Android

| 도구 | 버전 |
|---|---|
| Android Studio | **Hedgehog+** (2023.1+) |
| JDK | 17+ |
| Android SDK | API 34+ |

---

## 📂 저장소 클론 & 브랜치 전환

```bash
# 1. 저장소 클론 (이미 했다면 skip)
git clone https://github.com/yumi-kim-79/routefinding.git
cd routefinding

# 2. v2 브랜치로 전환
git checkout v2

# 3. 최신 가져오기
git pull origin v2
```

---

## 🛠️ RN 앱 셋업

### Step 1: 의존성 설치

```bash
cd app
yarn install
```

### Step 2: iOS 의존성 (Mac만)

```bash
cd ios
pod install
cd ..
```

### Step 3: Firebase 설정

#### Android
- `google-services.json` 파일을 `app/android/app/` 에 복사
  - 💡 이 파일은 `.gitignore` 처리됨. Firebase 콘솔에서 다운로드 필요

#### iOS
- `GoogleService-Info.plist` 파일을 `app/ios/RouteFinding/` 에 복사
  - 💡 이 파일도 `.gitignore` 처리됨

#### Firebase 콘솔
- 프로젝트: `routefinding09-4b597` (기존)
- iOS/Android 앱이 등록되어 있어야 함

### Step 4: 환경 변수

```bash
cd app
cp .env.example .env
# .env 파일에 실제 키 입력
```

```
GOOGLE_MAPS_API_KEY=AIza...
ADMOB_APP_ID_ANDROID=ca-app-pub-...
ADMOB_APP_ID_IOS=ca-app-pub-...
```

---

## 🏃 실행

### Metro 번들러 시작

```bash
cd app
yarn start
```

### iOS 실행 (Mac)

```bash
cd app
yarn ios
# 또는 특정 시뮬레이터 지정
yarn ios --simulator="iPhone 15"
```

### Android 실행

```bash
cd app
yarn android
```

> 💡 Android는 에뮬레이터 또는 실 기기 연결 (USB 디버깅 활성화) 필요

---

## 🧪 빌드 & 테스트

### iOS 릴리즈 빌드

```bash
cd app/ios
xcodebuild -workspace RouteFinding.xcworkspace \
           -scheme RouteFinding \
           -configuration Release \
           -sdk iphoneos
```

또는 Xcode에서 Product → Archive

### Android 릴리즈 빌드

```bash
cd app/android
./gradlew assembleRelease
# 또는 App Bundle
./gradlew bundleRelease
```

> ⚠️ 릴리즈 빌드는 keystore 필요. 별도 안내 참조 (TBD)

---

## 🐛 트러블슈팅

### Metro 캐시 문제

```bash
yarn start --reset-cache
```

### Pod 설치 실패 (iOS)

```bash
cd app/ios
pod deintegrate
pod install --repo-update
```

### Gradle 빌드 실패 (Android)

```bash
cd app/android
./gradlew clean
cd ..
yarn android
```

### node_modules 완전 재설치

```bash
cd app
rm -rf node_modules yarn.lock
yarn install
cd ios && pod install && cd ..
```

---

## 📝 개발 워크플로우

### 새 기능 작업 시작

```bash
# 1. v2 브랜치 최신 상태
git checkout v2
git pull origin v2

# 2. 기능 브랜치 생성
git checkout -b v2/feature/login-screen

# 3. 작업 시작 전 .md 파일 확인 (Claude Code)
# - README.md
# - CLAUDE.md
# - docs/01_MVP_SPEC.md
# - docs/04_WIREFRAMES.md

# 4. 코드 작성 + .md 업데이트

# 5. 커밋 (CLAUDE.md의 커밋 컨벤션 따르기)
git add .
git commit -m "feat(auth): 로그인 화면 구현

- LoginScreen.tsx 작성
- Firebase Auth 연동
- 자동 로그인 로직

Docs: 01_MVP_SPEC.md, 04_WIREFRAMES.md, CHANGELOG.md"

# 6. PR 또는 v2 머지
git push origin v2/feature/login-screen
```

### 기존 Flutter 코드 참조

```bash
# 특정 파일 보기 (체크아웃 없이)
git show main:lib/login_screen.dart

# 특정 폴더 목록
git ls-tree main lib/

# 두 버전 비교
git diff main:lib/login_screen.dart v2:app/src/screens/auth/LoginScreen.tsx
```

---

## 🔥 Firebase 관련

### Firebase Functions 배포 (필요 시)

```bash
cd functions
yarn install
firebase deploy --only functions
```

### Firestore Rules 배포

```bash
firebase deploy --only firestore:rules
```

### Admin 권한 부여 (Custom Claims)

```bash
cd functions
node scripts/setAdmin.js <user-uid>
```

> 💡 `setAdmin.js`는 v2 작업 시 새로 작성됨 (`05_ROADMAP.md` Phase 2-5 참조)

---

## 📦 주요 npm 스크립트

```bash
yarn start          # Metro 시작
yarn ios            # iOS 빌드 & 실행
yarn android        # Android 빌드 & 실행
yarn lint           # ESLint
yarn typecheck      # TypeScript 타입 체크
yarn test           # Jest 테스트
yarn clean          # 빌드 캐시 정리
```

---

## 🔗 유용한 링크

- [React Native 공식 문서](https://reactnative.dev/docs/getting-started)
- [React Native Firebase](https://rnfirebase.io/)
- [React Navigation](https://reactnavigation.org/)
- [TypeScript](https://www.typescriptlang.org/docs/)
- [routefinding v1 (Flutter)](https://github.com/yumi-kim-79/routefinding/tree/main) — 참조용
- [RideTalk](https://github.com/yumi-kim-79/ridetalk) — 패턴 참조

---

## ❓ 자주 묻는 질문

### Q: Flutter 코드를 참고하면 안 되나요?
A: 참고해도 됩니다. `git show main:lib/<파일>` 로 보세요. 단, **그대로 베끼지 말고** RN/TS 컨벤션에 맞춰 재작성하세요.

### Q: 갓 파일(1000줄+)을 한 파일에 옮겨도 되나요?
A: ❌ 반드시 분해해야 합니다. `docs/04_WIREFRAMES.md`의 분해 계획 참조.

### Q: 새 라이브러리를 추가하고 싶어요.
A: 먼저 `docs/03_TECH_STACK.md`에 추가 이유와 함께 기록 후 설치하세요.

### Q: Firebase 데이터 구조를 바꾸고 싶어요.
A: ❌ 기본적으로 금지. 50명 사용자 데이터 보호. 변경이 꼭 필요하면 사용자 승인 + 마이그레이션 스크립트 작성.

---

*이 문서는 환경 변경 시 갱신한다. 새 도구 추가, 설정 변경 등.*
