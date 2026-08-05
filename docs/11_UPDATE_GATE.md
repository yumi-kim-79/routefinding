# 11. 업데이트 안내 (Remote Config)

> 2026-08-06 추가. 새 버전을 배포하면 구버전 사용자에게 **업데이트 화면**을 띄우고,
> **밀어서(slide)** 스토어로 보낸다.

---

## 0. ⚠️ 왜 첫 배포에 들어가야 하나

이 기능은 **앱 안에 들어 있어야** 동작한다.
지금 이 코드 없이 v2.0.0을 올리면, 나중에 v2.0.1을 내도 **v2.0.0 사용자에게는
업데이트하라고 알릴 방법이 없다.** 그래서 다른 출시 준비보다 **먼저** 넣었다.

---

## 1. 동작

| 단계 | 조건 | 화면 |
|---|---|---|
| `required` | 설치 버전 < `min_version_*` | **닫을 수 없다.** 밀어야 스토어로 간다 |
| `optional` | 설치 버전 < `latest_version_*` | '나중에' 로 넘어갈 수 있다 (앱 재시작하면 다시 뜬다) |
| `none` | 그 외 | 안 뜬다 |

- 판단 기준 버전 = `app/package.json` 의 `version` (아래 §3)
- **앱 시작을 붙잡지 않는다**: 캐시된 값으로 즉시 판단하고, 새 값은 백그라운드로 받아 다시 판단
- Remote Config 가 실패해도 앱은 그대로 동작한다 (기본값이 `0.0.0` 이라 아무도 막지 않는다)

관련 파일
```
src/services/updateService.ts     판단 로직 · Remote Config 읽기
src/hooks/useUpdateGate.ts        캐시 → 백그라운드 갱신 순서
src/components/common/UpdateGate.tsx   화면 (밀어서 이동)
src/constants/version.ts          현재 버전 · 스토어 주소
```

---

## 2. Firebase 콘솔 설정 (한 번만)

Firebase 콘솔 → **Remote Config** → 매개변수 추가. 전부 **문자열(String)** 이다.

| 매개변수 키 | 기본값 예 | 뜻 |
|---|---|---|
| `min_version_android` | `2.0.0` | 이 **미만**이면 강제 업데이트 |
| `min_version_ios` | `2.0.0` | 〃 |
| `latest_version_android` | `2.0.0` | 이 **미만**이면 권장 업데이트 |
| `latest_version_ios` | `2.0.0` | 〃 |
| `update_message` | (비움) | 안내 문구. 비우면 앱 기본 문구 |
| `store_url_android` | (비움) | 스토어 주소 덮어쓰기. 보통 비워 둔다 |
| `store_url_ios` | (비움) | **App Store ID 를 아직 모를 때 여기에 전체 주소를 넣는다** |

설정한 뒤 **"변경사항 게시"** 를 눌러야 반영된다.

### 첫 출시 때 권장값
```
min_version_*    = 0.0.0   ← 아무도 막지 않는다 (안전)
latest_version_* = 2.0.0
```
v2.0.0을 내보낸 뒤 문제가 없으면 그때 `min_version_*` 을 올린다.
**처음부터 min 을 높게 잡지 말 것** — 잘못 넣으면 전원이 앱을 못 쓴다.

### 나중에 새 버전(예 2.1.0)을 낼 때
```
latest_version_* = 2.1.0        → 2.0.x 사용자에게 '새 버전이 있습니다'
min_version_*    = 2.1.0        → 2.0.x 사용자를 **완전히 막는다** (치명적 버그일 때만)
```
캐시가 1시간이라 반영까지 최대 1시간 걸린다(`updateService.ts` 의 `minimumFetchIntervalMillis`).

---

## 3. 버전 올리는 법 — **`package.json` 하나만**

```json
// app/package.json
{ "version": "2.1.0" }
```
- Android `versionName` → gradle 이 이 파일을 읽는다
- 앱 안 판단 기준 `APP_VERSION` → 같은 파일을 읽는다
- Android `versionCode` 는 별개다: `-PROUTEFINDING_VERSION_CODE=101`
- **iOS 는 Xcode 의 `MARKETING_VERSION` 을 손으로 맞춰야 한다**
  (Xcode 는 빌드 시점에 JS/JSON 을 읽지 않는다). 안 맞으면 스토어 표시 버전만 어긋난다.

---

## 4. iOS 스토어 주소

App Store 숫자 ID 가 있어야 스토어 앱을 바로 열 수 있다.
- App Store Connect 에 앱을 만들면 → `src/constants/version.ts` 의 `APP_STORE_ID` 에 넣는다
- 앱을 다시 배포하고 싶지 않으면 → Remote Config `store_url_ios` 에 전체 주소를 넣는다
  (예: `https://apps.apple.com/kr/app/id6501234567`)

---

## 5. 확인 방법

가장 확실한 방법은 **기준을 현재 버전보다 높게** 잡아 보는 것이다.

1. 기기에 v2.0.0 설치
2. 콘솔에서 `latest_version_android = 2.0.1` 로 게시 → 앱 재시작 → '새 버전이 있습니다'(나중에 가능)
3. `min_version_android = 2.0.1` 로 게시 → 앱 재시작 → **닫을 수 없는 화면**
4. 확인이 끝나면 **반드시 원래대로 되돌린다**

> 디버그 빌드는 캐시 간격이 0이라 게시 즉시 반영된다. release 는 최대 1시간.
