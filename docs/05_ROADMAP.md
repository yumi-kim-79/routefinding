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
- [x] iOS/Android 번들 ID 설정 (기존 v1 ID 유지: Android `com.yusung.routefinding` / iOS `com.yusungyun.RouteFinding`)
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

#### 1-2.5. iOS 빌드 (⏸️ 보류 — 별도 트랙)
- 상태: ❌ 빌드 미통과. 상세 시도/에러/다음 옵션 → **`docs/06_iOS_BUILD_NOTES.md`**
- 근본 원인 추정: Xcode 26.3 (17C529) / Sim 26.2 SDK가 bleeding-edge ↔ firebase-ios-sdk 12.10.0 / gRPC 미추격
- 보류 사유: 에러 양파 패턴, Phase 1 나머지는 OS 무관, 시간 효율(생태계 추격 대기)
- 🔔 **재검증 트리거**: `@react-native-firebase/*` 또는 `firebase-ios-sdk`(gRPC) 새 버전 출시 / Xcode 26.x 호환 픽스 공지 시
- [ ] iOS 빌드 검증 (트리거 충족 후 `06_iOS_BUILD_NOTES.md` 체크리스트대로 재시도)

#### 1-3. 네비게이션
- [ ] React Navigation 설치 & 셋업
- [ ] `RootNavigator` (Auth vs Main 분기)
- [ ] `AuthNavigator` (Splash → Login → SignUp)
- [ ] `MainTabNavigator` (탭 구성)
- [ ] 타입 정의 (`navigation.ts`)

#### 1-4. 상태관리
- [ ] [TBD: Zustand 등] 설치
- [ ] `authStore` 구현
- [ ] `userStore` 구현

#### 1-5. 인증 화면 (P0)
- [ ] **Splash 화면**
  - [ ] 영상 재생 (react-native-video)
  - [ ] 자동 로그인 체크
  - [ ] 화면 분기
- [ ] **Login 화면**
  - [ ] UI 구성
  - [ ] Firebase Auth 연동
  - [ ] 에러 처리
- [ ] **SignUp 화면**
  - [ ] UI 구성
  - [ ] 회원가입 로직
  - [ ] 프로필 이미지 업로드

#### 1-6. 디자인 시스템
- [ ] `theme/colors.ts` (색상 토큰)
- [ ] `theme/typography.ts` (폰트 시스템)
- [ ] `theme/spacing.ts` (간격 토큰)
- [ ] 공통 컴포넌트 (Button, Input, Text)

### Definition of Done

- ✅ iOS, Android 모두 빌드 성공
- ✅ Splash → Login → 회원가입 → 자동 로그인 → 홈 진입 흐름 작동
- ✅ Firebase Auth, Firestore 연결 확인
- ✅ FCM 토큰 발급 & Firestore 저장 확인
- ✅ 사용자 검증 OK

---

## 🗺️ Phase 2: 핵심 화면 이전 (4~6주)

### 목표
v1의 핵심 기능을 v2에서 동일하게 사용 가능한 상태.

### 우선순위 순서

#### Sprint 2-1: 홈 & 마이페이지 기반 (1주)

- [ ] **2-1-1**: HomeScreen (홈)
- [ ] **2-1-2**: MyPageScreen 기반 구조 (탭 분해)
- [ ] **2-1-3**: ProfileWithCrown 컴포넌트
- [ ] **2-1-4**: 사용자 프로필 (`UserProfileScreen`)

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
| Phase 1 | 45% | 2026-05-19 | (진행 중 — 1-1·1-2(Android) 완료, iOS 1-2.5 보류, 1-3 준비) |
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

*이 로드맵은 진행하면서 살아 움직이는 문서다. 변경 시 반드시 `CHANGELOG.md`에 기록.*
