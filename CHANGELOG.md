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

### 🎨 디자인 시스템 (Phase 1-6 — 2026-05-19)

#### Added
- **하이브리드 디자인 시스템 확정** (`[TBD] 디자인 토큰` 해소): v1 색상값 보존 + M3 스타일 토큰 구조
- v1 색상 분석 (`git grep main`): `ThemeData(primarySwatch: Colors.blue)` + Material 표준 + 등급 메달(gold/silver/bronze) 추출
- `src/theme/`: `colors.ts`(light + dark placeholder, v1 실측값), `typography.ts`(시스템 폰트, M3 스케일), `spacing.ts`(4배수), `radius.ts`, `index.ts`(`useTheme` 훅 — useColorScheme 기반 light/dark 선택)
- 공통 컴포넌트: `Text`(variant/color), `Button`(primary/secondary/ghost × sm/md/lg, loading/disabled), `Input`(label/error/비번토글), `Screen`(SafeArea+배경)
- `PlaceholderScreen`을 토큰 사용 레퍼런스로 리팩터(하드코딩 제거)
- ✅ typecheck 통과, ✅ Android `assembleDebug` 성공

#### 결정 / 메모
- secondary = `#448AFF`(blueAccent, 브랜드 파랑 일관성), purple은 `accent.purple`(#9C27B0) 별도 슬롯 (사용자 조정)
- 폰트: 시스템 기본(v1 동일, 별도 폰트 미도입). 다크모드: 구조만(placeholder), 실제 토글은 Phase 5
- 등급 메달·트래킹 속도색은 별도 의미 슬롯으로 v1 UX 정확 보존

### 🔐 인증 화면 (Phase 1-5 — 2026-05-19)

#### Added
- `SplashScreen` 정적 구현 (로고/태그라인/인디케이터). 자동로그인 체크는 `authStore.initialize()`가 담당. 영상 스플래시는 v2.1+
- `LoginScreen` — 이메일/비밀번호 + `authStore.signIn`, v1 에러 코드 매핑, **이메일 인증 게이트** 차단 시 재발송 다이얼로그(RN Alert)
- `SignUpScreen` — 닉네임 **중복확인 버튼**(v1 방식) + 이메일/비밀번호 → `authStore.signUp`
- `authStore`: **Option A 게이트 패턴** — `gatePassed` + `signingIn` 가드. v1 1:1: `!emailVerified && !isOldUser && !isAdmin` 차단, `isOldUser`=createdAt<2025-05-01 05:00 UTC(없으면 true), `signUp`=계정+displayName+`users/{uid}` 문서+인증메일+signOut(자동로그인 안 함)
- `userStore`: `isNicknameAvailable`(nickname 쿼리), `createProfile`(v1 동일 필드 `nickname/email/createdAt`)
- `constants/admin.ts`: `ADMIN_EMAILS=['yusung790926@gmail.com']` + `EMAIL_VERIFICATION_CUTOFF` (TODO Phase 2-5 Custom Claims 이전)
- `types/auth.ts`: `EmailNotVerifiedError`(resend 클로저)
- `AuthNavigator` Login↔SignUp 정리(Splash는 RootNavigator가 isInitializing 중 렌더), `useAuthGate`=`isAuthenticated && gatePassed`
- ✅ typecheck 통과, ✅ Android `assembleDebug` 성공

#### 의도적 이탈 (사용자 승인, v1과 다름)
- `last_email` 자동입력 생략 (결정 A·async-storage 미사용, userStore 캐시 도입 시 재검토)
- 로그인/스플래시 FCM 토큰 저장 → Phase 3 (messaging 미설치)
- 영상 스플래시·이미지 피커 제외 (MVP)
- 인증 다이얼로그: v1 `AlertDialog`(상시·로딩) → RN `Alert`(재발송 후 결과 Alert) — 기능 동등, 커스텀 모달/추가 의존성 회피

### ✅ Phase 1 런타임 검증 (2026-05-19)

- Android 에뮬레이터 런타임 검증 통과: Splash→Login, 회원가입+이메일인증 게이트, 로그인→MainTabs, 4탭, 디자인 토큰. (선택 항목 탭전환·자동로그인 복원은 추후 확인)
- **Phase 1 (1-1~1-6) Android 기준 100% 완료** (기능+런타임). iOS 빌드는 `docs/06_iOS_BUILD_NOTES.md` 보류 트랙 유지
- 검증 보고서·교훈 → `docs/07_RUNTIME_VERIFICATION.md` 신규
- 🐞 교훈: Notifee "native module not found"는 **의존성 문제 아님**(notifee 트리에 부재) — 좀비 Metro(포트 8081)의 스테일 번들. 클린 절차 1순위 = `lsof -ti:8081 | xargs kill -9`

### 🧭 Phase 2-1 ① 네비게이션 5탭 정정 (2026-05-19)

#### Fixed
- **하단 탭 4→5 정정 (Phase 1-3 오류 정정)**: Phase 1-3은 미사용 dead code `lib/bottom_nav_bar.dart`(4탭)를 근거로 4탭 구현. v1 실제 진입 화면 `lib/home_screen.dart`(IndexedStack 5탭) 분석 결과 정정 — **게시판/개념도/루트 위치/크루/마이페이지** (CLAUDE.md 1:1 보존)
  - `MapTab`: 잘못된 `ReportListScreen` → `MapScreen`(v1 idx2 루트 위치)으로 수정
  - `CrewTab` 추가(v1 idx3 CrewMainScreen), `CrewMain`은 push에서 탭으로 이동
  - `types.ts` MainTabParamList 5탭, `MainTabNavigator` 재작성, `MainNavigator`에서 CrewMain push 제거
  - 신규 placeholder: `screens/map/MapScreen.tsx`, `screens/crew/CrewMainScreen.tsx`
- 04_WIREFRAMES.md 네비 섹션·매핑표 재정정 + **탭 구조 정정 이력**(5가정→4(dead code 오판)→5확정) 명시
- HomeScreen 부가기능 분리 계획 명시: 출석보상(Phase 2-1 별도 P1) / 업데이트체크(Phase 3+) / AdMob(Phase 4) / `_tabHistory`·`initialIndex`(1:1 TODO)
- ✅ typecheck, ✅ Android `assembleDebug`

### 🗄️ Phase 2-1 ② 스키마 타입/문서 정정 (2026-05-19)

#### Fixed
- `types/user.ts` 실제 v1 필드명에 맞춤 (Firestore 구조 불변): `profileImageUrl`→**`photoUrl`**, `level: number`→**`level: string`**(등반등급 "5.15"~"5.6"), **`intro`** 추가. `UserProfileUpdate`도 동기화
- `02_DATA_MODEL.md`: User 스키마 정정 + **`[QUESTION] level` 해소**(등반등급 문자열 확정) + 컬렉션 트리/규칙 주석 `photoUrl` 반영
- `02_DATA_MODEL.md`에 **`bouldering_reports`** 컬렉션 신규 문서화(§5-1, 인공벽/볼더링 제보 — v1에서 사용 중이나 기존 문서 누락분, 실 스키마는 [TBD])
- ✅ typecheck, ✅ Android `assembleDebug` (영향: types 전용, userStore 호환)

### 👑 Phase 2-1 ③ ProfileWithCrown (2026-05-19)

#### Added
- `theme/colors.ts`에 **`grade` 맵 + `gradeDefault`** 추가 — v1 `_levelBorderColor` 10단계 1:1 (gold/silver/bronze=medal 재사용, purple=accent 재사용, red=error, yellow/blue 재사용, **brown/pink/lightBlueAccent 신규 팔레트**). dark는 상속(등급=도메인 상수)
- `components/common/ProfileWithCrown.tsx` — v1 1:1 이식: 등급 테두리색·등급 뱃지·displayType 프리셋(profile/comment/reply)·showNickname Row. 사진 없으면 👤 fallback
- 크라운: 결정 C(이모지 👑 placeholder, 상위 3등급 5.15/5.14/5.13만 — v1 `_crownAsset` 조건 동일). 원본 4.2MB PNG 미도입, **TODO(v2.1+) 최적화 에셋 교체** 명시
- ✅ typecheck, ✅ Android `assembleDebug`

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
