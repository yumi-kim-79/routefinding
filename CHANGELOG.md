# 📋 CHANGELOG

이 프로젝트의 모든 변경 사항은 이 파일에 기록된다.

형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/) 를 따른다.
버전 관리는 [Semantic Versioning](https://semver.org/lang/ko/) 을 따른다.

---

## [Unreleased] — v2.0 마이그레이션 진행 중

### 📅 2026-08-04 (후속) — RNFB 25.1.0 업그레이드 + iOS Podfile 근본 정정

> **목적**: 보류 트랙이던 iOS 빌드 복구. `docs/09_RNFB_UPGRADE.md`의 조사 결론대로
> **25.1.0으로만** 올렸다(26은 New Architecture 필수라 RN 업그레이드와 묶어 별도 진행).

#### Changed — `@react-native-firebase/*` 24.0.0 → **25.1.0**
- 대상 6개: `app` / `auth` / `firestore` / `storage` / `messaging` / `app-check`
- `src/types/auth.ts` — `FirebaseAuthTypes.User` → 모듈러 `User` 타입 (2곳)
- `src/services/firebase.ts` — App Check provider를 모듈러 방식으로:
  `firebase.appCheck().newReactNativeFirebaseAppCheckProvider()`
  → `new ReactNativeFirebaseAppCheckProvider()`
- iOS App Check는 **`deviceCheck` 유지**. 현재 권장값인
  `appAttestWithDeviceCheckFallback`은 Firebase 콘솔에 App Attest 별도 등록이 필요해
  실기기 검증 후로 미룸 (`[TBD]` 주석으로 표시)
- Firestore/Storage 호출부는 처음부터 모듈러 API라 **수정 0건**

#### Fixed — iOS `pod install` 실패의 진짜 원인 규명
- 범인은 **`use_modular_headers!`** 였다. 1차 실패("Swift pods cannot yet be integrated
  as static libraries")를 넘기려 전역으로 켰는데, gRPC-Core의 헤더 배치와 맞지 않아
  `Pods/Headers/Private/grpc/gRPC-Core.modulemap not found`를 낳았다.
  **패치를 벗길 때마다 다음 불일치가 드러나던 "양파 까기"의 근원.** Xcode 26 자체의 문제가 아니었다
- `ios/Podfile` — `use_modular_headers!` 제거 → RNFB 공식 권장인 **static framework 링크**로 전환
  (`$RNFirebaseAsStaticFramework = true` + `use_frameworks! :linkage => :static`,
   `USE_FRAMEWORKS` 환경변수로 재정의 가능)
- gRPC 3타깃(`gRPC-C++`/`gRPC-Core`/`BoringSSL-GRPC`)의 `CLANG_ENABLE_EXPLICIT_MODULES=NO`
  **post_install 패치 전량 제거**
- ✅ `pod install --repo-update` 통과 — firebase-ios-sdk **12.15.0**, gRPC-C++ 1.69.0
- `project.pbxproj` — 링크 산출물이 `libPods-*.a`(static library) → `Pods_*.framework`로 자동 갱신
- `PrivacyInfo.xcprivacy` — 파일 타임스탬프 API 사유 `3B52.1` 추가(pod install 갱신분)

#### Docs
- `docs/06_iOS_BUILD_NOTES.md` — §2에 **4~7차 시도 이력**과 원인 규명 추가
- `docs/09_RNFB_UPGRADE.md` — 신규. "왜 25이고 26이 아닌가" 판단 근거와 실행 순서
- `docs/08_DEPLOY.md` — §3이 아직 "26으로 올려라"로 남아 있어 **25 결정에 맞게 정정**,
  §2-1의 지도 SDK `[TBD]`도 Google Maps 결정 반영, §1에 Firebase CLI 계정 함정 추가

#### 검증
- `tsc --noEmit` 0 error / `eslint` 0 error
- ✅ 안드로이드 실기기 실행 정상 (업그레이드 후에도 깨지지 않음)
- ⏳ **미검증: iOS Xcode 실기기 빌드.** `use_frameworks!`는 *모든* pod의 링크 방식을 바꾸므로
  `react-native-screens` / `image-picker` / `safe-area-context`에서 새 에러가 날 수 있다.
  실패 시 **임의 패치 금지** — 에러 원문을 `docs/06_iOS_BUILD_NOTES.md` §2 표에 누적 기록할 것


### 📅 2026-08-04 — 앱 단순화 + 마이페이지 개편 + 등반일지 신규

#### Changed — 4탭 체제로 축소 (웹·앱 공통)
- 유지: **개념도 / 지도 / 루트제보 / 마이페이지**. 제거: 홈 · 게시판 · 크루
- 화면 **파일은 보존**하고 라우팅만 해제 (되돌리기 쉽도록). 기존 URL은 `/map`으로 리다이렉트
- 로그인 후 첫 화면 = 지도
- 앱: `ReportListScreen`을 '루트제보' 탭으로 승격(기존엔 탭 없음)
- 제거된 라우트 타입은 남겨둠 — 보존한 화면 파일이 참조하므로 지우면 타입체크가 깨진다

#### Changed — 마이페이지 등급/포인트 전면 제거
- 등급(Level) · 다음 등급까지 남은 점수 · 포인트(Point) 표시 제거
- `ProfileWithCrown`(왕관 + 등급 테두리) → 신규 `Avatar`(단순 원형)로 교체
  (마이프로필 · 프로필 헤더 · 제보 카드). ProfileWithCrown 파일은 보존
- 웹 '내 게시글/댓글 프로필 일괄 갱신' 버튼 제거 (게시판이 빠짐)
- `users.level` / `users.point`는 **Firestore에 그대로 둔다** — 타입에 `@deprecated`만 표시

#### Added — 프로필 사진 변경 (앱)
- `react-native-image-picker` 도입 + `services/profilePhoto.ts`
- 경로는 웹과 동일 `profile_photos/{uid}.jpg`, 512x512로 리사이즈 후 업로드
  (2026-08-03 Storage 한도 초과 경험 반영)

#### Added — 등반일지 (신규 기능, 웹·앱)
- 새 컬렉션 `users/{uid}/climbing_logs` — **날짜별 1건**
  (같은 루트 재방문이 많아 루트당 1건인 `my_routes`로는 불가)
- 필드는 사용자 스프레드시트와 1:1: 날짜(+종료일) / 장소 / 루트명 / 소요장비 /
  등반 소요시간 / 참석자 / 등반내용 및 특이사항
- 마이페이지 'MY ROUTE' 탭 → **'등반일지' 탭**으로 대체 (검색 + 작성/수정/삭제)
- 개념도 목록의 ✎ 버튼 / 상세의 '등반일지 쓰기' 버튼 → 장소·루트명 자동 입력
- 즐겨찾기(★, `my_routes`)는 개념도에 그대로 유지
- 앱: 날짜는 `YYYY-MM-DD` 텍스트 입력 (date picker 의존성 추가 회피, [TBD])

#### Added — iOS 사전 준비 (빌드는 여전히 보류 트랙)
- `ios/RouteFinding/Info.plist`
  - `NSLocationWhenInUseUsageDescription` **값이 빈 문자열**이던 것을 실제 문구로 채움
    (빈 값은 App Store 심사 거부 사유)
  - `NSPhotoLibraryUsageDescription` 추가 — 없으면 image-picker 사용 시 iOS에서 크래시
- `docs/06_iOS_BUILD_NOTES.md`
  - **§0 재시도 트리거 충족 기록**: RNFB 24.0.0 → 최신 **26.1.0**(2026-08-03 릴리스).
    보류 사유였던 "생태계가 Xcode 26.x를 지원해야 함" 조건이 해소됐을 가능성이 높다.
    단 메이저 2단계 업그레이드라 breaking change 확인 필수 — **임의 업그레이드 금지**
  - **§0-1 v2 리뉴얼 반영분 체크리스트** 신설: Android 전용으로 쌓인 변경 중
    iOS에서만 문제될 수 있는 항목(pod install 재실행, 사진 업로드 URI, 키보드 회피,
    날짜 입력 등) 정리
- 확인만 하고 손대지 않은 것: `GoogleService-Info.plist`(Android와 동일 프로젝트 ✅),
  AppDelegate `[FIRApp configure]` ✅, App Check DeviceCheck 분기 ✅

#### Added — 루트제보 좌표 입력 개선 (웹)
- 위도/경도 칸에 **[📍 현재위치] · [🗺 지도에서 선택]** 버튼 배치
  (지도 선택 기능은 원래 있었으나 화면 위쪽에 떨어져 있고 안내문구가
   "어프로치 기록시 자동입력"이라 못 쓰는 것처럼 보였다)
- **어프로치 실시간 기록 섹션 제거**, GPX 파일 업로드는 유지(사용자 결정)
- 좌표를 지워버리던 `watch(trackingPath, ..., {immediate:true})` 제거

#### Added — 개념도 사진 등록 + 라인 그리기 (웹)
- 새 컬렉션 `concept_photos` — 사진 + 라인/텍스트를 **좌표(0~1 정규화)로 저장**.
  원본 사진은 손대지 않아 나중에 선만 고치거나 지울 수 있다
- `components/ConceptPhotoOverlay.vue` — 읽기전용 SVG 오버레이.
  ResizeObserver로 컨테이너를 재서 썸네일/전체화면 어디서든 정확히 겹쳐 그린다
- `components/ConceptPhotoEditor.vue` — 촬영(`capture="environment"`)/첨부 →
  펜·텍스트·기본색 6종·되돌리기·전체지우기 → 저장
- 개념도 **목록 카드에 📷 버튼**, **상세에 '📷 사진 등록' 버튼**
- 승인 흐름: 등록 시 `pending` → 승인 전에는 **본인과 관리자만 조회**(보안 규칙이 보장) →
  관리자가 **승인·추가 / 승인·기존 교체 / 반려** 선택. 본인은 승인 전까지 삭제 가능
- Storage 경로는 기존 규칙(`route_images/{산}/{구역}/{루트}/{파일}`)에 맞춰
  storage.rules 변경 불필요

#### 🚨 배포 필요 — 사용자 조치
- `firestore.rules`에 `users/{userId}/climbing_logs` 규칙을 추가했다. **배포 전에는 저장이 거부된다.**
  ```
  firebase deploy --only firestore:rules
  ```
- `firestore.rules`에 `concept_photos` 규칙도 추가했다(2026-08-04 2차). 같은 명령으로 함께 배포된다.

#### 검증
- `tsc --noEmit` 0 error / `eslint` 0 error(경고 23, 기존 컨벤션 범위)
- 웹 SFC 컴파일 6개 파일 통과
- ⏳ 미검증: 에뮬레이터 런타임, 웹 등반일지 저장(규칙 배포 후)


### 📅 2026-08-03 — 개념도 리뉴얼 1단계: "찾아서 보기"

> **방향 결정(사용자)**: 개념도를 **단순하게** 재설계.
> 1단계 = 기존 개념도 찾아서 보기 / 2단계(P1) = 개념도 추가 + 사진 위 라인 그리기 + 사용자 간 공유.
> 적용 범위: **RN 앱 v2 + 웹 동시**. 데이터는 **기존 컬렉션 그대로**(스키마 변경 0).

#### Added — RN 앱 (`app/src`)
- `types/concept.ts` — 개념도 모델 + 표시 헬퍼(`conceptImages`/`conceptTitle`/`conceptLengthLabel`/`conceptSearchIndex`)
- `services/conceptService.ts` — `route_reports`+`bouldering_reports`의 `status=='approved'` 병합 조회.
  단일 where만 사용(복합 색인 불필요) / 5분 TTL 캐시 / `Promise.allSettled`로 **부분 실패 허용**
- `screens/route/hooks/useConcepts.ts` — 로딩·새로고침·검색(공백 AND 토큰)·타입 칩 상태
- `screens/route/ConceptListScreen.tsx` — 플레이스홀더 → **실화면**. 검색 한 줄 + 전체 리스트 + 당겨서 새로고침
- `screens/route/components/ConceptCard.tsx` — 썸네일 + "등반지 · 구역 · 루트명" + 타입/난이도/길이
- `screens/route/ConceptDetailScreen.tsx` — 사진 캐러셀 + 기본정보 + 피치 목록 (`source` 미지정 시 두 컬렉션 순차 시도 = 딥링크 대비)
- `screens/route/components/ConceptImageViewer.tsx` — 전체화면 뷰어(가로 스와이프, RN 빌트인 Modal — 외부 lib 0)

#### Changed
- `navigation/types.ts` — `ConceptDetail: { conceptId, source? }` 라우트 추가
- `navigation/MainNavigator.tsx` — `ConceptDetail` 플레이스홀더 → 실화면 등록
- 웹 `src/views/ConceptListView.vue` — **4단계(칩→등반지→구역→검색) → 1단계(검색 한 줄)** 로 단순화.
  두 컬렉션 병합 로드 + 클라이언트 필터. 즐겨찾기/관리자 수정·삭제/이미지 뷰어/지도 클러스터 진입(`?ids=`)은 유지

#### Docs
- `docs/02_DATA_MODEL.md` — §6에 **실측 정정** 추가: 화면상의 "개념도"는 `concepts/{mountain}/routes`가 아니라
  `route_reports`/`bouldering_reports`를 읽는다 (+ `pitches` 배열 필드 vs 서브컬렉션 구분)
- `docs/04_WIREFRAMES.md` — 개념도 매핑 상태 ⏳ → ✅, 상세 화면 행 추가

#### Fixed / Changed — 실데이터 검증 후 정책 변경 (같은 날 후속)

> **실측**: 승인 루트가 **5,407건**. "50명 사용자 = 데이터도 작다"는 전제가 틀렸다.
> 웹에서 전량 렌더 시 이미지 요청이 동시에 5천 건 발생 → 브라우저가 감당 못해
> 썸네일이 전부 `@error` → `display:none` 으로 사라지는 증상 확인(사용자 스크린샷).

- **웹 `ConceptListView.vue`**
  - 전량 렌더 → **30개씩 무한 스크롤**(IntersectionObserver, rootMargin 600px)
  - `<img loading="lazy" decoding="async">` 추가
  - 이미지 로드 실패 시 `style.display='none'`(빈 회색 박스) → **'이미지 없음' 자리표시**로 대체
- **검색 전 목록 비노출** (사용자 결정): 검색어가 없으면 목록을 그리지 않고
  **Firestore 조회 자체를 첫 검색까지 지연** → 탭 진입만으로 발생하던 읽기 5,407회 → **0회**
  - 검색 전 화면: 안내 문구 + 예시 칩(북한산/인수봉/파주/무의도)
  - 지도 클러스터 진입(`?ids=`)은 예외로 검색 없이 즉시 표시(읽기 최대 10건)
- **RN `useConcepts.ts` / `ConceptListScreen.tsx`** — 동일 정책 적용.
  `startedRef` 가드로 첫 검색 시 1회만 로드, FlatList `initialNumToRender=10`/`windowSize=7`

#### 🚨 [QUESTION] — 사용자 확인 필요
1. **`firestore.rules`에 `bouldering_reports` 규칙 없음** → §9 전면 차단에 걸려 볼더링 조회가 실패할 수 있음.
   클라이언트는 방어했으나 규칙 추가는 별도 PR + 승인 필요.
2. 리뉴얼 2단계(사진 위 라인 그리기)용 라인 좌표 저장 위치·제스처 라이브러리 = 아직 [TBD].

#### 검증
- `tsc --noEmit` 통과(0 error) / `eslint` 0 error(경고 5, 기존 컨벤션 범위)
- 웹 `ConceptListView.vue` SFC 컴파일 검증 통과
- ⏳ **미검증**: 에뮬레이터 런타임 시각 검증 (다음 세션 첫 작업)

### 📅 2026-05-20 세션 종합

> **하루 성과**: Sprint 2-1 핵심 본문 4개 탭 완료 + ⑤ MyProfileTab [D] intro 편집. Sprint 2-1 진행도 **~80%**(잔여: [F] 사진 업로드, [E] 동기화 분석, ⑥ HomeScreen 부가, ⑦ UserProfile).
> 세션 작업 커밋 **5개**(+ 세션 종료 docs 커밋 1 = 6), 브랜치 `v2`: `bbe3fd0 → c8e3132`.

- **2-1-2 탭 본문 4종 완료** (모두 v1 1:1):
  1. `MyPostsTab` — posts where userId .snapshots() + UnreadBadge(N+1) — `5020b3c`
  2. `MyCommentsTab` — collectionGroup('comments') + PostTitle(N+1) + postId=ref.parent.parent.id — `6f4df3e`
  3. `MyReportsTab` — 두 컬렉션 머지(route_reports+bouldering_reports) + approved 제외 + timestamp desc + 권한별 액션 + `PromptModal`(공용) — `60716c9`
  4. `MyRouteTab` — users/{uid}/my_routes orderBy savedAt desc + 검색 + routeRef deref(N+1) + 삭제된 루트 처리 — `19a752a`
- **⑤ MyProfileTab [D] intro 편집** 완료 (`c8e3132`): 읽기전용 필드+등급+"다음 등급까지 N점"(`levelCalculator.ts` 1:1 포팅) + intro TextInput+저장.
- **공용 신규**: `PromptModal`(RN 빌트인 Modal, 외부 lib 0), `UnreadBadge`(MyPosts/MyComments 공용 추출)
- **신규 타입**: `post`/`notification`/`comment`/`report`/`myRoute` (전부 v1 실측 필드명)
- **02_DATA_MODEL 인라인 정정 6건**(스키마 불변, docs만): `posts.timestamp`·`notifications.{checked,postId,commentId,reportId,crewId}`·`comments.{text,timestamp,photoUrl}`·`route_reports.rejectionReason`+status'draft'·`my_routes.{savedAt,routeRef}`
- **🔍 자기진단·정정 1건**: 사용자 [B] 닉네임/[C] 등급 변경 작업 요청이 **v1엔 없는 기능**임을 분석 중 발견(my_profile_tab은 read-only) → 멈춤·보고·옵션 A로 정정(MVP 1:1 보존 강화)
- **🧅 양파 까기 0건** — 5/19(4건) 대비 큰 진전. typecheck+빌드 게이트 신뢰성 확립 + v1 코드 사전 정밀 분석 효과
- **검증 모드 전환**: 각 탭마다 시각 검증 → 일괄 모드(typecheck+빌드 게이트만 통과 시 진행). 5/19 누적 검증으로 게이트 신뢰성 입증됨
- **다음 세션 첫 작업**: 일괄 시각 검증 → ⑤[F] 사진 업로드(양파 위험 구간, 보고 후 신중 진행)

### 📅 2026-05-19 세션 종합

> **하루 성과**: Phase 0 마무리 → **Phase 1 (Android) 완료 + 런타임 검증** → Phase 2-1 진행분.
> 세션 작업 커밋 **11개**(+ 세션 종료 docs 커밋 1 = 12), 브랜치 `v2`: `8bcbaaa → 8d837a9`.

- **Phase 1 완료(Android 기준)**: RN 0.76.9 초기화 → Firebase(Android) → 네비(RNav7) → 상태관리(Zustand) → 디자인 시스템(하이브리드) → 인증 화면(v1 1:1 이메일 게이트). 에뮬레이터 런타임 검증 통과.
- **Phase 2-1 진행분**: 네비 정정 + 스키마 정정 + ProfileWithCrown + MyPage 갓파일 분해 착수.
- **🔍 자기진단·정정 패턴**:
  - **4→5탭 정정**: Phase 1-3 탭 구조를 미사용 dead code(`bottom_nav_bar.dart`) 근거로 잘못 구현 → v1 실제(`home_screen.dart` 5탭) 발견·정정·이력 기록.
  - 스키마 타입 오류 정정(`photoUrl`/`level:string`/`intro`), `bouldering_reports` 미문서화 발견·보강.
- **🧅 "양파 까기"/이슈 해결 4건**(추측 패치 금지, 멈춤·보고 원칙 준수):
  1. yarn Berry/홈 설정 충돌 → Berry 3.6.4 통일
  2. iOS Xcode 26.3 ↔ gRPC (ScanDependencies→_stdio.h→modulemap) → **iOS 보류 트랙**(`06_iOS_BUILD_NOTES.md`)
  3. RN 0.76 ↔ react-native-screens 4.25 codegen → 4.4.0 핀
  4. async-storage 3.x Android 빌드 실패 → 제거(결정 A 일관)
  5. (보너스) Notifee 빨간화면 = 의존성 무관, 좀비 Metro 스테일 번들 → 포트 정리
- **결정 확정**: 패키지명(기존 유지)·RN 0.76.9·Node 20·yarn Berry·Zustand·디자인토큰(하이브리드)·이미지피커(react-native-image-picker, 미설치)·App Check(Play Integrity/DeviceCheck+debug).
- **별도 트랙/연기**: iOS 빌드(1-2.5), FCM(Phase 3), 영상 스플래시·top-tab 라이브러리·아이콘 라이브러리([TBD]).

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

### 🧗 Phase 2-1 ④ MyPage 갓파일 분해 착수 (2026-05-19)

#### Added
- `mypage_screen.dart`(1163줄) 분해 골격: `screens/profile/MyPageScreen.tsx`(컨테이너) + `components/ProfileHeader.tsx`(실구현: ProfileWithCrown+닉네임+intro+로그아웃) + 5탭 컴포넌트(`MyReportsTab/MyPostsTab/MyCommentsTab/MyRouteTab/MyProfileTab` placeholder) + `hooks/useMyPage.ts`(authStore uid→userStore.fetchProfile)
- 탭 스위처: v1 TabBar 라벨 1:1(`내 제보 관리/내글/내댓글/MY ROUTE/마이프로필`), 경량 커스텀 구현(@react-navigation/material-top-tabs 미도입 — 새 의존성 결정 회피)
- 이전 MyPageScreen placeholder → 분해 컨테이너로 교체 (MainTabNavigator idx4 그대로 연결)
- ✅ typecheck, ✅ Android `assembleDebug`

#### 잔여 (후속)
- 5탭 본문 실구현(Reports/Posts/Comments/Routes), MyProfileTab은 image-picker(react-native-image-picker 확정) 도입 시
- 알림 아이콘(Phase 3), 출석보상(P1), `_updateAllPostsAndCommentsProfile` 비정규화 동기화

### 📝 Phase 2-1 2-1-2-① MyPostsTab (2026-05-20)

#### Added
- `MyPostsTab.tsx` 구현 — v1 `_buildMyPostsTab` 1:1: `posts where userId==uid .snapshots()`(orderBy/limit 없음 보존), ProfileWithCrown + 제목 + snippet(content 30자) + 날짜 + 빈 상태
- `UnreadBadge`(inline 서브컴포넌트) — `notifications where receiverId+checked==false+postId` 일회성 조회(N+1, v1 FutureBuilder 보존). 인덱스 누락 등 에러 시 `console.warn`만(앱 안 깸)
- 신규 타입: `types/post.ts`, `types/notification.ts` (v1 실측 필드명)
- 신규 유틸: `utils/date.ts` (`formatDate` — v1 `_formatDate` 대응)
- 네비: `MainStack`의 `PostDetail`로 push (현재 placeholder, Phase 2-2에서 실구현)
- ✅ typecheck, ✅ Android `assembleDebug`

#### Fixed (스키마 인라인 정정 — 점진 처리, Firestore 구조 불변)
- `posts.timestamp` (v1 실측, ~~`createdAt`~~) — 02_DATA_MODEL §2 정정
- `notifications.checked` (v1 실측, ~~`isRead`~~), `postId`/`commentId`/`reportId`/`crewId` (v1 실측, ~~`target*Id`~~) — 02_DATA_MODEL §7 정정
- 나머지(comments.timestamp, my_routes.savedAt, route_reports.rejectionReason)는 해당 탭 구현 시 정정

### 💬 Phase 2-1 2-1-2-② MyCommentsTab (2026-05-20)

#### Added
- `MyCommentsTab.tsx` 구현 — v1 `_buildMyCommentsTab` 1:1: `collectionGroup('comments') where userId==uid orderBy timestamp desc .snapshots()` (인덱스 firestore.indexes.json 정의 확인됨)
- 아이템: 본인 ProfileWithCrown + **원본 글 제목**(`PostTitle` inline 서브컴포넌트, posts/{postId}.get per item N+1, v1 보존) + 댓글 본문(2줄) + 날짜 + 알림 배지
- postId 추출: `doc.ref.parent.parent.id` (경로 posts/{postId}/comments/{commentId})
- 신규 타입: `types/comment.ts` (v1 실측: `text`, `timestamp`, `photoUrl`)
- 공용 컴포넌트 **`UnreadBadge` 추출** — MyPostsTab의 inline 배지를 `components/common/UnreadBadge.tsx`로 일반화(`field: 'postId'|'commentId'|'reportId'|'crewId'`). MyPostsTab도 공용 사용으로 교체(중복 제거)
- onTap → 원본 PostDetail로 push
- ✅ typecheck, ✅ Android `assembleDebug`

#### Fixed (스키마 인라인 정정)
- `comments.text` (v1 실측, ~~`content`~~), `comments.timestamp` (~~`createdAt`~~), `comments.photoUrl` (~~`authorProfileUrl`~~) — 02_DATA_MODEL §3 정정

### 🧗 Phase 2-1 2-1-2-③ MyReportsTab (2026-05-20)

#### Added
- `MyReportsTab.tsx` — v1 `_buildMyReportsTab` 1:1. **두 컬렉션 동시 구독**(`route_reports` + `bouldering_reports` where `authorUid==uid`), 머지 후 `status!=='approved'` 필터(+v1 의도 보존) + `timestamp desc` 정렬. 컬렉션 태그(`Report.collection`)로 **삭제 시 안전 분기**(v1 휴리스틱 대체)
- `ReportCard.tsx` — v1 `_buildReportCard` 1:1: 썸네일(`imageUrls[0]`)+`산·루트명`+ProfileWithCrown+상태 뱃지+반려사유(rejected 시)+액션
- `ReportActions.tsx` — 권한별 액션: 삭제(본인||관리자, Alert 확인) / 승인(관리자&pending, 직접 update — v1 1:1 무확인) / 반려(관리자&pending, PromptModal). 승인·반려는 `route_reports`에만 적용(v1 동일)
- `PromptModal.tsx`(공용) — RN 빌트인 `Modal`+`Input`+`Button` 자체구현(Alert.prompt iOS-only 우회, 새 의존성 0). 향후 다른 입력 다이얼로그에서 재사용
- `types/report.ts` — `Report`/`ReportStatus`/`ReportCollection` + `statusToKorean`(v1 매핑). 상태색은 테마 의미 슬롯(disabled/warning/success/error)에 1:1 매핑
- 작성자 N+1 제거(이 탭은 본인 제보만 → ProfileHeader profile 재사용)
- ✅ typecheck, ✅ Android `assembleDebug`

#### Fixed (스키마 인라인 정정)
- `route_reports.rejectionReason` (v1 실측, ~~`rejectReason`~~) + status 'draft' 기본값 추가 — 02_DATA_MODEL §4 정정

### 🥾 Phase 2-1 2-1-2-④ MyRouteTab (2026-05-20)

#### Added
- `MyRouteTab.tsx` — v1 `_buildMyRouteTab` 1:1: `users/{uid}/my_routes orderBy savedAt desc .snapshots()` + 상단 검색 TextInput(클라이언트 필터, post-deref 매칭 v1 동일)
- `MyRouteCard.tsx` — v1 `_myRouteTile` 1:1: `routeRef` deref(N+1, getDoc)로 현재 mountain/routeName/imageUrl 표시, `routeRef` 없으면 저장 스냅샷, 삭제 시 "삭제된 루트입니다." 표시. 삭제(Alert 확인) + onTap → RouteDetail({reportId: routeRef.id ?? myRouteId}) placeholder
- `types/myRoute.ts` — `routeRef`(modular `DocumentReference` 타입 — `getDoc(ref)` 직접 호출 가능), `savedAt` 등 v1 실측 필드
- ✅ typecheck, ✅ Android `assembleDebug`

#### Fixed (스키마 인라인 정정)
- `users/{uid}/my_routes.savedAt` (v1 실측, ~~`completedAt`~~) + `routeRef`(DocumentReference) 필드 명시 — 02_DATA_MODEL §1-1 정정

### 👤 Phase 2-1 2-1-2-⑤ MyProfileTab [D] intro 편집 (2026-05-20)

#### Added
- `MyProfileTab.tsx` 실구현 — v1 `widgets/my_profile_tab.dart` 1:1 (편집 가능 필드: intro만 / 사진은 [F])
- 읽기 전용 필드 v1 1:1: 닉네임 / 이메일 / **등급 + "다음 등급(X)까지 N점" 안내** / 포인트
- 한 줄 소개(intro) `Input` multiline + "소개글 저장" `Button` → `useUserStore.updateProfile(uid, { intro })` (Alert로 결과 안내)
- ProfileWithCrown 큰 사이즈 표시(편집 버튼 없음 — [F] 단계 추가)
- `utils/levelCalculator.ts` — v1 `constants/level.dart`의 `LEVEL_POINT_MAP` + `getNextLevel` + `getRemainToNextLevel` 1:1 포팅
- `types/user.ts`에 `point?: number` 추가 (v1 실측)
- `KeyboardAvoidingView` + `ScrollView`(`keyboardShouldPersistTaps='handled'`)로 키보드 대응
- ✅ typecheck, ✅ Android `assembleDebug`

#### 정정 / 결정 사유 (v1 1:1 보존)
- **닉네임 변경([B])·등급 변경([C]) 작업 제외** — v1 my_profile_tab은 두 필드를 read-only로만 표시. 변경 기능 자체가 v1에 없음(`ProfileService.updateDisplayName`은 정의돼 있으나 미사용). 신기능 추가는 v2.1+ (CLAUDE.md MVP 원칙)
- **비정규화 동기화([E]) 보류** — v1도 MyProfileTab에서 자동 호출 안 함(`_updateAllPostsAndCommentsProfile`는 별도 트리거, 위치 추가 분석 필요). v1 동작 그대로 유지
- 등급은 v1 `calcLevel`에 따라 도메인 자동 계산 — 수동 변경은 데이터 무결성 깨뜨림(별도 이유)
- **[F] 프로필 사진(image-picker+Storage)은 양파 가능 구간으로 별도 보고 후 진행**

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
