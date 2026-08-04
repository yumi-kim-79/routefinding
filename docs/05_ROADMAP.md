# 🗺️ 05_ROADMAP.md — 마이그레이션 로드맵

> **목표**: Flutter v1.2.3 → React Native v2.0 마이그레이션
> **방식**: Phase별 진행, 각 Phase 끝에 사용자 검증
> **기간 추정**: 약 3~4개월 (단독 개발자 기준)

---

## 🎯 마일스톤

```
[Phase 0] 문서 & 셋업      ← ✅ 진행 중 (이 단계)
   ↓ (1주)
[Phase 1] 기반 구축        — RN 초기화, Firebase 연결, 인증
   ↓ (1~2주)
[Phase 2] 핵심 화면 이전    — 지도, 루트, 게시판, 크루
   ↓ (4~6주)
[Phase 3] 부가 기능        — GPX, NFC, 알림, 광고
   ↓ (2~3주)
[Phase 4] 테스트 & 출시    — 베타 → v2.0
   ↓ (2주)
[v2.0 출시] 🎉
   ↓
[Phase 5+] 신기능 (v2.1+)  — AI, 통계, 오프라인 등
```

---

## 📅 Phase 0: 문서 & 셋업 (1주)

### 목표
프로젝트 구조 확정 + 모든 명세서 작성 + 개발 환경 준비.

### 작업 목록

- [x] **0-1**: GitHub 저장소 셋업 + v1 코드 백업 (`main` 브랜치)
- [x] **0-2**: 기존 코드 분석
- [x] **0-3**: `README.md` 작성
- [x] **0-4**: `CLAUDE.md` 작성
- [x] **0-5**: `docs/01_MVP_SPEC.md` 작성
- [x] **0-6**: `docs/02_DATA_MODEL.md` 작성
- [x] **0-7**: `docs/03_TECH_STACK.md` 작성
- [x] **0-8**: `docs/04_WIREFRAMES.md` 매핑표 작성
- [x] **0-9**: `docs/05_ROADMAP.md` 작성 (이 파일)
- [ ] **0-10**: `CHANGELOG.md` 초기화
- [ ] **0-11**: `GETTING_STARTED.md` 작성
- [ ] **0-12**: `v2` 브랜치 생성 (Flutter 파일 제거 후)
- [~] **0-13**: RideTalk 실제 `package.json` 확인 및 [TBD] 결정
  - ⚠️ RideTalk은 private 저장소라 직접 확인 불가
  - [x] RN 버전(0.76.9) / Node(20 LTS) / 패키지 매니저(yarn Berry 3.6.4) / 패키지명(기존 유지) 확정
  - [ ] 상태관리 라이브러리 — **미결 [TBD]** (Phase 1-4 전 결정 필요)
  - [ ] 지도 SDK — **미결 [TBD]**
  - [ ] 디자인 토큰 — **미결 [TBD]**

### Definition of Done

- ✅ 모든 핵심 .md 파일 작성 완료
- ✅ v2 브랜치 생성 & 초기 커밋
- ✅ 모든 [TBD] 항목 1차 결정
- ✅ 사용자가 문서 검토 & 승인

---

## 🏗️ Phase 1: 기반 구축 (1~2주)

### 목표
RN 앱이 실행되고, Firebase 연결되고, 로그인이 작동하는 최소 상태 도달.

### 작업 목록

#### 1-1. RN 프로젝트 초기화 (🚧 진행 중 — 2026-05-19 시작)
- [x] `app/` 폴더에 RN **0.76.9** 프로젝트 생성 (TypeScript 템플릿)
- [x] TypeScript 설정 (`tsconfig.json` — 템플릿 기본)
- [~] ESLint, Prettier 설정 — 템플릿 기본 적용됨. "RideTalk 것 그대로"는 RideTalk이 private이라 미적용 (추후 확인 시 동기화)
- [x] 폴더 구조 생성 (`src/` 27개 디렉터리, 각 `.gitkeep`+`README.md`, `App.tsx`→`src/App.tsx`)
- [~] `package.json` 의존성 — 기본 의존성 설치 완료. 앱 라이브러리(Firebase/네비 등)는 1-2 이후 추가
- [x] iOS/Android 번들 ID 설정 — **2026-08-04 양 플랫폼 `com.yusung.routefinding`으로 통일**
      (iOS 기존값 `com.yusungyun.RouteFinding`은 타 Apple 팀에 선점돼 사용 불가. v1 iOS 미출시라 변경 비용 0)
- [ ] iOS Podfile `pod install` — CocoaPods 환경에서 별도 실행 (1-2 Firebase 연동 시)

#### 1-2. Firebase 연결 — Android ✅ 완료 (2026-05-19)
- [x] Firebase 콘솔 앱 — 기존 v1 앱 재사용 ([QUESTION] 해결: 동일 패키지명 `com.yusung.routefinding` / `com.yusungyun.RouteFinding`)
- [x] `google-services.json` (Android) 추가 + Gradle 연동
- [x] `GoogleService-Info.plist` (iOS) 배치 + Xcode 프로젝트 등록(`xcodeproj` gem)
- [x] `@react-native-firebase/*` 6개 설치 (v24.0.0)
- [x] Firebase 초기화 (`src/services/firebase.ts`) + `AppDelegate.mm` `[FIRApp configure]`
- [x] App Check 설정 (`initAppCheck`, Play Integrity/DeviceCheck + dev debug)
- [x] **Android 빌드 검증 성공** (`assembleDebug`)
- [x] iOS `pod install` 해결(`use_modular_headers!`)
→ Phase 1-2는 **Android 기준 완료**로 간주. 나머지 Phase 1은 Android로 진행.

#### 1-2.5. iOS 빌드 (✅ 해결 — 2026-08-04)
- 상태: ✅ **실기기 빌드 성공(2026-08-04)**. RNFB 25.1.0 + static framework 링크 + 번들 ID 변경으로 해결.
  전체 시도 이력 → **`docs/06_iOS_BUILD_NOTES.md`**
- 근본 원인 추정: Xcode 26.3 (17C529) / Sim 26.2 SDK가 bleeding-edge ↔ firebase-ios-sdk 12.10.0 / gRPC 미추격
- 보류 사유: 에러 양파 패턴, Phase 1 나머지는 OS 무관, 시간 효율(생태계 추격 대기)
- 🔔 **재검증 트리거**: `@react-native-firebase/*` 또는 `firebase-ios-sdk`(gRPC) 새 버전 출시 / Xcode 26.x 호환 픽스 공지 시
- [x] iOS 빌드 검증 — 2026-08-04 실기기 빌드·실행 성공

#### 1-3. 네비게이션 ✅ 완료 (Android 기준 — 2026-05-19)
- [x] React Navigation v7 설치 (+ screens 4.4.0 / safe-area-context 4.14.1 핀)
- [x] `RootNavigator` (Auth vs Main 분기, 인증=스텁 `useAuthGate` → 1-4 authStore 연동 예정)
- [x] `AuthNavigator` (Splash → Login → SignUp, 플레이스홀더)
- [x] `MainTabNavigator` (v1 동등 4탭: 게시판/개념도/지도/마이페이지)
- [x] 타입 정의 (`src/navigation/types.ts`, 딥링크 대비 param)
- [x] typecheck 통과 + Android `assembleDebug` 성공
- 비고: 화면은 플레이스홀더(Phase 2 교체), iOS 빌드는 1-2.5 보류 트랙

#### 1-4. 상태관리 ✅ 완료 (Android 기준 — 2026-05-19)
- [x] **Zustand 5.0.x** 설치·확정 ([TBD] 해소)
- [x] `authStore` 구현 (Firebase Auth modular, onAuthStateChanged, persist 없음=결정 A)
- [x] `userStore` 구현 (Firestore `users/{uid}` fetch/update)
- [x] `useAuthGate`→authStore 실연동, `App.tsx`에서 `initialize()` 호출
- [x] 타입(`types/user.ts`,`types/auth.ts`) + 상수(`constants/firestoreFields.ts`)
- [x] typecheck + Android `assembleDebug` 성공
- [x] `@react-native-async-storage/async-storage` 제거 (미사용, 결정 A)
- 비고: 런타임 흐름(로그인→메인) 검증은 에뮬레이터+Firebase 자격 필요 → 사용자 환경에서 `yarn android`로 확인. iOS는 1-2.5 보류 유지

#### 1-5. 인증 화면 (P0) ✅ 완료 (Android 기준 — 2026-05-19)
- [x] **Splash** — 정적(로고/태그라인/인디케이터). 자동로그인=authStore.initialize. 화면분기=RootNavigator. (영상=v2.1+)
- [x] **Login** — UI(공통 컴포넌트) + authStore.signIn + 이메일 인증 게이트 + 에러 매핑 + 재발송 다이얼로그
- [x] **SignUp** — UI + 닉네임 중복확인(v1 버튼식) + signUp(계정/displayName/프로필문서/인증메일/signOut)
- [x] Option A 게이트 패턴(gatePassed/signingIn), v1 1:1(예전유저/관리자 예외, 2025-05-01 컷)
- [x] typecheck + Android `assembleDebug` 성공
- [~] 프로필 이미지 업로드 → 마이페이지(Phase 2-1)로 이관 (사용자 결정②)
- 비고: 런타임(로그인→메인/재발송) 검증은 에뮬레이터+Firebase 자격 필요 → `yarn android`로 확인. iOS 1-2.5 보류

#### 1-6. 디자인 시스템 ✅ 완료 (Android 기준 — 2026-05-19)
- [x] `theme/colors.ts` (v1 색상 보존 + M3 슬롯, light + dark placeholder)
- [x] `theme/typography.ts` (시스템 폰트, M3 스케일) + `spacing.ts`(4배수) + `radius.ts`
- [x] `theme/index.ts` `useTheme` 훅 (다크 구조만, 토글은 Phase 5)
- [x] 공통 컴포넌트 Button/Input/Text/Screen + PlaceholderScreen 토큰화
- [x] 하이브리드 디자인 토큰 확정 ([TBD] 해소)
- [x] typecheck + Android `assembleDebug` 성공

### Definition of Done (실측 기준 정정 — 2026-05-19)

- ⚠️ 빌드: **Android ✅ / iOS ❌ 보류**(1-2.5, `06_iOS_BUILD_NOTES.md`, 트리거 시 재시도)
- ✅ Splash → Login → 회원가입 → 로그인 → MainTabs 흐름 작동(Android 런타임 검증)
  - 단 "앱 완전 종료 후 자동로그인 복원"은 선택 항목으로 미확인(`07_RUNTIME_VERIFICATION.md` #9)
- ✅ Firebase Auth/Firestore 연결 확인(회원가입·로그인·프로필 문서 동작)
- ⏸️ FCM 토큰 발급/저장: **Phase 3로 연기**(messaging 미사용, 의도적 이탈 — 사용자 승인)
- ✅ 사용자 검증 OK (런타임 체크리스트 통과)

> Phase 1은 **Android 기준 완료**로 처리. iOS 빌드·FCM은 별도 트랙/Phase로 명확히 분리됨.

---

## 🗺️ Phase 2: 핵심 화면 이전 (4~6주)

### 목표
v1의 핵심 기능을 v2에서 동일하게 사용 가능한 상태.

### 우선순위 순서

#### Sprint 2-1: 홈 & 마이페이지 기반 (1주) — 🚧 진행 중 (2026-05-19)

- [x] **①** 네비 4→5탭 정정 (Phase 1-3 dead-code 오판 정정, v1 home_screen.dart 기준)
- [x] **②** 스키마 타입/문서 정정 (photoUrl/level:string/intro, bouldering_reports 문서화)
- [x] **2-1-3**: ProfileWithCrown 컴포넌트 (v1 1:1, theme.grade, 크라운 placeholder)
- [~] **2-1-2**: MyPageScreen 기반 구조 (탭 분해) — **착수**: 컨테이너+ProfileHeader(실)+useMyPage+5탭 placeholder. 탭 본문 구현 잔여
- [ ] **2-1-1**: HomeScreen — v1 home_screen.dart = 탭 컨테이너(=MainTabNavigator, ①에서 처리). 부가기능(출석보상 P1 등) 잔여
- [ ] **2-1-4**: UserProfileScreen (시간 남으면)
- 잔여 결정: 마이프로필 image-picker(react-native-image-picker 확정, ④ 실구현 시 설치), top-tab 라이브러리 도입 여부(현재 경량 커스텀)

#### Sprint 2-2: 게시판 (1.5주)

- [ ] **2-2-1**: BoardScreen
- [ ] **2-2-2**: NoticeBoardScreen
- [ ] **2-2-3**: CategoryPostsScreen
- [ ] **2-2-4**: PostDetailScreen (댓글/대댓글 포함)
- [ ] **2-2-5**: WritePostScreen / EditPostScreen
- [ ] **2-2-6**: CommentDetailScreen

#### Sprint 2-3: 지도 & 루트 (2주) — 갓 파일 포함

- [ ] **2-3-1**: MapScreen (마커, 클러스터링)
- [ ] **2-3-2**: ConceptListScreen
- [ ] **2-3-3**: RouteListScreen
- [ ] **2-3-4**: 🚨 **MapInputScreen 분해** (5~7개 컴포넌트)
- [ ] **2-3-5**: 🚨 **RouteDetailScreen 분해** (탭/섹션별)
- [ ] **2-3-6**: PitchDetailScreen

#### Sprint 2-4: 크루 (1.5주) — 갓 파일 포함

- [ ] **2-4-1**: CrewMainScreen
- [ ] **2-4-2**: CrewCreateScreen
- [ ] **2-4-3**: 🚨 **CrewDetailScreen 분해** (탭별)
- [ ] **2-4-4**: CrewJoinFormScreen
- [ ] **2-4-5**: CrewBoardTab + Post 화면들
- [ ] **2-4-6**: CrewChatScreen

#### Sprint 2-5: 리포트 (1주)

- [ ] **2-5-1**: ReportListScreen
- [ ] **2-5-2**: ReportDetailScreen
- [ ] **2-5-3**: ReportAdminScreen (관리자 전용)
- [ ] **2-5-4**: Custom Claims 도입 (`functions/scripts/setAdmin.js`)

### Definition of Done

- ✅ 갓 파일 4개 모두 컴포넌트 분해 완료
- ✅ 각 화면별 Flutter 원본과 1:1 기능 동등성 확인
- ✅ 사용자가 일상 사용 가능한 수준

---

## 🛠️ Phase 3: 부가 기능 (2~3주)

### 목표
GPS, GPX, NFC, 푸시, 광고 등 모든 부가 기능 작동.

### 작업 목록

#### 3-1. 트래킹 (1주)

- [ ] **3-1-1**: TrackingScreen (등반 기록)
- [ ] **3-1-2**: ApproachTrackingScreen (접근로)
- [ ] **3-1-3**: GpxActionButtons
- [ ] **3-1-4**: GPX 파싱/생성 (`services/gpx.ts`)

#### 3-2. NFC (1주)

- [ ] **3-2-1**: `services/nfc.ts` 셋업
- [ ] **3-2-2**: 인공벽 NFC 태그 인식
- [ ] **3-2-3**: iOS NFC 권한 (Apple Developer 캐퍼빌리티 추가)
- [ ] **3-2-4**: Android NFC 백그라운드 인식

#### 3-3. 알림 (3일)

- [ ] **3-3-1**: NotificationListScreen
- [ ] **3-3-2**: FCM 백그라운드 핸들러
- [ ] **3-3-3**: 로컬 알림 (notifee)
- [ ] **3-3-4**: 알림 클릭 → 딥링크 처리

#### 3-4. 광고 (2일)

- [ ] **3-4-1**: AdMob 셋업
- [ ] **3-4-2**: 배너 광고 배치
- [ ] **3-4-3**: 전면 광고 트리거 결정

#### 3-5. 이미지 에디터 (1주)

- [ ] **3-5-1**: ImageEditorScreen 분해
- [ ] **3-5-2**: [TBD] 정확한 편집 기능 확인 후 구현
- [ ] **3-5-3**: WatermarkedImage 컴포넌트

#### 3-6. 시스템

- [ ] **3-6-1**: UpdateChecker (앱 버전 체크)
- [ ] **3-6-2**: ImageUrlHelper
- [ ] **3-6-3**: 기타 유틸 이전

### Definition of Done

- ✅ 모든 P0, P1, P2 기능 작동
- ✅ Flutter v1의 기능 누락 없음

---

## 🚀 Phase 4: 테스트 & 출시 (2주)

### 목표
v2.0 정식 출시.

### 작업 목록

#### 4-1. 베타 테스트 (1주)

- [ ] **4-1-1**: TestFlight (iOS) / Play Console 내부 테스트 (Android) 배포
- [ ] **4-1-2**: 기존 50명 사용자 중 5~10명 베타 참여
- [ ] **4-1-3**: 버그 리포트 수집 & 우선순위
- [ ] **4-1-4**: 크리티컬 버그 수정

#### 4-2. 출시 준비 (3일)

- [ ] **4-2-1**: App Store / Play Store 메타데이터
  - 스크린샷 (각 OS별)
  - 앱 아이콘
  - 설명 문구 갱신
- [ ] **4-2-2**: 개인정보처리방침 갱신 (필요시)
- [ ] **4-2-3**: 버전 번호 결정 (v2.0.0+1)

#### 4-3. 출시 (3일)

- [ ] **4-3-1**: 점진 출시 (10% → 50% → 100%)
- [ ] **4-3-2**: 사용자 공지 (v1 → v2 전환)
- [ ] **4-3-3**: 모니터링 & 핫픽스 대응

#### 4-4. 출시 후 정리

- [ ] **4-4-1**: `v2` 브랜치 → `main` 머지
- [ ] **4-4-2**: Flutter 코드는 `legacy-flutter` 브랜치로 이동 (참조용)
- [ ] **4-4-3**: GitHub Release 작성

### Definition of Done

- ✅ v2.0 App Store, Play Store 출시
- ✅ 기존 사용자 안정적 전환
- ✅ 크리티컬 버그 없음

---

## 🌟 Phase 5+: 신기능 (v2.1+, 출시 후)

v2.0 안정화 후 진행할 항목들. 우선순위는 출시 후 다시 정한다.

### 후보 기능

| 기능 | 우선도 | 노트 |
|---|---|---|
| 다크모드 | P2 | RN 환경에서 처음부터 가능 |
| 다국어 지원 | P3 | 해외 등반지 다루면 필요 |
| 오프라인 모드 | P2 | 산속 인터넷 약함, 필수 가까움 |
| AI 루트 추천 | P3 | 등급/지역 기반 |
| 등반 통계/그래프 | P2 | 기존 fl_chart → react-native-chart-kit |
| 인공벽 매장 시스템 | P1 | 자연암벽과 분리 필요 |
| AR 루트 안내 | P3 | 토포 위에 등반 라인 AR |
| 친구/팔로우 | P2 | 커뮤니티 강화 |
| 실시간 알림 | P3 | 더 풍부한 알림 |

→ v2.0 출시 후 별도 `06_FUTURE_FEATURES.md` 작성.

---

## 📊 진행률 추적

| Phase | 진행률 | 시작일 | 종료일 |
|---|---|---|---|
| Phase 0 | 95% | 2026-05-19 | (거의 완료, 일부 [TBD] 잔존) |
| Phase 1 | ✅ 100% (Android) | 2026-05-19 | 1-1~1-6 기능+런타임 검증 완료(`07_RUNTIME_VERIFICATION.md`). iOS 빌드만 1-2.5 보류 트랙 |
| Phase 2 | ~17% | 2026-05-20 | Sprint 2-1 ~80% (탭 본문 4 + ⑤[D] 완료. 잔여: ⑤[F]/[E]/⑥/⑦) |
| Phase 2 | 0% | TBD | TBD |
| Phase 3 | 0% | TBD | TBD |
| Phase 4 | 0% | TBD | TBD |

→ 진행하면서 갱신.

---

## ⚠️ 리스크 관리

### 기술적 리스크

| 리스크 | 대응 |
|---|---|
| RN의 Google Maps 성능 (대량 마커 클러스터링) | 초기 PoC로 확인. 안 되면 native 모듈 활용 |
| NFC iOS 인증 (Apple Developer) | 인증 신청 미리 (1~2주 소요 가능) |
| 기존 50명 사용자의 데이터 호환성 | Firestore 구조 유지로 위험 최소화 |
| App Check 마이그레이션 | v1과 동시 운영 시 토큰 충돌 확인 |

### 일정 리스크

| 리스크 | 대응 |
|---|---|
| 단독 개발자 → 작업 속도 한계 | Claude Code 활용 극대화 |
| 갓 파일 4개의 복잡도 | 분해 계획 사전 설계 (`04_WIREFRAMES.md`) |
| 베타 테스트 피드백 폭주 | 베타 인원 제한 (5~10명) |

### 사용자 리스크

| 리스크 | 대응 |
|---|---|
| v1 → v2 전환 시 사용자 이탈 | 사전 공지 + 데이터 마이그레이션 보장 |
| 디자인 변경에 대한 거부감 | MVP는 디자인 최소 변경, v2.1+에서 점진 개선 |

---

## 🔄 정기 점검

매주 (또는 Phase 종료 시):

1. `CHANGELOG.md` 정리
2. `04_WIREFRAMES.md` 매핑표 진행 상태 갱신
3. `01_MVP_SPEC.md`의 [QUESTION] 해결 여부 확인
4. 다음 주 우선순위 재조정
5. 사용자 (yusungyun)와 진행 상황 공유

---

## 🚀 다음 세션 시작 가이드 v3 (2026-05-20 갱신)

> 현재 위치: **Sprint 2-1 ~80% (Android, 게이트 통과·시각 미검증)**. 브랜치 `v2` HEAD = `c8e3132`.
> 어제 가이드 v2(아래 보존)는 5/20에 5개 커밋(2-1-2 탭 본문 4종 + ⑤[D])으로 대부분 소화.

### 1) 다음 세션 첫 작업 — 일괄 시각 검증 (Sprint 2-1 누적)

```bash
# 좀비 Metro 교훈 (5/19) — 1순위
lsof -ti:8081 | xargs kill -9 2>/dev/null
adb uninstall com.yusung.routefinding 2>/dev/null
watchman watch-del-all 2>/dev/null; rm -rf $TMPDIR/metro-* node_modules/.cache
# 에뮬레이터 콜드부트(-no-snapshot-load) 권장
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 20
cd ~/StudioProjects/routefinding/app
corepack yarn start --reset-cache       # 터미널 A
corepack yarn android                   # 터미널 B
```

검증 항목(누적):
- 하단 5탭(게시판/개념도/루트 위치/크루/마이페이지)
- MyPage: ProfileHeader + 5탭 스위처(내제보관리/내글/내댓글/MY ROUTE/마이프로필)
- **내제보관리 ③**: 카드/상태뱃지/액션 버튼/PromptModal(반려 사유)
- **내글 ①**: ProfileWithCrown+제목+snippet+UnreadBadge
- **내댓글 ②**: collectionGroup+PostTitle+UnreadBadge+"(삭제된 글)"
- **MY ROUTE ④**: 검색바+routeRef deref+카드/삭제
- **마이프로필 ⑤[D]**: 읽기전용 필드+등급+"다음 등급까지 N점"+intro 편집

### 2) 시각 검증 OK면 — ⑤[F] 프로필 사진 업로드 (⚠️ 양파 위험 구간)

원칙: 양파 발생 시 즉시 멈춤·보고. 추측 패치 금지.

```
[1] npm view react-native-image-picker version dist-tags peerDependencies
    → RN 0.76 호환 버전 결정 후 핀 (screens 4.25/async-storage 3.x 학습)
[2] corepack yarn add react-native-image-picker@<핀 버전>
[3] cd android && ./gradlew :app:assembleDebug --no-daemon  ← 첫 양파 가능 지점
    실패면 즉시 멈춤·보고
[4] AndroidManifest 권한 추가 (READ_MEDIA_IMAGES 등) → 다시 빌드
[5] services/profile.ts 신규: uploadProfilePhoto(uid, localUri)
    RNFB modular getStorage/ref/putFile/getDownloadURL
[6] MyProfileTab 아바타 "사진 변경" 버튼 → 피커 → 업로드 →
    userStore.updateProfile(uid, {photoUrl})
[7] typecheck + 빌드 + 일괄 시각 검증 → 커밋
```

대안 (양파 심하면): [F] 보류, ⑥/⑦로 우회 → Sprint 2-1 마무리 → 별도 세션에서 [F] 재시도.

### 3) 후속 우선순위 (Sprint 2-1 마무리)

| 순위 | 작업 | 비고 |
|---|---|---|
| ③ | **[E] 비정규화 동기화 분석** — `_updateAllPostsAndCommentsProfile` 트리거 위치 v1 추가 분석 | v1도 자동 호출 X — 별도 UX 버튼 추정. 분석 후 결정 |
| ④ | **⑥ HomeScreen 부가기능 분리** — 출석보상(P1)·`initialIndex`(라우트 param)·`_tabHistory` 백처리 | home_screen.dart 47~75 |
| ⑤ | **⑦ UserProfileScreen + UserPostsScreen** | 351줄 |
| ⑥ | **Sprint 2-1 마무리** + Phase 2-2(게시판) 진입 결정 | 2-2는 PostDetail(990줄) 등 분량 큼 |

### 4) 미해결 결정 / [TBD]

- **이미지 피커 호환 버전** — [F] 진입 시 결정 (react-native-image-picker 확정·미설치)
- **[E] 비정규화 동기화 v1 트리거 위치** — 추가 분석 필요
- **top-tab 라이브러리** — 현재 경량 커스텀 유지 (`@react-navigation/material-top-tabs` 미도입)
- **지도 SDK** — Phase 2-3 진입 시 결정 (Google vs Kakao)
- **아이콘 라이브러리** — ReportActions/PromptModal 등에 텍스트 버튼 사용 중 (추후 결정)

### 5) iOS 보류 트랙 — 변동 없음

`docs/06_iOS_BUILD_NOTES.md` 옵션0(클린 재시도) 트리거 = RNFB/firebase-ios-sdk 새 버전 / Xcode 26.x 호환 픽스.

---

## 🚀 다음 세션 시작 가이드 v2 (2026-05-19 갱신, 보존)

> 현재 위치: **Phase 1 (Android) 완료 + 검증 / Phase 2-1 진행 중**. 브랜치 `v2` HEAD = `8d837a9`.

### 1) 다음 작업 우선순위 (Sprint 2-1 잔여)

| 순위 | 작업 | 비고 |
|---|---|---|
| ① | **2-1-2 탭 본문** — MyReportsTab(route_reports+bouldering_reports)·MyPostsTab(posts userId==me)·MyCommentsTab(collectionGroup comments)·MyRouteTab(users/{uid}/my_routes) | `git show main:lib/mypage_screen.dart` 해당 `_build*` 참조, v1 1:1 |
| ② | **MyProfileTab + `react-native-image-picker`** | ⚠️ **양파 가능 구간**: 설치 시 RN 0.76 호환 버전 핀 필요할 수 있음 → 착수 시 멈추고 보고 |
| ③ | **HomeScreen 부가기능 분리** — 출석보상(P1)·`initialIndex`(라우트 param)·`_tabHistory` 백처리(1:1) | v1 home_screen.dart 47~75 참조 |
| ④ | **UserProfileScreen** (+ UserPostsScreen 분리) | `git show main:lib/user_profile_screen.dart` (351줄) |

### 2) 미해결 결정 (착수 시 사용자 확인)

- **top-tab 라이브러리**: 현재 MyPage는 경량 커스텀 탭 스위처. `@react-navigation/material-top-tabs` 도입 여부 (도입 시 새 의존성 + 양파 가능).
- **HomeScreen 부가기능 분리 위치**: 출석보상/업데이트체크/AdMob을 어느 모듈·Phase에 둘지 (현재 안: 출석=Phase 2-1 별도 P1, 업데이트=Phase 3+, AdMob=Phase 4).
- 이미지 피커 = `react-native-image-picker`로 확정(미설치) — ②에서 설치.

### 3) 미확인 검증 항목 (typecheck/빌드만 통과, 런타임 미확인)

- [ ] 5탭 시각 확인 (게시판/개념도/루트 위치/크루/마이페이지)
- [ ] MyPage 탭 스위처 작동(5탭 전환) + ProfileHeader 표시
- [ ] ProfileWithCrown 등급별 색상/크라운(👑) 시각 확인
- [ ] (Phase 1 잔여) 앱 완전 종료 후 자동 로그인 복원, 탭 클릭 전환

### 4) 다음 세션 검증 절차 (필수 순서)

```bash
# ⚠️ 좀비 Metro 교훈(07_RUNTIME_VERIFICATION 참조) — 반드시 먼저
lsof -ti:8081 | xargs kill -9 2>/dev/null
adb uninstall com.yusung.routefinding 2>/dev/null
watchman watch-del-all 2>/dev/null; rm -rf $TMPDIR/metro-* node_modules/.cache
# 에뮬레이터 wipe(콜드부트) 권장 → 앱 실행
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 20
cd ~/StudioProjects/routefinding/app
corepack yarn start --reset-cache         # 터미널 A
corepack yarn android                     # 터미널 B
```
> "코드/의존성에 없는데 번들에 있다" = 좀비 Metro/스테일 캐시. 의존성부터 건드리지 말 것.

### 5) iOS 보류 트랙 재검증 트리거

`@react-native-firebase/*` 또는 `firebase-ios-sdk`(gRPC) 새 버전 / Xcode 26.x 호환 공지 시
→ `docs/06_iOS_BUILD_NOTES.md` 옵션0(클린 재시도)부터.

---

*이 로드맵은 진행하면서 살아 움직이는 문서다. 변경 시 반드시 `CHANGELOG.md`에 기록.*
