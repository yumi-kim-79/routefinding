# 📋 CHANGELOG

이 프로젝트의 모든 변경 사항은 이 파일에 기록된다.

형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/) 를 따른다.
버전 관리는 [Semantic Versioning](https://semver.org/lang/ko/) 을 따른다.

---

## [Unreleased] — v2.0 마이그레이션 진행 중

### 📁 문서

#### Added
- `README.md` 작성 (RideTalk 패턴 채택)
- `CLAUDE.md` 작성 (Claude Code 작업 컨벤션)
- `docs/01_MVP_SPEC.md` 작성 (기존 Flutter 기능 = MVP)
- `docs/02_DATA_MODEL.md` 작성 (Firestore 모델, 기존 구조 유지)
- `docs/03_TECH_STACK.md` 작성 (RN + Firebase 스택)
- `docs/04_WIREFRAMES.md` 작성 (Flutter → RN 매핑표)
- `docs/05_ROADMAP.md` 작성 (5 Phase 마이그레이션 계획)
- `GETTING_STARTED.md` 작성 (개발 환경 셋업 가이드)
- `CHANGELOG.md` 작성 (이 파일)

### 🏗️ 코드 / 셋업 (Phase 1 — 2026-05-19)

#### Added
- `app/` 에 **React Native 0.76.9** 프로젝트 초기화 (`@react-native-community/cli`, TypeScript 템플릿)
  - 앱명 `RouteFinding` → iOS `RouteFinding.xcworkspace` (GETTING_STARTED.md와 일치)
  - 의존성 설치 완료 (yarn Berry, `node_modules` 생성)
  - `package.json`에 `typecheck`(tsc --noEmit), `clean`(react-native clean) 스크립트 추가
- `app/package.json`에 `packageManager: yarn@3.6.4` 핀
- 개발 환경 결정 확정: Node 20.x LTS(v20.20.2, nvm), RN 0.76.9, yarn Berry 3.6.4
- **`app/src/` 폴더 구조 생성** — `03_TECH_STACK.md` 확정 구조 그대로 27개 디렉터리, 각 폴더에 `.gitkeep` + 용도 설명 `README.md`
  - `App.tsx` → `src/App.tsx` 이동, `index.js`·`__tests__/App.test.tsx` import 경로 갱신
  - 타입체크(`yarn typecheck`) 통과 확인

#### Removed
- 루트의 v1 잔재 파일 git 추적 제거 (전량 `~/Backups/routefinding-data/`에 백업됨)
  - `bouldering_data.csv`, `routes.json`, `approach.gpx` — 일반 루트/샘플 시드 데이터 (v2는 Firestore가 원천, NFC 원천 `*_nfc.csv` 아님)
  - 루트 `package.json`, `package-lock.json` — RN 앱은 `app/`로 이동되어 루트 툴링 불필요
  - 판별 결과 NFC 원천 파일 없음 → `docs/data-archive/` 보존 불필요

### 🔥 Firebase 연결 (Phase 1-2 — 2026-05-19)

#### Added
- `@react-native-firebase/{app,auth,firestore,storage,messaging,app-check}` **v24.0.0** 설치
- `google-services.json`(Android) / `GoogleService-Info.plist`(iOS) 배치 (`.gitignore`로 추적 제외 확인)
- Android Gradle 연동: `android/build.gradle`에 `com.google.gms:google-services:4.4.2` classpath, `android/app/build.gradle`에 플러그인 적용
- iOS `AppDelegate.mm`에 `[FIRApp configure]` 추가 (기본 앱 초기화)
- `app/src/services/firebase.ts` 작성 — 모듈러 인스턴스(auth/db/storage/messaging) export + `initAppCheck()`
  - App Check provider: Android=Play Integrity / iOS=DeviceCheck (배포), 개발 빌드는 debug provider (docs/02_DATA_MODEL.md 명세 준수)
- `App.tsx`에서 부팅 시 `initAppCheck()` 호출
- ✅ **Android 빌드 검증 성공** (`./gradlew :app:assembleDebug` — RNFB 6개 모듈 컴파일, APK 생성)

#### iOS 후속
- [x] iOS `pod install` 해결 — Podfile에 `use_modular_headers!` 추가 (사용자 결정, 72 deps/97 pods 설치 완료)
- [x] `GoogleService-Info.plist` Xcode 프로젝트 등록 — `xcodeproj` gem으로 RouteFinding 타깃 Resources에 추가
- [x] iOS 빌드 1차 실패(`gRPC-C++` ScanDependencies) → Podfile post_install 패치(gRPC explicit modules off, 사용자 결정 A) 적용 → gRPC 에러 해소
- [x] 2차 실패(`_stdio.h`) → 패치 최소화(Option 1: `CLANG_ENABLE_MODULES=NO` 제거, `CLANG_ENABLE_EXPLICIT_MODULES=NO`만 유지) → `_stdio.h` 에러 완전 해소(원인 검증됨)
- [x] 3차 실패 — `fatal error: module map file '.../grpc/gRPC-Core.modulemap' not found`

#### 결정: iOS 빌드 보류, Android 우선 진행 (2026-05-19)
- **사유**:
  - 에러가 양파 까기 패턴(gRPC ScanDependencies → `_stdio.h` → modulemap → …) — 근본 원인은 **Xcode 26.3 (Build 17C529) / iPhoneSimulator 26.2 SDK가 bleeding-edge**, firebase-ios-sdk 12.10.0 / gRPC 생태계 미추격
  - Phase 1 나머지(네비게이션·상태관리·인증 화면·디자인 시스템)는 **OS 무관** → Android로 검증·코드 작성 가능
  - 시간 효율: 지금 1~2시간 디버깅 vs 1~2주 후 RNFB/firebase-ios-sdk 새 버전 + 재시도 5분
- **재검증 트리거**: `@react-native-firebase/*` 또는 `firebase-ios-sdk`(gRPC 포함) 새 메이저/마이너 출시 시, 또는 Xcode 26.x 호환 픽스 공지 시
- iOS 빌드 별도 트랙 문서화 → `docs/06_iOS_BUILD_NOTES.md`
- 현 시점 Android는 빌드 검증 ✅ 완료, Phase 1-2는 **Android 기준 완료**로 간주

#### Changed
- **번들 ID를 기존 v1 그대로 유지하도록 네이티브 프로젝트 수정**
  - Android: `namespace`/`applicationId`/Java 패키지 → `com.yusung.routefinding` (전체 리네임)
  - iOS: 앱 타깃 `PRODUCT_BUNDLE_IDENTIFIER` → `com.yusungyun.RouteFinding`, 테스트 타깃 → `com.yusungyun.RouteFinding.tests`
  - 사유: 기존 Firebase 앱·50명 유저 무중단 전환
- **패키지 매니저: yarn classic 1.22 계획 → yarn Berry 3.6.4 채택**
  - 사유: 시스템 환경이 이미 Berry로 통일됨(다른 Vue/Firebase 프로젝트), classic yarn deprecated, 매번 `YARN_IGNORE_PATH=1` 우회 부담 제거, 모던 기준
  - 관련 docs(`03_TECH_STACK.md`, `GETTING_STARTED.md`)를 yarn 3.x(Berry) 기준으로 갱신

### 🧭 네비게이션 (Phase 1-3 — 2026-05-19)

#### Added
- React Navigation **v7** 설치 (`@react-navigation/native` 7.2.4, `native-stack` 7.15.1, `bottom-tabs` 7.16.1) + `react-native-screens` 4.4.0(핀), `react-native-safe-area-context` 4.14.1(핀)
- `src/navigation/` 골격: `types.ts`(타입 안전 param, 딥링크 대비 id), `AuthNavigator`, `MainTabNavigator`(v1 4탭), `MainNavigator`(push/modal), `RootNavigator`(인증 분기), `useAuthGate`(스텁)
- 플레이스홀더 화면: auth 3종 + 탭 4종(Board/Concept/ReportList/MyPage) + 공통 `PlaceholderScreen`
- `App.tsx` → NavigationContainer + SafeAreaProvider + RootNavigator (RN 템플릿 화면 제거)
- ✅ typecheck 통과, ✅ **Android `assembleDebug` 빌드 성공**

#### Changed
- 하단 탭 **5탭 가정 → v1 실측 4탭으로 정정** (게시판/개념도/지도/마이페이지). `git show main:lib/bottom_nav_bar.dart` 근거. `docs/04_WIREFRAMES.md` 네비게이션 섹션·매핑표 정정 (CLAUDE.md 1:1 보존)
- 딥링크: param 타입만 대비(구조), 실제 linking·FCM은 Phase 3 (사용자 결정)

#### Fixed
- `react-native-screens@4.25.1`(yarn add 기본 최신) ↔ RN 0.76.9 codegen 불일치(`Unknown prop type "accessibilityContainerViewIsModal"`) → 4.4.0 핀으로 해결 (RNav7 peer `>=4.0.0` 충족). safe-area-context도 4.14.1로 정렬

### 🗃️ 상태관리 (Phase 1-4 — 2026-05-19)

#### Added
- **Zustand 5.0.x** 설치·확정 (`[TBD] 상태관리` 해소 — 단독개발+50명 규모 적합, 보일러플레이트 적음)
- `src/stores/authStore.ts` — Firebase Auth 연동(modular). `initialize()`=`onAuthStateChanged` 구독, `signIn/signUp/signOut`. **persist 없음**(결정 A: Firebase 네이티브 세션이 단일 출처, v1 자동로그인 동등)
- `src/stores/userStore.ts` — `users/{uid}` 프로필 `fetchProfile/updateProfile/clear` (modular Firestore)
- `src/types/user.ts`(02_DATA_MODEL User 스키마), `src/types/auth.ts`(AuthUser)
- `src/constants/firestoreFields.ts` — COLLECTIONS/SUBCOLLECTIONS 상수 (P0, 02_DATA_MODEL 명명규칙)
- `useAuthGate`를 스텁 → authStore 실연동, `RootNavigator`가 `isInitializing` 동안 Splash 표시
- `App.tsx`에서 `initialize()` 1회 호출(+언마운트 해제)
- ✅ typecheck 통과, ✅ Android `assembleDebug` 성공

#### 변경 사유 / 메모
- `initialize()` 호출 위치: 요청은 "Splash에서"였으나 Splash는 **인증 시 마운트되지 않아** 자동로그인이 깨짐 → 앱 전역(`App.tsx`)에서 호출하도록 정정(정확성). Splash는 `isInitializing` 동안 표시되는 역할 유지
- `signUp`의 프로필 문서(`users/{uid}`) 생성은 Phase 2 SignUp 화면 + userStore에서 (현재 범위는 인증 골격)

#### Removed
- `@react-native-async-storage/async-storage` 제거 — **Phase 1-4 결정 A(persist 안 함)에 따라 미사용**. 설치된 3.0.2가 RN 0.76 셋업에서 `storage-android:1.0.0` 미해소로 Android 빌드 실패시킴. userStore 캐시 등 향후 필요 시 **RN 0.76 호환 2.x로 재도입 예정**

### 🌿 브랜치

#### Added
- `v2` 브랜치 (현재 활성, Flutter 잔재 정리 완료 → RN 코드 시작)

### ⚠️ 해결 대기 ([TBD])
- [TBD] 상태관리 라이브러리 (Zustand vs Redux Toolkit) — RideTalk 패턴 확인 후 결정
- [TBD] 지도 SDK (Google Maps vs Kakao Map) — 사용자 결정 필요
- [TBD] 디자인 토큰 (RideTalk 것 그대로 vs 새로 설계)
- ~~[TBD] iOS/Android 패키지명 (기존 그대로 vs v2 신규)~~ → ✅ **해결**: 기존 v1 그대로 유지 (2026-05-19)

### ❓ 질문 ([QUESTION])
- [QUESTION] 하단 탭바 정확한 구성
- [QUESTION] 갓 파일 4개의 내부 기능 상세 (map_input, generic_route_detail, mypage, crew_detail)
- [QUESTION] 이미지 에디터의 정확한 용도
- [QUESTION] 크루 채팅방의 백엔드 (Firestore vs RTDB)
- [QUESTION] 인공벽 매장 시스템 도입 시점 (v2.0 vs v2.1+)

---

## [1.2.3] — Flutter 기존 버전 (현재 운영 중)

### 📊 현황
- 빌드 번호: 39
- 사용자: 약 50명
- 플랫폼: Android, iOS
- 백엔드: Firebase
- 코드: Flutter 3.7.2+, Dart

→ 이 버전은 v2.0 출시 시까지 `main` 브랜치에서 유지. 긴급 패치만 적용.

---

*변경 사항 추가 시 [Unreleased] 섹션 최상단에 기록. 출시 시 버전 번호로 이동.*
