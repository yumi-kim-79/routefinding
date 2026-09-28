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

### 📌 현재 값 (2026-08-13) — **당분간 그대로 둔다**

| 키 | 값 | 왜 |
|---|---|---|
| `min_version_android` | `0.0.0` | 아무도 막지 않는다. 치명적 버그가 아니면 올리지 않는다 |
| `min_version_ios` | `0.0.0` | 〃 |
| `latest_version_android` | `2.0.0` | 배포된 앱의 내부 `APP_VERSION` 과 같다 → 아무도 안내를 안 받는다 (§2-1 참조) |
| `latest_version_ios` | `2.0.0` | **심사 중**. 스토어에 없는 버전을 latest 로 올리면 안 된다 |

⚠️ `latest_version_ios` 는 **App Store 에 실제로 공개된 뒤에만** 올린다.
   승인 전에 올리면 사용자를 존재하지 않는 버전으로 보내게 된다.

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

## 2-0. 🚨 권장 안내가 '무한 루프'처럼 보이던 문제 (2026-09-01)

> "밀면 스토어로 잘 넘어가는데 **업데이트가 아니라 '열기'** 로 나온다.
>  열기를 누르면 다시 업데이트 화면. 무한 루프에 걸렸다."

### 원인 ① — **사이드로드한 기기에서는 Play 가 '열기' 로 보인다**
`adb install` 로 APK 를 직접 깔면 Play 스토어 앱이 **기기에 설치된 버전을 곧바로 갱신하지 못한다.**
그래서 스토어에 새 버전이 **이미 올라가 있어도** '업데이트' 대신 '열기' 가 보인다.

⚠️ 이건 **테스트 환경 특성이지 설정 오류가 아니다.**
   (2026-09-01 실측: Play 에는 110 / 2.0.8 이 프로덕션 전체 출시로 공개돼 있었고,
    Remote Config `latest_version_android = 2.0.8` 도 맞는 값이었다.
    기기에만 2.0.6 APK 가 사이드로드돼 있었다.)

**사이드로드 기기에서 확인하는 법**
```bash
adb uninstall com.yusung.routefinding   # 사이드로드본을 지우고
# → Play 스토어에서 정상 설치해 확인한다
```

### 원인 ② — 그래도 **갇히면 안 된다** (코드 문제)
권장(optional) 단계인데도 안내가 **네비게이터를 통째로 대체**해서,
스토어에서 돌아오면 앱이 아니라 같은 벽을 다시 만났다.

| | 이전 | 이후 |
|---|---|---|
| optional(권장) 화면 | 네비게이터를 **대체** (앱이 뒤에 없다) | 앱을 정상 렌더하고 **위에 Modal 로** 얹는다 |
| 스토어에 다녀오면 | 같은 벽을 다시 만난다 | `AppState` 가 active 가 되면 **자동으로 닫힌다** |
| 안드로이드 뒤로가기 | 막힘 | `onRequestClose` 로 닫힌다 |
| 화면 안내 | 없음 | "스토어에 '열기'로 보이면 아직 배포 중입니다. 그대로 사용하셔도 됩니다." |
| '나중에' | 작은 글씨 | **'나중에 · 계속 사용하기'** 테두리 버튼 |

⚠️ required(강제)는 그대로 **네비게이터를 대체**한다 — 닫히면 안 되는 화면이다.
⚠️ 권장 안내를 다시 네비게이터 대체로 되돌리지 말 것 (`src/App.tsx` 주석 참조).

⚠️ 넘긴 기억은 **앱이 켜져 있는 동안만** 유지된다(모듈 레벨 Set).
   저장소 의존성(AsyncStorage 등)을 새로 넣지 않기 위한 선택이다 —
   앱을 껐다 켜면 다시 뜨지만, 이제는 벽이 아니라 **닫을 수 있는 안내**라 갇히지 않는다.

### 2026-09-01 확인된 상태 — **양쪽 다 2.0.8 공개 완료**
| | 값 |
|---|---|
| Play | 110 / **2.0.8** — 프로덕션 전체 출시 |
| App Store | **2.0.8** — 배포 준비됨(공개) |
| `latest_version_android` / `_ios` | **2.0.8 이 맞다** — 되돌릴 필요 없다 |

### 그래도 남는 규칙
`latest_version_*` 은 **그 스토어에 공개된 뒤에** 올린다.
두 스토어의 공개 시점이 다를 수 있으니 `latest_version_android` / `latest_version_ios` 는 **따로** 관리한다.

---

## 2-0-2. ⏳ **Play 에 '공개됨' 이라도 기기에는 아직 안 온다** (2026-09-01 실측)

사이드로드가 아닌 **일반 사용자**(2.0.7)에게도 같은 증상이 나왔다 —
안내는 뜨는데 Play 는 '열기'.

### 근거
| | 값 |
|---|---|
| 110 / 2.0.8 상태 | Google Play 에 제공됨 · 전체 출시 (9/1 오전 8:57) |
| **설치한 사용자 수** | **0.00%** ← 아무 기기에도 아직 안 갔다 |
| 그 기기의 Play 화면 | '열기' (업데이트 버튼 없음) |

Play 는 **게시 완료와 기기 배포가 별개**다. 게시 후에도 각 기기의 Play 앱이
카탈로그를 새로 받기까지 **몇 시간~하루** 걸린다. 그동안 사용자는
"업데이트하라는데 업데이트가 없다" 를 겪는다.

### 📌 규칙 — **RC 수정은 출시 다음 날** (2026-09-01 사용자 지시, 상시 적용)
출시 절차를 **이틀로 나눈다.**

| | 하는 일 |
|---|---|
| **출시 당일** | 빌드 → 스토어 업로드 → 출시. **RC 는 건드리지 않는다** |
| **다음 날** | Play Console ▸ 최신 버전 및 번들 ▸ **'설치한 사용자 수' 가 0.00% 를 벗어났는지** 확인 → 벗어났으면 `latest_version_android` / `latest_version_ios` 를 새 버전으로 게시 |

- 당일에 올리면 사용자가 "새 버전이 있습니다 → 스토어엔 '열기'" 를 겪는다.
- 두 스토어의 전파 속도가 다를 수 있으므로 **android / ios 를 따로** 확인하고 따로 올린다.
- 이미 올려서 사용자가 겪고 있다면 → **직전 버전으로 내렸다가** 다음 날 다시 올린다.
- 이미 올려 버려서 사용자가 안내를 계속 본다면 → **RC 를 직전 버전으로 내렸다가 다음 날 다시 올린다.**
  (예: `latest_version_android` 를 잠시 `2.0.7` 로)

### 사용자가 직접 앞당기는 법 (문의 왔을 때 안내용)
Play 스토어 ▸ 프로필 ▸ **앱 및 기기 관리** ▸ **업데이트 사용 가능** ▸ 아래로 당겨 새로고침.
그래도 안 보이면 설정 ▸ 애플리케이션 ▸ Google Play 스토어 ▸ 저장공간 ▸ **캐시 삭제**.

---

## 2-0-1. 🧪 업데이트 안내를 테스트하는 법

게이트 판정은 **`APP_VERSION`(= `package.json` 의 version) vs Remote Config `latest_version_*`** 뿐이다.
그래서 **RC 를 건드리지 않고** 설치된 앱 버전만 낮추면 실제 사용자에게 영향 없이 시험할 수 있다.

### 방법 A — 로컬 빌드로 (권장 · 실사용자 영향 0)
```bash
cd ~/StudioProjects/routefinding/app

# 1) package.json 의 version 을 임시로 낮춘다  "2.0.8" → "2.0.0"
#    ⚠️ -PROUTEFINDING_VERSION_NAME 으로는 안 된다. 그건 매니페스트만 바꾸고
#       APP_VERSION 은 여전히 package.json 을 읽는다 (§2-1)

# 2) 실행
yarn start --reset-cache      # 터미널 A — 번들 캐시를 반드시 비운다
yarn android                  # 터미널 B (또는 yarn ios --device)
```
확인할 것 (안드로이드·iOS 공통)
- [ ] 권장 안내가 뜬다 (`현재 2.0.0 → 최신 2.0.8`)
- [ ] **뒤에 앱이 보인다** (네비게이터를 가리지 않는다)
- [ ] 밀면 스토어가 열린다
- [ ] **스토어에서 앱으로 돌아오면 안내가 저절로 닫힌다** ← 이번 수정의 핵심
- [ ] '나중에 · 계속 사용하기' 로 닫힌다
- [ ] (안드로이드) **하드웨어 뒤로가기**로도 닫힌다
- [ ] 강제 단계 확인은 RC 대신 `min_version_*` 를 임시로 올려서 — **콘솔이 아니라 로컬에서**
      `updateService.ts` 의 DEFAULTS 로 시험하지 말 것(fetch 하면 덮어써진다)

**끝나면 `package.json` 을 원래 값으로 되돌린다.** 테스트 중 만든 빌드는 배포하지 않는다.

### 방법 B — 스토어 다운로드까지 진짜로 확인 (안드로이드)
사이드로드(`adb install`)한 앱은 **Play 앱 서명 키가 달라 Play 가 업데이트하지 못한다.**
그래서 진짜 흐름을 보려면 **내부 테스트 트랙**을 쓴다.
1. Play Console ▸ 테스트 ▸ **내부 테스트** 에 다음 versionCode(예 111 / 2.0.9) AAB 업로드
2. 내부 테스터 링크로 기기에 설치(= Play 가 설치한 앱이 된다)
3. Remote Config `latest_version_android` 를 잠시 **2.0.9** 로 게시
4. 2.0.8 이 깔린 기기에서 앱 실행 → 안내 → 스토어에 **'업데이트'** 가 보인다
5. 확인 후 RC 를 되돌린다

### 방법 B — iOS
1. **TestFlight** 로 다음 빌드(2.0.9)를 배포
2. RC `latest_version_ios` 를 잠시 **2.0.9** 로 게시
3. 2.0.8 이 깔린 기기에서 확인 → App Store 로 이동
   ⚠️ TestFlight 로 깐 앱은 App Store 가 업데이트하지 않는다. **스토어 이동·복귀 동작만** 본다
4. 확인 후 RC 를 되돌린다

⚠️ 3~5번처럼 RC 를 올리면 **그동안 실사용자 전원에게 안내가 뜬다.** 짧게 하고 반드시 되돌린다.
   길게 시험해야 하면 Remote Config **조건(Conditions)** 으로 대상을 좁힌다.

---

## 2-1. 🚨 `-PROUTEFINDING_VERSION_NAME` 을 쓰면 안내가 오작동한다 (2026-08-13 실측)

`-PROUTEFINDING_VERSION_NAME=2.0.2` 로 빌드하면 **안드로이드 매니페스트의 versionName 만** 바뀐다.
앱이 업데이트 판단에 쓰는 `APP_VERSION` 은 `src/constants/version.ts` → **`package.json` 의 version** 이다.
JS 는 gradle 의 `-P` 값을 보지 못한다.

**실제로 벌어진 일**

| | 값 |
|---|---|
| Play 스토어 표시 버전 | 2.0.2 (versionCode 103, 배포 완료) |
| `package.json` version = 앱 내부 `APP_VERSION` | **2.0.0** |

이 상태에서 `latest_version_android = 2.0.2` 로 게시하면
**최신 버전을 쓰는 사용자까지** 매번 '새 버전이 있습니다'를 보게 된다.
`min_version_android = 2.0.2` 로 하면 **전원이 앱을 못 쓴다.**

**규칙**
- Remote Config 값은 **`package.json` 의 version 기준**으로 정한다. 스토어 표시 버전이 아니다
- 출시할 땐 `package.json` 을 먼저 올리고, `-P` 는 **versionCode 만** 넘긴다
  ```bash
  # package.json 을 "2.0.3" 으로 고친 뒤
  ./gradlew bundleRelease -PROUTEFINDING_VERSION_CODE=104
  # versionName 은 package.json 에서 자동으로 2.0.3 이 된다
  ```
- iOS 는 `MARKETING_VERSION` 을 같은 값으로 손수 맞춘다

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

## 4. iOS 스토어 주소 — ✅ 설정 완료 (2026-08-06)

`APP_STORE_ID = '6798447337'` (`src/constants/version.ts`).
App Store Connect → 앱 정보 → Apple ID 값이다.

바꿔야 하면 **앱을 다시 배포하지 않고** Remote Config `store_url_ios` 에 전체 주소를 넣으면 된다:
`https://apps.apple.com/kr/app/id6798447337`

---

## 5. 확인 방법

가장 확실한 방법은 **기준을 현재 버전보다 높게** 잡아 보는 것이다.

1. 기기에 v2.0.0 설치
2. 콘솔에서 `latest_version_android = 2.0.1` 로 게시 → 앱 재시작 → '새 버전이 있습니다'(나중에 가능)
3. `min_version_android = 2.0.1` 로 게시 → 앱 재시작 → **닫을 수 없는 화면**
4. 확인이 끝나면 **반드시 원래대로 되돌린다**

> 디버그 빌드는 캐시 간격이 0이라 게시 즉시 반영된다. release 는 최대 1시간.
