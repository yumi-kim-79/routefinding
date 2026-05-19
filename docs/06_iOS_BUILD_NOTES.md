# 🍎 06_iOS_BUILD_NOTES.md — iOS 빌드 별도 트랙

> **상태**: ⏸️ 보류 (Phase 1-2.5). Android는 정상 빌드. iOS만 미해결.
> **결정일**: 2026-05-19
> **원칙**: Phase 1 나머지는 OS 무관하므로 Android로 진행. iOS는 생태계 추격 후 재검증.

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
