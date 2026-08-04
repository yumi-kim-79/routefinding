# 🛠️ 03_TECH_STACK.md — 기술 스택 명세서

> **원칙**: RideTalk과 동일한 스택을 채택해 두 앱 일관 유지보수.
> **출처**: [yumi-kim-79/ridetalk](https://github.com/yumi-kim-79/ridetalk) `CLAUDE.md` 기준.

---

## 🎯 개발 환경

| 항목 | 버전/요구사항 |
|---|---|
| Node.js | **20.x LTS** (Phase 1 검증: v20.20.2, nvm 전환) |
| 패키지 매니저 | **yarn 3.x (Berry)** — corepack + `app/package.json`의 `packageManager: yarn@3.6.4`로 고정 |
| React Native | **0.76.9** (핀 고정 — docs "0.74+" 조건 충족, 0.76 라인 최종 패치 = 안정) |
| TypeScript | 5.0.4 (RN 0.76.9 템플릿 기본) |
| Xcode (iOS) | **15+** |
| Android Studio | **Hedgehog+** (2023.1+) |
| Firebase CLI | 최신 |
| Git | 최신 |

자세한 셋업은 `GETTING_STARTED.md` 참조.

### ✅ Phase 1 확정 결정 (2026-05-19)

> Phase 1 RN 초기화 시 사용자 결정으로 확정. 이전 `[TBD]`/`[QUESTION]` 항목 해결분 반영.

| 항목 | 결정 | 사유 |
|---|---|---|
| **패키지명 (번들 ID)** | Android `com.yusung.routefinding` / iOS `com.yusungyun.RouteFinding` — **기존 v1 그대로 유지** | 기존 Firebase 앱 재등록 불필요, 50명 유저 무중단 전환. v1에서 이미 양 플랫폼 불일치 → v2.x에서 점진 통일 검토 |
| **RN 버전** | `0.76.9` 핀 고정 | "0.74+" 충족, 0.76 라인 최종 패치(안정), New Architecture 기본 |
| **Node** | 20.x LTS (v20.20.2) | docs 명세 준수, RN 0.76 검증 조합. 시스템 기본은 v24 → nvm으로 전환 |
| **패키지 매니저** | **yarn Berry 3.6.4** (당초 classic 1.22 계획에서 변경) | 시스템 환경이 이미 Berry로 통일됨(다른 Vue/Firebase 프로젝트), classic yarn은 deprecated, 매번 `YARN_IGNORE_PATH=1` 우회 부담 제거. 모던 기준 |

> ⚠️ Android `namespace`/Java 패키지도 `com.yusung.routefinding`로 전체 리네임 완료 (applicationId와 일치). iOS 테스트 타깃 번들 ID는 `com.yusungyun.RouteFinding.tests`.

### ⚠️ iOS 빌드 환경 이슈 (Phase 1-2, 미해결 — 보류)

> 상세 시도 기록·재시도 체크리스트는 **`docs/06_iOS_BUILD_NOTES.md`** 참조.

| 항목 | 값 |
|---|---|
| Xcode | 26.3 (Build 17C529) — **bleeding-edge** |
| iOS Simulator SDK | 26.2 |
| RNFB | 24.0.0 |
| firebase-ios-sdk | 12.10.0 (Firestore가 gRPC-C++/Core 의존) |

- **증상**: Android는 정상 빌드. iOS는 Firestore의 gRPC pod이 최신 Xcode 툴체인과 충돌해 빌드 실패(에러가 단계적으로 전이: gRPC ScanDependencies → `_stdio.h` → `gRPC-Core.modulemap not found`).
- **현재 적용된 패치**: `ios/Podfile`에 `use_modular_headers!`, `post_install`에서 gRPC 계열 타깃 `CLANG_ENABLE_EXPLICIT_MODULES=NO`.
- **결정**: iOS 보류, Android 우선 (`05_ROADMAP.md` 1-2.5). 생태계가 Xcode 26.x를 따라올 때까지 대기가 시간 효율적.
- **향후 iOS 재시도 시 시도 순서(메모)**:
  1. RNFB / firebase-ios-sdk 최신 버전으로 업그레이드 후 패치 제거하고 재빌드 (생태계 추격됐는지 우선 확인)
  2. (안 되면) gRPC modulemap 보정 — gRPC 계열 일관 처리(`:modular_headers` 일관 적용 또는 HEADER_SEARCH_PATHS/modulemap 생성)
  3. (안 되면) `$FirebaseSDKVersion` 핀 다운(Xcode 26.x 검증된 gRPC 포함 구버전)
  4. (최후) Firestore만 분리하거나 Xcode 버전 조정 검토

---

## 📚 핵심 라이브러리 (잠정)

> ⚠️ 다음 라이브러리들은 **RideTalk 사용 패턴 확인 후 최종 확정**한다.
> 아래는 표준 RN + Firebase 스택 기준 잠정 선택.

### 🏗️ 코어

| 카테고리 | 패키지 | 용도 | 우선순위 |
|---|---|---|---|
| RN 코어 | `react-native@^0.74.0` | 프레임워크 | P0 |
| TypeScript | `typescript@^5.0.0` | 타입 시스템 | P0 |
| 네비게이션 | `@react-navigation/native@^6` | 라우팅 | P0 |
| 네비게이션 (스택) | `@react-navigation/native-stack` | 스택 네비 | P0 |
| 네비게이션 (탭) | `@react-navigation/bottom-tabs` | 하단 탭 | P0 |

### 🔥 Firebase (React Native Firebase)

| 패키지 | 용도 | 우선순위 |
|---|---|---|
| `@react-native-firebase/app` | Firebase 코어 | P0 |
| `@react-native-firebase/auth` | 인증 | P0 |
| `@react-native-firebase/firestore` | DB | P0 |
| `@react-native-firebase/storage` | 파일 저장 | P0 |
| `@react-native-firebase/messaging` | FCM | P0 |
| `@react-native-firebase/app-check` | 앱 무결성 | P1 |

> 📌 `firebase` (web SDK) 대신 **`@react-native-firebase/*`** 사용 (성능 + 네이티브 기능)

### 📱 UI / 상태관리

| 카테고리 | 패키지 (잠정) | 비고 |
|---|---|---|
| 상태관리 | ✅ **Zustand 5.0.x** (2026-05-19 확정) | 단독개발+50명 규모 적합, 보일러플레이트 적음, RN/TS 친화. RTK는 과함 |
| 영속(persist) | ❌ authStore 미적용 (Phase 1-4 결정 A) | Firebase Auth 네이티브 세션이 단일 출처. `@react-native-async-storage/async-storage`는 미사용이라 제거 — userStore 캐시 등 필요 시 **RN 0.76 호환 2.x**로 재도입 |
| 디자인 시스템 | ✅ 자체 구축 (`src/theme/`) — **하이브리드** 확정 (2026-05-19) | v1 색상값 보존 + M3 스타일 토큰 구조. 폰트=시스템 기본. 다크=placeholder(Phase 5) |
| 아이콘 | `react-native-vector-icons` 또는 `lucide-react-native` | [TBD] |
| 알림 | `notifee/react-native` | 로컬 알림 (FCM 표시) |
| 토스트 | `react-native-toast-message` | [TBD] |

### 🗺️ 지도 / 위치

| 패키지 | 용도 | 우선순위 |
|---|---|---|
| **`react-native-maps` 1.26.0** | 지도 (Google Maps) | P1 | ✅ **확정 2026-08-04** |
| ~~`@react-native-community/geolocation`~~ | GPS | — | ❌ **미도입**. 지도의 `onUserLocationChange`로 대체 — 네이티브 의존성을 늘리지 않기 위해 |
| ~~`react-native-permissions`~~ | 위치 권한 | — | ❌ **미도입**. Android는 RN 내장 `PermissionsAndroid`, iOS는 Info.plist + 지도 SDK가 처리 |
| `ngeohash` | Geohash 인코딩 | P1 |

> ⚠️ **지도 SDK 선택**: 기존 Flutter는 Google Maps. RideTalk은 Kakao Map.
> → routefinding은 **해외 등반지(예: 요세미티)**도 다룰 가능성 있으므로 Google Maps 유력.
> → [QUESTION] 사용자 결정 필요.

#### 🗺️ 지도 결정 상세 (2026-08-04)

**`react-native-maps@1.26.0` — 버전을 반드시 고정한다. 캐럿(`^`) 금지.**

| react-native-maps | New Architecture 요구 RN |
|---|---|
| 1.26.1 이상 | **RN 0.81.1 이상** ← 우리(0.76.9)보다 높다 |
| **1.26.0 이하** | RN 0.76 이상 ✅ |

이 프로젝트는 **iOS·Android 양쪽 다 New Architecture**로 동작한다
(iOS `Podfile.lock`에 `React-Fabric` pod 존재, Android `newArchEnabled=true`).
따라서 최신(1.29.x)을 설치하면 빌드가 깨진다.

**iOS는 구글 지도로 고정** (사용자 결정): 기본값인 애플 지도를 쓰면 웹·안드로이드와
지도가 달라 보인다. `ios/Podfile`의 `pod 'react-native-maps/Google'` +
AppDelegate의 `[GMSServices provideAPIKey:]`가 함께 있어야 한다.
→ 되돌리려면 Podfile의 두 줄을 지우고 `src/constants/map.ts`의 `MAP_PROVIDER`를 비운다.

**Google Maps API 키 (2026-08-04 발급)** — Google Cloud `routefinding09-4b597`

| 키 이름 | 제한 | 사용처 |
|---|---|---|
| `Maps Android (routefinding v2)` | Android 앱: `com.yusung.routefinding` + SHA-1 / API: Maps SDK for Android | `AndroidManifest.xml` |
| `Maps iOS (routefinding v2)` | iOS 앱: `com.yusung.routefinding` / API: Maps SDK for iOS | `AppDelegate.mm` |

- Firebase 자동 생성 키는 **건드리지 않았다** (제한을 잘못 만지면 인증·Firestore가 멈춘다)
- 지도 **표시**는 모바일 SDK 과금 없음
- ⚠️ 현재 등록된 SHA-1은 **debug 키** 것이다. release 서명 키를 구하면(P2)
  그 SHA-1도 같은 키에 추가해야 스토어 버전에서 지도가 나온다

### 🥾 GPX / 트래킹

| 패키지 | 용도 | 우선순위 |
|---|---|---|
| `react-native-gpx-parser` 또는 `gpx-parse` | GPX 파싱 | P1 |
| `react-native-fs` | 파일 시스템 | P1 |
| `react-native-share` | GPX 공유 | P1 |
| `react-native-document-picker` | GPX 업로드 | P1 |

### 🏷️ NFC (인공벽)

| 패키지 | 용도 | 우선순위 |
|---|---|---|
| `react-native-nfc-manager` | NFC 태그 인식 | P1 |

> ⚠️ iOS는 NFC Reader 권한 필요 (Apple Developer 등록 시 추가 캐퍼빌리티).

### 📷 미디어

| 패키지 | 용도 | 우선순위 |
|---|---|---|
| `react-native-image-picker` | 갤러리/카메라 | P1 |
| `react-native-image-crop-picker` | 이미지 크롭/편집 | P2 |
| `react-native-video` | 영상 재생 (스플래시) | P1 |
| `react-native-fast-image` 또는 `expo-image` | 이미지 캐싱 | P1 |
| `react-native-image-zoom-viewer` | 이미지 확대/축소 | P2 |

### 📊 차트

| 패키지 | 용도 | 우선순위 |
|---|---|---|
| `react-native-chart-kit` 또는 `victory-native` | 등반 통계 | P2 |

### 💰 광고

| 패키지 | 용도 | 우선순위 |
|---|---|---|
| `react-native-google-mobile-ads` | AdMob | P2 |

### 🔧 유틸

| 패키지 | 용도 | 우선순위 |
|---|---|---|
| `react-native-async-storage/async-storage` | 로컬 저장 | P0 |
| `react-native-device-info` | 버전/디바이스 정보 | P1 |
| `react-native-config` | 환경 변수 | P1 |
| `date-fns` 또는 `dayjs` | 날짜 처리 | P1 |
| `react-native-url-launcher` 또는 `Linking` | 외부 URL 열기 | P1 |

---

## 📁 프로젝트 구조 (확정)

```
routefinding/                          ← 저장소 루트 (v2 브랜치)
├── README.md
├── CLAUDE.md
├── CHANGELOG.md
├── GETTING_STARTED.md
├── docs/
│   ├── 01_MVP_SPEC.md
│   ├── 02_DATA_MODEL.md
│   ├── 03_TECH_STACK.md             ← 이 파일
│   ├── 04_WIREFRAMES.md
│   └── 05_ROADMAP.md
│
├── app/                              ← React Native 앱
│   ├── ios/                          ← iOS 네이티브
│   ├── android/                      ← Android 네이티브
│   ├── src/
│   │   ├── App.tsx                   ← 앱 진입점
│   │   ├── screens/                  ← 화면 컴포넌트
│   │   │   ├── auth/
│   │   │   │   ├── SplashScreen.tsx
│   │   │   │   ├── LoginScreen.tsx
│   │   │   │   └── SignUpScreen.tsx
│   │   │   ├── home/
│   │   │   │   └── HomeScreen.tsx
│   │   │   ├── map/
│   │   │   │   ├── MapScreen.tsx
│   │   │   │   ├── MapInputScreen.tsx
│   │   │   │   └── components/      ← 큰 화면 분해 컴포넌트
│   │   │   ├── route/
│   │   │   │   ├── RouteListScreen.tsx
│   │   │   │   ├── RouteDetailScreen.tsx
│   │   │   │   ├── PitchDetailScreen.tsx
│   │   │   │   └── ConceptListScreen.tsx
│   │   │   ├── report/
│   │   │   │   ├── ReportListScreen.tsx
│   │   │   │   ├── ReportDetailScreen.tsx
│   │   │   │   └── ReportAdminScreen.tsx
│   │   │   ├── tracking/
│   │   │   │   ├── TrackingScreen.tsx
│   │   │   │   └── ApproachTrackingScreen.tsx
│   │   │   ├── crew/
│   │   │   │   ├── CrewMainScreen.tsx
│   │   │   │   ├── CrewDetailScreen.tsx
│   │   │   │   ├── CrewCreateScreen.tsx
│   │   │   │   ├── CrewChatScreen.tsx
│   │   │   │   └── components/
│   │   │   ├── board/
│   │   │   │   ├── BoardScreen.tsx
│   │   │   │   ├── PostDetailScreen.tsx
│   │   │   │   ├── WritePostScreen.tsx
│   │   │   │   └── EditPostScreen.tsx
│   │   │   ├── profile/
│   │   │   │   ├── MyPageScreen.tsx
│   │   │   │   ├── UserProfileScreen.tsx
│   │   │   │   └── components/      ← 탭/섹션별 분해
│   │   │   └── notification/
│   │   │       └── NotificationListScreen.tsx
│   │   │
│   │   ├── components/               ← 공통 컴포넌트
│   │   │   ├── common/
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Input.tsx
│   │   │   │   ├── ProfileWithCrown.tsx
│   │   │   │   └── WatermarkedImage.tsx
│   │   │   ├── modals/
│   │   │   └── ui/
│   │   │
│   │   ├── navigation/
│   │   │   ├── RootNavigator.tsx
│   │   │   ├── AuthNavigator.tsx
│   │   │   ├── MainTabNavigator.tsx
│   │   │   └── types.ts
│   │   │
│   │   ├── services/                 ← 외부 서비스 연동
│   │   │   ├── firebase.ts           ← Firebase 초기화
│   │   │   ├── auth.ts               ← 인증
│   │   │   ├── firestore.ts          ← Firestore 헬퍼
│   │   │   ├── storage.ts            ← Storage 업로드
│   │   │   ├── messaging.ts          ← FCM
│   │   │   ├── nfc.ts                ← NFC
│   │   │   ├── gpx.ts                ← GPX 파싱
│   │   │   └── ads.ts                ← AdMob
│   │   │
│   │   ├── stores/                   ← 상태관리
│   │   │   ├── authStore.ts
│   │   │   ├── userStore.ts
│   │   │   ├── routeStore.ts
│   │   │   └── notificationStore.ts
│   │   │
│   │   ├── hooks/                    ← 커스텀 훅
│   │   │   ├── useAuth.ts
│   │   │   ├── useFirestore.ts
│   │   │   ├── useLocation.ts
│   │   │   ├── useFcm.ts
│   │   │   └── useNfc.ts
│   │   │
│   │   ├── types/                    ← TypeScript 타입
│   │   │   ├── user.ts
│   │   │   ├── post.ts
│   │   │   ├── route.ts
│   │   │   ├── crew.ts
│   │   │   ├── notification.ts
│   │   │   └── navigation.ts
│   │   │
│   │   ├── utils/                    ← 유틸리티
│   │   │   ├── date.ts
│   │   │   ├── image.ts
│   │   │   ├── geohash.ts
│   │   │   └── format.ts
│   │   │
│   │   ├── constants/                ← 상수
│   │   │   ├── firestoreFields.ts
│   │   │   ├── level.ts
│   │   │   ├── config.ts
│   │   │   └── strings.ts
│   │   │
│   │   └── theme/                    ← 디자인 시스템
│   │       ├── colors.ts
│   │       ├── typography.ts
│   │       ├── spacing.ts
│   │       └── index.ts
│   │
│   ├── package.json
│   ├── tsconfig.json
│   ├── babel.config.js
│   ├── metro.config.js
│   ├── .eslintrc.js
│   ├── .prettierrc.js
│   └── index.js
│
├── functions/                        ← Firebase Cloud Functions (기존 재사용)
│   ├── index.js
│   └── scripts/
│       └── setAdmin.js               ← Custom Claims 부여
│
└── .github/
    └── workflows/                    ← CI/CD (선택)
```

---

## 💰 비용 추적 (외부 서비스)

| 서비스 | 비용 발생 시점 | 현재 사용량 | 비고 |
|---|---|---|---|
| **Firebase Firestore** | 읽기/쓰기/저장 | 무료 한도 내 (50명) | 사용자 증가 시 모니터링 |
| **Firebase Storage** | 저장 용량/다운로드 | 무료 한도 내 | 이미지 압축 필수 |
| **Firebase FCM** | 무료 | - | 무제한 |
| **Firebase Functions** | 호출 횟수 | 무료 한도 내 | - |
| **Google Maps API** | 지도 표시/검색 | 무료 한도 내 | 캐싱 적극 활용 |
| **AdMob** | 광고 노출/클릭 | 수익 발생 | 적정선 유지 |

→ 모든 외부 호출은 `app/src/services/` 모듈로 분리. 호출 횟수 추적 가능하게.

---

## 🔄 RideTalk 패턴 비교

| 영역 | RideTalk | routefinding v2 | 비고 |
|---|---|---|---|
| 프레임워크 | RN + TS | RN + TS | ✅ 동일 |
| 백엔드 | Firebase | Firebase | ✅ 동일 |
| 실시간 음성 | Agora SDK | ❌ 불필요 | - |
| 결제 | RevenueCat | ❌ MVP 제외 | v2.1+ 검토 |
| 지도 | Kakao Map | [TBD] Google vs Kakao | 결정 필요 |
| 대시보드 | Next.js + Vercel | ❌ MVP 제외 | 관리자 화면은 앱 내 |
| 상태관리 | [확인 필요] | [확인 후 동일하게] | - |

---

## 🚧 결정 대기 항목 ([TBD])

다음 항목은 RideTalk의 실제 `package.json`과 코드 패턴 확인 후 확정:

1. ~~**[TBD] 상태관리**~~ → ✅ **Zustand 확정** (2026-05-19, Phase 1-4)
2. **[TBD] 지도 SDK**: react-native-maps (Google) vs react-native-kakao-maps
3. ~~**[TBD] 디자인 토큰**~~ → ✅ **하이브리드 확정** (v1 색상 보존 + 모던 토큰, 2026-05-19)
4. **[TBD] 아이콘**: react-native-vector-icons vs lucide-react-native vs SVG 직접
5. **[TBD] 폼 관리**: react-hook-form vs formik vs 직접
6. **[TBD] 날짜 라이브러리**: date-fns vs dayjs
7. **[TBD] ESLint 설정**: RideTalk 것 그대로 복사

---

## 📐 코드 컨벤션

### 파일 명명

- **컴포넌트**: PascalCase (예: `LoginScreen.tsx`)
- **훅**: camelCase + use 접두사 (예: `useAuth.ts`)
- **유틸/서비스**: camelCase (예: `firestore.ts`)
- **타입**: camelCase (예: `user.ts`)
- **상수**: camelCase (예: `firestoreFields.ts`)

### 타입 정의

```typescript
// 좋은 예
interface User {
  uid: string;
  nickname: string;
}

// 나쁜 예
type User = any;
```

### 컴포넌트 작성

```typescript
// 좋은 예: Props 타입 명시 + named export
interface LoginScreenProps {
  navigation: NavigationProp<...>;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  // ...
};

// 나쁜 예
export default function LoginScreen(props) { ... }
```

### Firebase 호출

```typescript
// 좋은 예: service 모듈로 분리
// services/auth.ts
export const signIn = async (email: string, password: string) => {
  const credential = await auth().signInWithEmailAndPassword(email, password);
  return credential.user;
};

// 화면에서
import { signIn } from '@/services/auth';
const user = await signIn(email, password);
```

```typescript
// 나쁜 예: 화면에서 직접 호출
const credential = await firebase.auth().signInWithEmailAndPassword(...);
```

---

## 🔐 환경 변수

```
# .env (gitignore 처리)
FIREBASE_API_KEY=...
GOOGLE_MAPS_API_KEY=...
ADMOB_APP_ID_ANDROID=...
ADMOB_APP_ID_IOS=...
```

- `react-native-config` 사용
- `.env.example` 파일을 저장소에 포함 (실제 값 없이 키만)

---

*이 문서는 라이브러리 추가/변경 시 반드시 갱신한다.*
