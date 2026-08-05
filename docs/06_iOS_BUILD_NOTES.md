# 🍎 06_iOS_BUILD_NOTES.md — iOS 빌드 별도 트랙

> **상태**: ✅ **해결 (2026-08-04)** — Xcode 실기기 빌드 성공, 앱 실행·4탭 확인 완료.
> (이력: ⏸️ 보류 2026-05-19 → 🔄 재개 2026-08-04 → ✅ 해결 2026-08-04)
> **결정일**: 2026-05-19
> **원칙**: Phase 1 나머지는 OS 무관하므로 Android로 진행. iOS는 생태계 추격 후 재검증.

---

## 0. 🔔 재시도 트리거 — **충족됨** (2026-08-04 확인)

§4 옵션 0의 트리거는 "RNFB 또는 firebase-ios-sdk 새 버전 출시"다. **이미 충족됐다.**

| 패키지 | 보류 당시(2026-05-19) | 현재 최신(2026-08-04) |
|---|---|---|
| `@react-native-firebase/*` | 24.0.0 | **26.1.0** (24.1.0→25.0.0→26.0.0→26.1.0, 4차례 릴리스) |
| react-native | 0.76.9 (설치본) | 0.86.2 |
| react-native-image-picker | — | 8.2.1 (프로젝트는 ^7.2.3 — RN 0.76 호환 유지) |

> 26.1.0은 2026-08-03 릴리스. 메이저가 두 번(25, 26) 올랐으므로
> **firebase-ios-sdk도 크게 올라갔을 가능성이 높다** = Xcode 26.x 대응이 들어갔을 확률이 높다.
> 다만 RNFB 24 → 26은 **메이저 2단계**라 breaking change 확인이 필수다. 임의 업그레이드 금지 —
> 사용자 승인 후 별도 브랜치에서 진행할 것.

**재개 시 첫 명령**
```bash
cd ~/StudioProjects/routefinding/app
corepack yarn up '@react-native-firebase/*'          # 24 → 26
# Podfile의 gRPC post_install 패치를 먼저 제거(주석 처리)한 뒤
cd ios && pod install && cd ..
yarn ios
```

---

## 0-1. 🧩 v2 리뉴얼 반영분 — iOS 재개 시 확인할 것 (2026-08-04 기준)

Android로만 개발이 진행되는 동안 쌓인, **iOS에서만 문제가 될 수 있는 항목들**이다.

### 이미 처리해 둔 것 ✅
| 항목 | 처리 |
|---|---|
| `NSLocationWhenInUseUsageDescription` **값이 빈 문자열**이었음 | 실제 문구로 채움. 빈 값은 **App Store 심사 거부 사유** |
| `react-native-image-picker` 사진 권한 문구 없음 | `NSPhotoLibraryUsageDescription` 추가 (없으면 사진 선택 시 크래시) |
| App Check provider 분기 | `services/firebase.ts`에서 이미 `deviceCheck`(iOS) / `playIntegrity`(Android) 분기됨 |
| `GoogleService-Info.plist` | 존재, 프로젝트 `routefinding09-4b597`, 번들 ID `com.yusungyun.RouteFinding` — Android와 동일 프로젝트 ✅ |
| AppDelegate Firebase 초기화 | `[FIRApp configure]` 있음 ✅ |

### iOS 재개 시 해야 할 것 ⏳
- [ ] **`pod install` 재실행** — `react-native-image-picker`가 2026-08-04에 추가됐다. Pod이 아직 안 깔려 있다
- [ ] 프로필 사진 선택 → Storage 업로드 실기기 검증
      (`services/profilePhoto.ts`의 `putFile`은 iOS에서 `file://` URI를 받는다. image-picker가 주는 URI 형식 확인 필요)
- [ ] 등반일지 날짜 입력 — 현재 `YYYY-MM-DD` **텍스트 입력**이다.
      iOS 키보드는 `numbers-and-punctuation`로 지정해 뒀으나, 실제 입력감 확인 후
      date picker 도입 여부 결정 ([TBD] — 새 네이티브 의존성이 하나 더 늘어남)
- [ ] 개념도 전체화면 뷰어(`ConceptImageViewer`) — `supportedOrientations` 지정돼 있으나 iOS 회전 동작 확인
- [ ] `KeyboardAvoidingView` behavior 분기(`padding`/undefined) — iOS에서 폼 가림 확인
      (마이프로필, 등반일지 작성 두 화면)
- [ ] 지도 탭 구현 시 위치 권한 실제 요청 흐름 검증 (문구는 채워둠)
- [ ] 카메라로 사진 촬영을 쓰게 되면 `NSCameraUsageDescription` 추가 필요 (현재는 라이브러리 선택만 사용)

### iOS 무관 (Android와 동일 동작 확인됨)
개념도 검색/목록/상세, 등반일지 CRUD, 마이페이지 3탭, 4탭 네비게이션 —
전부 JS 레이어라 플랫폼 분기가 없다.

---

## 1. 검증 환경 (재시도 시 비교 기준)

| 항목 | 값 |
|---|---|
| Xcode | **26.3** (Build 17C529) |
| iOS Simulator SDK | **26.2** |
| macOS | Darwin 25.x (arm64) |
| Node | 20.20.2 (nvm) |
| 패키지 매니저 | yarn Berry 3.6.4 |
| React Native | 0.76.9 |
| `@react-native-firebase/*` | **24.0.0** (app/auth/firestore/storage/messaging/app-check) |
| firebase-ios-sdk | **12.10.0** (Podfile.lock) |
| CocoaPods | 1.16.2 |
| 문제 pod | `gRPC-C++`, `gRPC-Core`, `BoringSSL-GRPC` (Firestore 의존) |

> 재시도 전 위 표를 현재 값과 비교. RNFB/firebase-ios-sdk/Xcode 중 하나라도 올라갔으면 "옵션 0(클린 재시도)"부터.

---

## 2. 지금까지 시도한 것 (시간순)

| # | 시도 | 결과 |
|---|---|---|
| 1 | `pod install` (패치 없음) | ❌ `[!] The following Swift pods cannot yet be integrated as static libraries` (FirebaseAuth/Firestore/Storage 등 모듈맵 없음) |
| 2 | Podfile에 `use_modular_headers!` 추가 → `pod install` | ✅ pod install 성공 (72 deps / 97 pods) |
| 3 | `GoogleService-Info.plist`를 `xcodeproj` gem으로 RouteFinding 타깃 Resources에 등록 | ✅ pbxproj 참조 4건 정상 |
| 4 | iOS 빌드 (`xcodebuild ... iphonesimulator`) | ❌ **1차**: `gRPC-C++` 타깃 `ScanDependencies` 실패 (C++20 explicit modules ↔ gRPC) |
| 5 | Podfile `post_install`: gRPC 3타깃에 `CLANG_ENABLE_EXPLICIT_MODULES=NO` + `CLANG_ENABLE_MODULES=NO` | ❌ **2차**: gRPC 에러 해소, 그러나 시스템 헤더 `_stdio.h:322 error: expected identifier or '('` |
| 6 | 패치 최소화: `CLANG_ENABLE_MODULES=NO` 제거, `CLANG_ENABLE_EXPLICIT_MODULES=NO`만 유지 | ❌ **3차**: `_stdio.h` 해소(원인 검증됨), 그러나 `fatal error: module map file '.../Pods/Headers/Private/grpc/gRPC-Core.modulemap' not found` |

### 발생한 에러 원문

```
# 1차
The Swift pod `FirebaseFirestore` depends upon `FirebaseFirestoreInternal`,
which do not define modules. ... use_modular_headers! ...

# (빌드 1차) gRPC-C++ ScanDependencies
ScanDependencies ... gRPC-C++-dummy.m ... (in target 'gRPC-C++' from project 'Pods')
** BUILD FAILED **

# 2차
/Applications/Xcode.app/.../iPhoneSimulator26.2.sdk/usr/include/_stdio.h:322:7:
  error: expected identifier or '('

# 3차 (현재)
fatal error: module map file
'/Users/yusungyun/StudioProjects/routefinding/app/ios/Pods/Headers/Private/grpc/gRPC-Core.modulemap'
not found
```

### 현재 Podfile에 남아있는 패치 (커밋됨)

```ruby
use_modular_headers!   # FirebaseAuth/Firestore/Storage Swift pod static 통합용

post_install do |installer|
  react_native_post_install(...)
  installer.pods_project.targets.each do |target|
    if %w[gRPC-C++ gRPC-Core BoringSSL-GRPC].include?(target.name)
      target.build_configurations.each do |bc|
        bc.build_settings['CLANG_ENABLE_EXPLICIT_MODULES'] = 'NO'
      end
    end
  end
end
```

---

### 2026-08-04 시도 (4~7차) — **원인 규명 + pod install 통과**

| # | 시도 | 결과 |
|---|---|---|
| 4 | RNFB 24.0.0 → **25.1.0** 업그레이드 (firebase-ios-sdk 12.15.0) | ✅ `yarn typecheck` 에러 1건뿐 (`FirebaseAuthTypes.User` → `User`) |
| 5 | Podfile의 gRPC `CLANG_ENABLE_EXPLICIT_MODULES=NO` 패치 **제거** | ❌ `pod install` 실패 — 스펙 저장소가 오래됨 (`Firebase/AppCheck (= 12.15.0)` 못 찾음) |
| 6 | `pod install --repo-update` | ✅ pod 해석 성공 → 빌드 진행 → ❌ **3차와 동일 에러**: `module map file '.../Pods/Headers/Private/grpc/gRPC-Core.modulemap' not found` |
| 7 | **`use_modular_headers!` 제거 → static framework 방식으로 전환** | ✅ `pod install` 통과 (Podfile.lock 3611줄, gRPC-C++ 1.69.0) |

#### 🔑 원인 규명 — 범인은 `use_modular_headers!` 였다

1차 실패("Swift pods cannot yet be integrated as static libraries")를 넘기려고
`use_modular_headers!`를 **전역으로** 켰는데, 이게 gRPC-Core의 헤더 배치와 맞지 않아
`Pods/Headers/Private/grpc/gRPC-Core.modulemap not found`를 낳았다.
**패치를 한 겹 벗길 때마다 다음 불일치가 드러나던 "양파 까기"의 근원이 여기였다.**
Xcode 26 자체의 문제가 아니라 Podfile 접근 방식의 문제였다.

RNFB 공식 문서(rnfirebase.io)의 권장 설정은 `use_modular_headers!`가 아니라
**static framework 링크**다:

```ruby
$RNFirebaseAsStaticFramework = true
use_frameworks! :linkage => :static
```

이 방식으로 전환하고 gRPC 패치를 모두 제거한 뒤 `pod install` 통과.

#### 남은 검증
- [ ] Xcode 실기기 빌드 (`RouteFinding.xcworkspace`, Scheme → Release)
- [ ] `use_frameworks!`는 **모든 pod의 링크 방식**을 바꾼다 →
      react-native-screens / image-picker / safe-area-context에서 새 에러 가능성
- [ ] 안드로이드가 깨지지 않았는지 (2026-08-04 확인: 실기기 정상 실행 ✅)

### 2026-08-04 시도 (8~10차) — ✅ **실기기 빌드 성공**

| # | 시도 | 결과 |
|---|---|---|
| 8 | Xcode에서 Team 선택 | ❌ `Failed Registering Bundle Identifier` — `com.yusungyun.RouteFinding`은 **v1 Flutter가 쓰던 ID**이고 다른 Apple 팀에 이미 등록돼 있어 YUMI KIM 팀으로 가져올 수 없음 |
| 9 | 번들 ID를 **`com.yusung.routefinding`으로 변경** + Firebase에 iOS 앱 신규 등록 → 새 `GoogleService-Info.plist` 교체 | ✅ 서명 통과 (Apple Development: YUMI KIM) |
| 10 | 빌드 | ❌ `Build input file cannot be found: app/ios/GoogleService-Info.plist` → **파일을 그 경로로 이동** → ✅ **빌드 성공 · 실기기 실행 확인** |

#### 🔑 번들 ID 변경 (되돌릴 수 없는 결정 — 사용자 승인 완료)

- v1 Flutter iOS의 번들 ID는 `com.yusungyun.RouteFinding`이었고, 그 식별자가 **다른 Apple 계정에 선점**돼 있었다.
  (예전에 무료 Personal Team으로 실기기 빌드할 때 Xcode가 자동 등록했을 가능성이 높다)
- **v1 iOS는 App Store에 출시된 적이 없다**(사용자 확인) → 번들 ID를 바꿔도 잃을 사용자가 없다.
- 새 값 **`com.yusung.routefinding`** = 안드로이드 `applicationId`와 동일. 양 플랫폼 통일.
- Firebase 프로젝트 `routefinding09-4b597`에 **iOS 앱을 하나 더 등록**해 새 plist를 받았다.
  기존 iOS 앱 항목(`com.yusungyun.RouteFinding`)은 **삭제하지 않고 그대로 둔다.**
- ⚠️ `GoogleService-Info.plist`는 `.gitignore`에 있어 **커밋되지 않는다.** 다른 맥에서 빌드하려면
  Firebase 콘솔에서 다시 받아야 한다.

#### 🐛 `GoogleService-Info.plist` 경로 참조가 처음부터 깨져 있었다

`project.pbxproj`의 파일 참조가 다른 파일들과 달리 폴더명이 빠져 있었다.

```
AppDelegate.mm            path = RouteFinding/AppDelegate.mm   ✅
Info.plist                path = RouteFinding/Info.plist       ✅
GoogleService-Info.plist  path = GoogleService-Info.plist      ⚠️ RouteFinding/ 누락
```

§2 시도 #3에서 `xcodeproj` gem으로 등록할 때 잘못 들어간 것으로 보인다.
이전 빌드는 gRPC·서명 단계에서 먼저 죽어 이 에러까지 도달한 적이 없어 드러나지 않았다.
→ **파일을 `app/ios/GoogleService-Info.plist`로 이동**해 해결(pbxproj는 건드리지 않음).

#### ✅ 최종 통과 구성

| 항목 | 값 |
|---|---|
| RNFB | 25.1.0 / firebase-ios-sdk 12.15.0 / gRPC-C++ 1.69.0 |
| Podfile | `$RNFirebaseAsStaticFramework = true` + `use_frameworks! :linkage => :static`, gRPC 패치 **없음** |
| 번들 ID | `com.yusung.routefinding` |
| 팀 / 서명 | YUMI KIM (75K9YY6D2C), Automatically manage signing |
| 빌드 | Release 구성, 실기기(iPhone) |
| 결과 | 빌드 성공 · 앱 실행 · 4탭 네비게이션 동작 확인 |

> **`use_frameworks!`로 인한 추가 에러는 없었다.** react-native-screens / image-picker /
> safe-area-context 모두 static framework 링크에서 정상 컴파일.

---

### 2026-08-04 (11차) — 지도 도입 후 `pod install` ✅

**우려했던 `use_frameworks! :linkage => :static` ↔ GoogleMaps 충돌은 발생하지 않았다.**

```
Installing Google-Maps-iOS-Utils (6.1.0)
Installing GoogleMaps (9.4.0)
Installing react-native-maps (1.26.0)
Framework build type is static framework
Pod installation complete! 77 dependencies from the Podfile, 104 total pods
```

- `react-native-maps`는 `includesGeneratedCode: true`라 Codegen이 새로 생성하지 않고
  동봉된 코드를 쓴다 (로그에 `RNMapsSpecs` 생성 단계가 없는 것이 정상)
- 안드로이드도 같은 커밋에서 빌드 성공 (3m 08s)

#### ⚠️ 새로 뜬 경고 — CocoaPods 지원 종료 예고

```
[!] FirebaseCore has been deprecated in favor of the Firebase Apple SDK via
    Swift Package Manager. ... new versions will no longer be published to
    CocoaPods after October 2026.
```

지금 동작에는 영향 없다. 다만 **2026년 10월 이후 firebase-ios-sdk 새 버전이
CocoaPods에 올라오지 않는다** → 그 시점 이후의 RNFB/Firebase 업그레이드는 SPM 전환이
필요할 수 있다. RN 업그레이드 + New Architecture + RNFB 26 작업과 묶어 검토할 것.
[TBD] 별도 트랙.

---

### 🕳️ iOS 함정 — 사진 선택 `maxWidth`는 저해상도 임시본을 물어온다 (2026-08-05)

증상: 사진을 처음 첨부하면 **모자이크처럼 뭉개져** 보이고, 나갔다 다시 첨부하면 정상.
매번 같은 패턴으로 재현된다.

원인: `react-native-image-picker`에 `maxWidth`/`maxHeight`를 주면 iOS의 사진 요청이
**저해상도 임시본(degraded)을 먼저** 돌려주고, 라이브러리가 그것을 저장한다.

→ **iOS에서는 축소 옵션을 주지 않는다.** 안드로이드는 메모리 때문에 반드시 축소해야 하므로
`src/constants/image.ts`에서 플랫폼별로 갈라 둔다. 한쪽 값을 그대로 옮기지 말 것.

---

### 🕳️ 흔한 함정 — `pod install` 누락 (2026-08-05)

증상: 앱은 뜨는데 **특정 기능만** 아래 오류로 죽거나 무한 로딩에 걸린다.
```
Invariant Violation: TurboModuleRegistry.getEnforcing(...): '<모듈명>' could not be found.
Verify that a module by this name is registered in the native binary.
```

원인: `package.json`에 네이티브 패키지를 추가하고 **`pod install`을 하지 않았다.**
JS는 번들에 들어가지만 네이티브 쪽이 비어 있어, 그 기능을 처음 쓰는 순간 터진다.
안드로이드는 Gradle이 빌드할 때마다 자동 링크하므로 **iOS에서만** 이런 일이 생긴다.

확인 방법 — 설치 여부를 `Podfile.lock`에서 직접 본다:
```bash
grep -c "react-native-view-shot" app/ios/Podfile.lock   # 0이면 미설치
```

해결:
```bash
cd app && corepack yarn install
cd ios && pod install && cd ..
# Xcode를 ⌘Q로 완전히 종료했다가 워크스페이스를 다시 열고 빌드
```

---

#### RNFB 26으로 올리지 말 것
v26부터 **New Architecture 필수**다. RN 0.76.9에서 켜려면 모든 네이티브 의존성이
지원해야 하고 사실상 RN 업그레이드와 묶어야 한다. iOS 복구 목적이면 25로 충분하다.
(상세: `docs/09_RNFB_UPGRADE.md`)

---

## 3. 근본 원인 가설

**Xcode 26.3 / Simulator 26.2 SDK가 너무 최신** → firebase-ios-sdk 12.10.0이 끌어오는 gRPC-C++/Core가
이 툴체인의 C++20 explicit modules / modulemap 생성 방식과 아직 호환되지 않음.
패치로 한 겹씩 벗겨도 다음 불일치가 드러나는 "양파 까기" 패턴 → 단발 패치로 해결될 문제가 아니라
**생태계(RNFB/firebase-ios-sdk)가 Xcode 26.x를 정식 지원**해야 근본 해결될 가능성이 높음.

---

## 4. 다음 시도할 옵션 (재검증 시 순서대로)

### 옵션 0 — 클린 재시도 (트리거 충족 시 최우선)
RNFB 또는 firebase-ios-sdk 새 버전 출시 후:
1. `corepack yarn up @react-native-firebase/app @react-native-firebase/auth @react-native-firebase/firestore @react-native-firebase/storage @react-native-firebase/messaging @react-native-firebase/app-check`
2. **Podfile post_install의 gRPC 패치 제거** (생태계가 고쳤으면 불필요)
3. `cd ios && pod install && cd ..` → `yarn ios`
4. 성공 시 이 문서/ROADMAP에 "옵션 0으로 해결" 기록, `use_modular_headers!`만 유지 여부 검토

### 옵션 1 — gRPC modulemap 보정
`gRPC-Core.modulemap not found`를 직접 해소:
- gRPC 계열(`gRPC-C++`/`gRPC-Core`/`BoringSSL-GRPC`)에 일관된 모듈 정책 적용
- 또는 `HEADER_SEARCH_PATHS`/누락 modulemap 생성 post_install 보정
- explicit-modules off 범위와 modulemap 의존을 일치시키는 것이 핵심

### 옵션 2 — Firebase iOS SDK 버전 핀 다운
Podfile에 Xcode 26.x와 검증된 구버전 고정:
```ruby
$FirebaseSDKVersion = '<검증된 버전>'
```
- RNFB v24 권장 SDK와 차이 → 호환 매트릭스 확인 필수

### 옵션 3 — 최후 수단
- Firestore만 분리(다른 데이터 접근 경로) — MVP 데이터 모델상 비현실적
- Xcode 버전 조정(구버전 병행 설치)

---

## 5. 재시도 체크리스트

- [ ] 트리거 발생 확인 (RNFB/firebase-ios-sdk 새 버전 or Xcode 26.x 호환 공지)
- [ ] §1 환경표를 현재 값과 비교, 변경분 기록
- [ ] 옵션 0(클린 재시도)부터 — 패치 제거 후 빌드
- [ ] 실패 시 에러 원문을 §2 표에 추가 (양파 패턴 추적)
- [ ] 큰 결정 필요 시 멈추고 사용자 확인 (임의 추가 패치 금지)
- [ ] 해결 시: `CHANGELOG.md` + `05_ROADMAP.md` 1-2.5 + 이 문서 갱신, Phase 1-2.5 ✅
- [ ] iOS 빌드 성공 후 실기기/시뮬레이터에서 Firebase Auth·Firestore 동작 1회 검증

---

*이 문서는 iOS 빌드 재시도마다 갱신한다. 시도/에러/환경을 반드시 누적 기록.*
