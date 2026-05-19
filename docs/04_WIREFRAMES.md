# 🎨 04_WIREFRAMES.md — 와이어프레임 & 화면 매핑

> **목적**: 기존 Flutter 화면을 RN 화면으로 1:1 매핑하고, 각 화면의 와이어프레임/구조 문서화.
> **방법**: 화면 작업 시작 시 해당 섹션 채우기. 처음엔 매핑표만 있음.

---

## 📋 Flutter → RN 화면 매핑표

### 진행 상태 범례

| 아이콘 | 의미 |
|---|---|
| ⏳ | 대기 (아직 시작 안 함) |
| 🚧 | 작업 중 |
| ✅ | 완료 |
| 🚨 | 갓 파일 (1000줄+, 반드시 분해) |

---

### 1. 인증

| Flutter (v1) | RN (v2) | 라인 수 | 상태 |
|---|---|---|---|
| `lib/splash_screen.dart` | `app/src/screens/auth/SplashScreen.tsx` | - | ⏳ |
| `lib/login_screen.dart` | `app/src/screens/auth/LoginScreen.tsx` | 305 | ⏳ |
| `lib/sign_up_screen.dart` | `app/src/screens/auth/SignUpScreen.tsx` | 305 | ⏳ |

### 2. 메인

| Flutter | RN | 라인 수 | 상태 |
|---|---|---|---|
| `lib/main.dart` | `app/src/App.tsx` + `app/src/navigation/RootNavigator.tsx` | - | 🚧 골격(인증분기 스텁, Phase 1-4 authStore 연동 예정) |
| `lib/home_screen.dart` | `app/src/screens/home/HomeScreen.tsx` | - | ⏳ (v1에서 탭 아님) |
| `lib/bottom_nav_bar.dart` | `app/src/navigation/MainTabNavigator.tsx` | 50 | 🚧 4탭 골격 완료, 탭 화면은 플레이스홀더 |

### 3. 지도 / 루트

| Flutter | RN | 라인 수 | 상태 |
|---|---|---|---|
| `lib/map_screen.dart` | `app/src/screens/map/MapScreen.tsx` | 711 | ⏳ |
| `lib/map_input_screen.dart` | `app/src/screens/map/MapInputScreen.tsx` + 컴포넌트 분해 | **1618** | ⏳ 🚨 |
| `lib/route_screen.dart` | `app/src/screens/route/RouteListScreen.tsx` | - | ⏳ |
| `lib/concept_list_screen.dart` | `app/src/screens/route/ConceptListScreen.tsx` | 595 | ⏳ |
| `lib/generic_route_detail_screen.dart` | `app/src/screens/route/RouteDetailScreen.tsx` + 컴포넌트 분해 | **1402** | ⏳ 🚨 |
| `lib/pitch_detail_screen.dart` | `app/src/screens/route/PitchDetailScreen.tsx` | - | ⏳ |

### 4. 리포트

| Flutter | RN | 라인 수 | 상태 |
|---|---|---|---|
| `lib/route_report_list_screen.dart` | `app/src/screens/report/ReportListScreen.tsx` | - | ⏳ |
| `lib/route_report_admin_screen.dart` | `app/src/screens/report/ReportAdminScreen.tsx` | 326 | ⏳ |
| `lib/report_list_screen.dart` | (위와 통합 검토) | - | ⏳ |
| `lib/report_detail_screen.dart` | `app/src/screens/report/ReportDetailScreen.tsx` | - | ⏳ |

### 5. 트래킹

| Flutter | RN | 라인 수 | 상태 |
|---|---|---|---|
| `lib/screens/tracking_screen.dart` | `app/src/screens/tracking/TrackingScreen.tsx` | 422 | ⏳ |
| `lib/screens/approach_tracking_screen.dart` | `app/src/screens/tracking/ApproachTrackingScreen.tsx` | - | ⏳ |
| `lib/widgets/gpx_action_buttons.dart` | `app/src/components/common/GpxActionButtons.tsx` | - | ⏳ |

### 6. 크루

| Flutter | RN | 라인 수 | 상태 |
|---|---|---|---|
| `lib/crew_main_screen.dart` | `app/src/screens/crew/CrewMainScreen.tsx` | - | ⏳ |
| `lib/crew_create_screen.dart` | `app/src/screens/crew/CrewCreateScreen.tsx` | - | ⏳ |
| `lib/crew_detail_screen.dart` | `app/src/screens/crew/CrewDetailScreen.tsx` + 컴포넌트 분해 | **1049** | ⏳ 🚨 |
| `lib/crew_join_form_screen.dart` | `app/src/screens/crew/CrewJoinFormScreen.tsx` | - | ⏳ |
| `lib/crew_board_tab.dart` | `app/src/screens/crew/components/CrewBoardTab.tsx` | - | ⏳ |
| `lib/crew_post_detail_screen.dart` | `app/src/screens/crew/CrewPostDetailScreen.tsx` | 622 | ⏳ |
| `lib/crew_post_form_screen.dart` | `app/src/screens/crew/CrewPostFormScreen.tsx` | - | ⏳ |
| `lib/crew_post_write_screen.dart` | (위와 통합 검토) | - | ⏳ |
| `lib/CrewChatRoomScreen.dart` | `app/src/screens/crew/CrewChatScreen.tsx` | - | ⏳ |

### 7. 게시판

| Flutter | RN | 라인 수 | 상태 |
|---|---|---|---|
| `lib/board_screen.dart` | `app/src/screens/board/BoardScreen.tsx` | 443 | ⏳ |
| `lib/notice_board_screen.dart` | `app/src/screens/board/NoticeBoardScreen.tsx` | 313 | ⏳ |
| `lib/category_posts_screen.dart` | `app/src/screens/board/CategoryPostsScreen.tsx` | - | ⏳ |
| `lib/post_detail_screen.dart` | `app/src/screens/board/PostDetailScreen.tsx` | 990 | ⏳ |
| `lib/write_post_screen.dart` | `app/src/screens/board/WritePostScreen.tsx` | 290 | ⏳ |
| `lib/edit_post_screen.dart` | `app/src/screens/board/EditPostScreen.tsx` | 498 | ⏳ |
| `lib/comment_detail_screen.dart` | `app/src/screens/board/CommentDetailScreen.tsx` | 624 | ⏳ |

### 8. 사용자

| Flutter | RN | 라인 수 | 상태 |
|---|---|---|---|
| `lib/mypage_screen.dart` | `app/src/screens/profile/MyPageScreen.tsx` + 탭 분해 | **1163** | ⏳ 🚨 |
| `lib/user_profile_screen.dart` | `app/src/screens/profile/UserProfileScreen.tsx` | 351 | ⏳ |
| `lib/common/profile_with_crown.dart` | `app/src/components/common/ProfileWithCrown.tsx` | - | ⏳ |
| `lib/widgets/my_profile_tab.dart` | `app/src/screens/profile/components/MyProfileTab.tsx` | 291 | ⏳ |

### 9. 알림

| Flutter | RN | 라인 수 | 상태 |
|---|---|---|---|
| `lib/screens/notification_list_screen.dart` | `app/src/screens/notification/NotificationListScreen.tsx` | 285 | ⏳ |

### 10. 부가 위젯

| Flutter | RN | 라인 수 | 상태 |
|---|---|---|---|
| `lib/screens/image_editor_screen.dart` | `app/src/screens/editor/ImageEditorScreen.tsx` + 분해 | 734 | ⏳ |
| `lib/widgets/full_image_screen.dart` | `app/src/components/modals/FullImageScreen.tsx` | - | ⏳ |
| `lib/widgets/fullscreen_photo_viewer.dart` | `app/src/components/modals/FullscreenPhotoViewer.tsx` | - | ⏳ |
| `lib/widgets/watermarked_image.dart` | `app/src/components/common/WatermarkedImage.tsx` | - | ⏳ |

### 11. 서비스 / 유틸 / 상수

| Flutter | RN | 비고 |
|---|---|---|
| `lib/auth_service.dart` | `app/src/services/auth.ts` | 🚨 services/와 중복 → 통합 |
| `lib/services/auth_service.dart` | (위에 통합) | |
| `lib/services/profile_service.dart` | `app/src/services/profile.ts` | |
| `lib/services/upload_service.dart` | `app/src/services/upload.ts` | |
| `lib/utils.dart` | `app/src/utils/index.ts` | |
| `lib/utils/colored_polylines.dart` | `app/src/utils/coloredPolylines.ts` | |
| `lib/utils/image_url_helper.dart` | `app/src/utils/imageUrl.ts` | |
| `lib/utils/update_checker.dart` | `app/src/utils/updateChecker.ts` | |
| `lib/image_helper.dart` | `app/src/utils/image.ts` | |
| `lib/firebase_options.dart` | `app/src/services/firebase.ts` | RN Firebase는 자동 설정 |
| `lib/constants/firestore_fields.dart` | `app/src/constants/firestoreFields.ts` | |
| `lib/constants/level.dart` | `app/src/constants/level.ts` | |

---

## 🎨 화면별 와이어프레임 (작업 진행 시 채워나감)

> 각 화면 작업 시작 시 이 섹션에 와이어프레임 추가.
> 처음엔 비어있고, 화면을 다룰 때마다 하나씩 추가한다.

### 예시 템플릿

```markdown
### [화면명] (예: 로그인 화면)

**Flutter 원본**: `lib/login_screen.dart`
**RN 대상**: `app/src/screens/auth/LoginScreen.tsx`
**상태**: 🚧 작업 중 (2026-05-19 시작)

#### 와이어프레임

```
┌─────────────────────┐
│      [LOGO]         │
│                     │
│  ┌───────────────┐  │
│  │ 이메일         │  │
│  └───────────────┘  │
│  ┌───────────────┐  │
│  │ 비밀번호       │  │
│  └───────────────┘  │
│                     │
│  [   로그인   ]     │
│                     │
│  비밀번호 찾기      │
│  회원가입            │
└─────────────────────┘
```

#### 컴포넌트 구조

- `LoginScreen` (메인)
  - `LogoHeader` (재사용 가능)
  - `EmailInput` (재사용 가능)
  - `PasswordInput` (재사용 가능)
  - `PrimaryButton` (재사용 가능)
  - `TextLink` (재사용 가능, 비밀번호 찾기/회원가입)

#### 상태 (state)

- `email: string`
- `password: string`
- `isLoading: boolean`
- `errorMessage: string | null`

#### Firebase 연동

- `signInWithEmailAndPassword(email, password)`
- 성공 시: `navigation.replace('Main')`
- 실패 시: 에러 메시지 표시

#### 마이그레이션 노트

- Flutter의 `TextEditingController` → RN의 `useState`
- Flutter의 `Scaffold` → RN의 `SafeAreaView` + `KeyboardAvoidingView`
- 키보드 회피 처리 (iOS/Android 다름)
```

---

## 🧩 갓 파일 분해 가이드

### `map_input_screen.dart` (1618줄) → 분해 계획

[TBD] Flutter 코드 분석 후 작성. 예상 구조:

```
MapInputScreen.tsx                 ← 메인 (300~400줄)
├── components/
│   ├── MapView.tsx                ← 지도 뷰
│   ├── MarkerForm.tsx             ← 마커 입력 폼
│   ├── GpxUploader.tsx            ← GPX 업로드
│   ├── ApproachDrawer.tsx         ← 접근로 그리기
│   ├── PhotoUploader.tsx          ← 사진 업로드
│   └── DifficultySelector.tsx     ← 등급 선택기
└── hooks/
    ├── useMapInput.ts             ← 메인 상태 훅
    └── useGpxUpload.ts            ← GPX 업로드 훅
```

### `generic_route_detail_screen.dart` (1402줄) → 분해 계획

[TBD] 예상 구조:

```
RouteDetailScreen.tsx              ← 메인 (300~400줄)
├── components/
│   ├── RouteHeader.tsx            ← 상단 정보
│   ├── RouteTopoSection.tsx       ← 토포 이미지
│   ├── RouteInfoSection.tsx       ← 등급/길이 등
│   ├── PitchListSection.tsx       ← 피치 목록
│   ├── ReviewSection.tsx          ← 후기
│   └── ActionButtons.tsx          ← 액션 버튼들
└── hooks/
    └── useRouteDetail.ts
```

### `mypage_screen.dart` (1163줄) → 분해 계획

[TBD] 예상 구조:

```
MyPageScreen.tsx                   ← 메인 (200~300줄, 탭 컨테이너)
├── components/
│   ├── ProfileHeader.tsx          ← 프로필 헤더
│   ├── tabs/
│   │   ├── MyRoutesTab.tsx        ← 내 등반 기록
│   │   ├── MyPostsTab.tsx         ← 내 글
│   │   ├── MyCommentsTab.tsx      ← 내 댓글
│   │   └── SettingsTab.tsx        ← 설정
│   └── modals/
│       └── EditProfileModal.tsx
└── hooks/
    └── useMyPage.ts
```

### `crew_detail_screen.dart` (1049줄) → 분해 계획

[TBD] 예상 구조:

```
CrewDetailScreen.tsx               ← 메인 (200~300줄)
├── components/
│   ├── CrewHeader.tsx
│   ├── tabs/
│   │   ├── CrewInfoTab.tsx
│   │   ├── CrewMembersTab.tsx
│   │   ├── CrewBoardTab.tsx       ← 기존 widget 활용
│   │   └── CrewChatTab.tsx
│   └── modals/
│       └── ManageMembersModal.tsx
└── hooks/
    └── useCrewDetail.ts
```

---

## 🗺️ 네비게이션 구조

> ✅ Phase 1-3에서 골격 구현·Android 빌드 검증 완료 (화면은 플레이스홀더, Phase 2에서 교체).
> ⚠️ **정정**: 기존 문서는 5탭(Home/Map/Board/Crew/MyPage)으로 가정했으나,
> Flutter v1(`git show main:lib/bottom_nav_bar.dart`) 실측 결과 **4탭**이다.
> CLAUDE.md 1:1 보존 원칙에 따라 v1 4탭을 그대로 재현한다.

### v1 하단 탭 실측 (lib/bottom_nav_bar.dart)

| idx | 라벨 | v1 라우트 | v2 탭 화면 |
|---|---|---|---|
| 0 | 게시판 | `/board` | `screens/board/BoardScreen.tsx` (NoticeBoardScreen) |
| 1 | 개념도 | `/` | `screens/route/ConceptListScreen.tsx` |
| 2 | 지도 | `/reports` | `screens/report/ReportListScreen.tsx` (⚠️ 라벨=지도, 실제=리포트목록) |
| 3 | 마이페이지 | `/mypage` | `screens/profile/MyPageScreen.tsx` |

> Home 탭·Crew 탭은 v1 하단바에 **없음**. HomeScreen은 존재하나 탭 아님. 크루는 비탭 경로(push)로 진입.

```
RootNavigator (인증 분기 — Phase 1-4 authStore 연동 예정)
├── AuthStack (미인증)        Splash → Login → SignUp
│
└── MainStack (인증됨)
    ├── MainTabs (v1 4탭)
    │   ├── BoardTab   → BoardScreen      (게시판)
    │   ├── ConceptTab → ConceptListScreen (개념도)
    │   ├── MapTab     → ReportListScreen  (지도=리포트목록)
    │   └── MyPageTab  → MyPageScreen      (마이페이지)
    │
    └── Push/Modal (비탭 진입 — 딥링크 대비 param 타입화, FCM 연동은 Phase 3)
        ├── RouteDetail/ReportDetail/PitchDetail/ReportAdmin
        ├── PostDetail/CommentDetail/WritePost/EditPost
        ├── CrewMain/CrewDetail/CrewChat   (크루 진입)
        └── UserProfile/Tracking/ApproachTracking/MapInput/ImageEditor/NotificationList
```

> 딥링크: `src/navigation/types.ts`의 param에 식별자(id) 타입화로 구조만 대비.
> 실제 React Navigation `linking` config + FCM 연동은 Phase 3.

---

## ✅ 사용 흐름 (User Flow)

> 각 흐름은 작업 시 와이어프레임과 함께 추가.

### 1. 첫 진입 흐름 ✅ (Phase 1-3/1-4 store 연동 반영)

```
앱 실행 → App.tsx
       ├─ initAppCheck()                         (App Check 1회)
       └─ useAuthStore.initialize()              (onAuthStateChanged 구독 시작)
                 ↓
        RootNavigator (useAuthGate ← authStore)
                 ↓
        isInitializing == true ? → SplashScreen 표시 (세션 복원 대기)
                 ↓ (첫 onAuthStateChanged 수신)
          isAuthenticated ?
            ├── false → AuthStack (Splash→Login→SignUp)
            └── true  → MainStack (4탭: 게시판/개념도/지도/마이페이지)

로그인 성공: authStore.signIn() → Firebase → onAuthStateChanged →
            store 갱신 → RootNavigator 자동으로 MainStack 전환
재시작:     RNFB 네이티브 세션 복원 → onAuthStateChanged → 자동 로그인
            (별도 persist 없음 = 단일 출처, v1 FirebaseAuth.currentUser 동등)
```

> store 매핑: `authStore`(인증 세션·액션) / `userStore`(`users/{uid}` 프로필).
> 영상 스플래시(react-native-video)·실제 Login UI는 Phase 2에서 교체.

### 2. 루트 검색 흐름 [TBD]

### 3. 등반 기록 흐름 [TBD]

### 4. 게시글 작성 흐름 [TBD]

### 5. 크루 가입 흐름 [TBD]

---

*화면 작업 시 해당 섹션에 와이어프레임/상세 사양 추가. 작업 완료 시 상태를 ✅로 변경.*
