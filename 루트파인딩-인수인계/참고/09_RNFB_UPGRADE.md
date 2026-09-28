# ⬆️ 09_RNFB_UPGRADE.md — React Native Firebase 업그레이드 (iOS 빌드 복구)

> 조사일: 2026-08-04
> **결론: 24.0.0 → 25.1.0 으로 올린다. 26은 지금 가면 안 된다.**

---

## 1. 왜 25인가 (26이 아니라)

### iOS 빌드가 풀리는 이유
RNFB 25가 쓰는 **firebase-ios-sdk 12.12.0+** 는 공식적으로 **Xcode 26.2 이상을 요구**한다.
즉 생태계가 Xcode 26.x를 정식 지원하기 시작했다는 뜻이다.
현재 개발 환경이 Xcode 26.3이므로, 보류 사유였던
"gRPC-C++ ↔ Xcode 26 C++20 explicit modules 충돌"이 해소됐을 가능성이 매우 높다.

### 26을 피하는 이유 — **New Architecture가 필수**
> "From v26 onward, every React Native Firebase package with a native bridge is
> implemented as a Codegen TurboModule and **requires React Native's New Architecture**."

현재 RN 0.76.9는 New Arch가 기본이 아니다. 켜려면:
- 모든 네이티브 의존성이 New Arch를 지원해야 함
  (react-native-screens, safe-area-context, image-picker, 앞으로 넣을 react-native-maps)
- 사실상 RN 버전 업그레이드와 함께 가야 하는 작업

**iOS 빌드 복구가 목적이라면 25로 충분하다.** 26은 RN 업그레이드와 묶어서 별도 진행.

| | v24 (현재) | **v25.1.0 (목표)** | v26.1.0 |
|---|---|---|---|
| iOS Xcode 26 지원 | ❌ | ✅ | ✅ |
| New Architecture | 불필요 | 불필요 | **필수** |
| 네임스페이스 API | 유지 | 유지(deprecated) | **제거** |
| 위험도 | — | 중 | 높음 |

---

## 2. 우리 코드에 실제로 영향 있는 것

v25 변경점 전체 중, 이 프로젝트가 **실제로 쓰는 API만** 추린 결과다.

| 대상 | 사용처 | 조치 |
|---|---|---|
| **App Check провider** | `src/services/firebase.ts` (1곳) | 🔴 **코드 수정 필요** |
| `FirebaseAuthTypes` | `src/types/auth.ts` (2곳) | 🟡 deprecated. tsc가 알려주면 수정 |
| `FirebaseFirestoreTypes` | 타입 파일 28곳 (대부분 `Timestamp`) | 🟡 v25 문서상 firestore 타입 네임스페이스 제거 언급 없음. tsc로 확인 |
| Storage `ref`/`putFile`/`getDownloadURL` | `profilePhoto.ts` | ✅ 이미 모듈러 방식 — 영향 없음 |
| Firestore `collection`/`doc`/`onSnapshot` 등 | 전역 | ✅ 이미 모듈러 방식 — 영향 없음 |
| `ServerValue` / `refFromURL` / `.child()` / `AppleAuthProvider` / `md5hash` | 없음 | ✅ 미사용 |

**영향 범위가 매우 좁다.** 처음부터 모듈러 API로 작성해 둔 덕분이다.

### App Check 수정 내용

현재 (v24 — 네임스페이스 방식):
```ts
import { firebase as appCheckFirebase, initializeAppCheck } from '@react-native-firebase/app-check';

const provider = appCheckFirebase.appCheck().newReactNativeFirebaseAppCheckProvider();
provider.configure({ ... });
await initializeAppCheck(app, { provider, isTokenAutoRefreshEnabled: true });
```

v25 이후 (모듈러):
```ts
import {
  ReactNativeFirebaseAppCheckProvider,
  initializeAppCheck,
} from '@react-native-firebase/app-check';

const provider = new ReactNativeFirebaseAppCheckProvider();
provider.configure({
  android: { provider: __DEV__ ? 'debug' : 'playIntegrity' },
  apple:   { provider: __DEV__ ? 'debug' : 'appAttestWithDeviceCheckFallback' },
});
await initializeAppCheck(app, { provider, isTokenAutoRefreshEnabled: true });
```

> iOS는 `deviceCheck` 대신 **`appAttestWithDeviceCheckFallback`** 이 현재 권장값이다.
> App Attest를 우선 쓰고 지원 안 되는 기기에서 DeviceCheck로 떨어진다.

---

## 3. 실행 순서

```bash
cd ~/StudioProjects/routefinding/app

# 0) 되돌릴 수 있게 먼저 커밋 (앱 저장소는 git이 있다)
git add -A && git commit -m "chore: RNFB 업그레이드 전 스냅샷"

# 1) 25.1.0 으로 고정 업그레이드 (latest로 올리면 26이 딸려온다 — 반드시 버전 명시)
corepack yarn up '@react-native-firebase/app@25.1.0' \
                 '@react-native-firebase/auth@25.1.0' \
                 '@react-native-firebase/firestore@25.1.0' \
                 '@react-native-firebase/storage@25.1.0' \
                 '@react-native-firebase/messaging@25.1.0' \
                 '@react-native-firebase/app-check@25.1.0'

# 2) 타입체크 — 여기서 나오는 에러가 곧 할 일 목록
yarn typecheck
```

이 시점에서 멈추고 `yarn typecheck` 출력을 알려줄 것.
App Check 등 코드 수정은 그 결과를 보고 정확히 반영한다.

```bash
# 3) 코드 수정 후 — Podfile의 gRPC 패치 제거
#    (생태계가 고쳤다면 이 패치가 오히려 방해가 된다)
#    ios/Podfile 의 post_install 안 gRPC 블록을 주석 처리

# 4) iOS 재빌드
cd ios && rm -rf Pods Podfile.lock build && pod install && cd ..
yarn ios

# 5) 안드로이드도 깨지지 않았는지 확인 (업그레이드가 양쪽에 영향)
yarn android
```

---

## 4. 실패 시

`docs/06_iOS_BUILD_NOTES.md` §2의 "양파 까기" 기록을 이어서 남긴다.
에러 원문을 그대로 표에 추가하고, **임의 패치를 덧붙이지 말고 보고할 것**(CLAUDE.md).

되돌리기:
```bash
git checkout -- package.json yarn.lock
corepack yarn install
```

---

## 5. 이후 (별도 작업)

- **react-native-maps 도입** — 지도 SDK는 Google Maps로 결정(2026-08-04).
  앱 지도 탭 + 루트제보 좌표 입력이 여기에 달려 있다.
- **RN 업그레이드 + New Architecture + RNFB 26** — 묶어서 별도 진행.
  지금 할 일이 아니다.
