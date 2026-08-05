# 10. AdMob 광고 (iOS · Android 동일)

> 작성 2026-08-05. v1(Flutter)에서는 안드로이드만 광고가 나가고 있었다.
> v2는 **양쪽 플랫폼에 같은 코드로** 배너를 넣는다.

---

## 1. 지금 상태 — 무엇이 되고 무엇이 남았나

| 항목 | 상태 |
|---|---|
| 패키지 (`react-native-google-mobile-ads@14.7.2`) | `package.json`에 고정 ✅ (설치 명령은 §4) |
| 배너 컴포넌트 · 초기화 · 배치(4개 화면) | 구현 완료 ✅ |
| iOS Podfile 링크 설정 | 완료 ✅ |
| **iOS 앱 ID / 배너 단위 ID** | ✅ 실제 값 적용 (2026-08-05) |
| **Android 앱 ID / 배너 단위 ID** | ✅ 실제 값 적용 (2026-08-05) |

**release 빌드에서 양쪽 다 실제 광고가 나간다.**

| | 앱 ID (`app.json`) | 배너 단위 (`constants/ads.ts`) |
|---|---|---|
| iOS | `ca-app-pub-4653853586463291~2632257524` | `…/6926725756` |
| Android | `ca-app-pub-4653853586463291~3817020109` | `…/5365131997` ("Android 하단 배너") |

⚠️ 디버그 빌드(`__DEV__`)에서는 **양쪽 다 테스트 광고**가 나온다(§3-3). 정상이다.

⚠️ AdMob의 안드로이드 앱에 등록된 **패키지 이름이 `com.yusung.routefinding`인지** 확인할 것.
   v1(Flutter)이 다른 패키지로 올라가 있으면 광고 요청이 거부된다.
   v1 시절 광고 단위 **'메인배너'는 건드리지 않았다** — 같은 단위를 두 앱이 나눠 쓰면
   보고서에서 어느 쪽 수익인지 구분되지 않아서다.

---

## 2. 왜 게시자 ID만으로는 안 되나

받은 값 `pub-4653853586463291`은 **게시자 ID**다. 계정을 가리킬 뿐 광고를 요청하는 주소가 아니다.
광고를 띄우려면 **앱마다 다른 두 개**가 필요하다.

| 필요한 값 | 생김새 | 어디서 | 어디에 넣나 |
|---|---|---|---|
| **앱 ID** | `ca-app-pub-4653853586463291`**`~`**`0000000000` (물결) | AdMob → 앱 → **앱 설정** | `app/app.json` |
| **배너 광고 단위 ID** | `ca-app-pub-4653853586463291`**`/`**`0000000000` (슬래시) | AdMob → 앱 → **광고 단위** → 배너 만들기 | `app/src/constants/ads.ts` |

⚠️ **`~`와 `/`를 헷갈리면 광고가 안 나온다.** 앱 ID는 물결, 단위 ID는 슬래시다.
⚠️ iOS와 Android는 **AdMob 콘솔에서 서로 다른 앱**이다. 안드로이드 값을 iOS에 넣으면 안 된다.
   iOS 앱이 아직 없으면 AdMob → 앱 → 앱 추가 → 플랫폼 **iOS** → 번들 ID `com.yusung.routefinding`.

---

## 3. 실제 ID로 바꾸는 법 (두 파일)

### 3-1. 앱 ID → `app/app.json`

```json
{
  "react-native-google-mobile-ads": {
    "android_app_id": "ca-app-pub-4653853586463291~??????????",
    "ios_app_id":     "ca-app-pub-4653853586463291~??????????"
  }
}
```

이 값은 빌드 때 각 플랫폼 설정으로 자동으로 들어간다
(Android: `AndroidManifest`의 `meta-data`, iOS: `Info.plist`의 `GADApplicationIdentifier`).
직접 손으로 넣을 필요 없다 — RNFB가 `firebase.json`을 읽는 것과 같은 방식이다.

> ⚠️ **`app.json`을 고친 뒤에는 iOS는 반드시 `pod install`을 다시 돌려야 한다.**
>    값을 심는 빌드 스크립트가 pod install 때 프로젝트에 설치되기 때문이다.

### 3-2. 광고 단위 ID → `app/src/constants/ads.ts`

`REAL_BANNER`의 `android` / `ios` 값을 채운다. 비워두면 테스트 광고가 계속 나온다.

### 3-3. 개발 중 실수 방지 (자동)

`__DEV__`(디버그 빌드)에서는 **실제 ID를 넣어도 테스트 광고만** 나간다.
자기 광고를 자기가 클릭하면 **무효 트래픽**으로 계정이 정지될 수 있어서다.
실광고 확인은 release 빌드로 해야 하고, 그때도 **직접 클릭하지 말 것**.

---

## 4. 설치 · 빌드

패키지는 `package.json`에 적혀 있지만 아직 내려받지는 않았다.

```bash
cd ~/StudioProjects/routefinding/app
corepack yarn install          # react-native-google-mobile-ads 15.8.3 내려받기
cd ios && pod install          # GoogleMobileAds + UMP pod 추가 (필수)
```

그 다음 평소대로 빌드한다(§ 아래 명령은 README/CHANGELOG와 동일).

---

## 5. 버전을 14.7.2로 고정한 이유 — **실제로 깨져 보고 내린 결정**

처음엔 최신 15.8.3을 골랐다가 **안드로이드 빌드가 깨졌다.** 원인은 우리 코드가 아니라
**구글 광고 SDK가 요구하는 Kotlin 버전**이었다.

```
:react-native-google-mobile-ads:compileReleaseKotlin FAILED
e: play-services-ads-24.6.0-api.jar!/META-INF/….kotlin_module
   was compiled with an incompatible version of Kotlin.
   The binary version of its metadata is 2.1.0, expected version is 1.9.0.
e: …/ReactNativeGoogleMobileAdsAdHelper.kt:37:52 Unresolved reference: let
```

읽는 법: `play-services-ads` **24.x**는 내부가 Kotlin 2.1로 컴파일돼 있다.
우리 프로젝트의 Kotlin 컴파일러는 **1.9.25**(RN 0.76.9 기본)라 2.1 메타데이터를 못 읽는다.
그래서 `kotlin.Unit`조차 로드하지 못하고 `let` 같은 **stdlib 기본 함수까지 미해결**로 뜬다.
(뒤쪽 `Unresolved reference` 수십 줄은 원인이 아니라 **증상**이다 — 첫 줄이 진짜 원인이다.)

| RNGMA | Android GMA SDK | Kotlin 요구 | 판정 |
|---|---|---|---|
| 15.x 전체 | 24.1 ~ 24.6 | **2.1** | ❌ 우리 툴체인과 불가 |
| **14.7.2** | **23.6.0** | 1.9 | ✅ 선택 |

### 왜 Kotlin을 2.1로 올리지 않았나

올리는 쪽이 "정공법"처럼 보이지만 대가가 크다.

- RN 0.76.9의 gradle 플러그인은 Kotlin **1.9.24**에 맞춰 배포된다. 강제로 2.1을 얹으면
  플러그인 자체가 설정 단계에서 깨질 수 있다.
- 같이 다시 컴파일되는 Kotlin 모듈이 더 있다:
  `react-native-screens`(71개) · `react-native-safe-area-context`(18개) ·
  `@react-native-documents/picker`(9개). K2 컴파일러는 더 엄격해서 어디가 터질지 모른다.
- 광고 하나 붙이자고 **안드로이드 툴체인 전체를 흔드는** 셈이 된다.

→ **RN을 0.77+로 올릴 때 Kotlin 2.x가 기본이 되므로, 그때 RNGMA도 15.x로 같이 올린다.**
  (그전까지 23.6.0으로도 광고 노출·수익에는 문제가 없다.)

### 14.7.2가 우리 환경에 맞는지 확인한 것

| 확인 항목 | 14.7.2 | 우리 프로젝트 | 판정 |
|---|---|---|---|
| Android `minSdk` | 21 | 24 | ✅ |
| Android `compileSdk` | 34 | 35 | ✅ |
| iOS 배포 타깃 (GMA 11.13 요구) | iOS 12+ | 15.1 | ✅ |
| New Architecture | `codegenConfig` 있음 (Fabric/TurboModule) | 양쪽 다 켜짐 | ✅ |
| 우리가 쓰는 JS API | `BannerAd` · `BannerAdSize.ANCHORED_ADAPTIVE_BANNER` · `TestIds.BANNER` · `mobileAds().initialize()` | 전부 존재 | ✅ |

> 📌 교훈(또 확인됨): `peerDependencies`는 호환을 보장하지 않는다.
>   이번엔 **패키지가 아니라 패키지가 끌어오는 구글 SDK**가 툴체인을 요구했다.
>   버전을 고를 때는 **전이 의존성이 요구하는 컴파일러 버전**까지 봐야 한다.

## 6. 배너를 넣은 자리

| 화면 | 위치 | 이유 |
|---|---|---|
| 개념도 목록 | 하단 탭 바로 위 | 체류가 가장 길다 |
| 지도 | 하단 탭 바로 위 | 지도가 배너 높이만큼 줄어든다 |
| 마이페이지 | 하단 탭 바로 위 | 목록·지도를 가리지 않는다 |
| 개념도 상세 | 스크롤 맨 끝 | 사진·정보를 다 본 뒤라 방해가 적다 |

**광고가 로드되기 전에는 높이를 0으로 둔다.** 빈 회색 띠가 남으면 화면이 잘린 것처럼 보인다.
로드 실패(재고 없음·네트워크)도 조용히 감춘다 — 광고 때문에 앱 기능이 막히면 안 된다.

초기화는 앱 시작이 아니라 **첫 배너가 붙을 때** 한다.
시작 속도를 개선해 둔 상태(16차)라 시작 경로에 네트워크 작업을 다시 얹지 않기 위해서다.

---

## 6-1. 배너가 안 보일 때 (2026-08-05 실전 기록)

release 빌드인데 배너가 안 보인다면 원인은 보통 둘이고, **화면만 봐서는 구분이 안 된다.**

1. **연동 문제** — ID·초기화·레이아웃
2. **재고 문제** — 연동은 맞는데 신규 광고 단위라 아직 광고가 안 붙음
   (AdMob 신규 단위는 첫 노출까지 보통 몇 시간, 길면 **24시간**.
    App Store에 아직 없는 iOS 앱은 더 적게 채워진다)

**구분하는 법**: `constants/ads.ts`의 `FORCE_TEST_ADS`를 `true`로 두고 빌드한다.
구글 테스트 광고는 **항상 100% 채워지므로**, 배너가 보이면 연동은 정상이고 기다리면 되는 것이다.
확인이 끝나면 **반드시 `false`로 되돌린다** (그래야 수익이 잡힌다).

**실패 이유 보기**:
```bash
adb logcat | grep '\[ads\]'      # Android
# iOS는 Xcode 콘솔에서 [ads] 검색
```

⚠️ 로드 전 배너를 `height: 0`으로 접지 말 것. 적응형 배너는 자기 너비를 재서 광고를
요청하므로 부모를 0으로 만들면 요청이 어그러질 수 있다. `BannerAd`는 로드 전에
아무것도 그리지 않아 **가만히 둬도 높이가 0**이다.

---

## 7. 남은 선택지 (지금은 안 넣음)

- **전면 광고**: 사용자 결정 — 배너만. 산에서 쓰는 앱이라 전면은 짜증날 수 있다.
- **UMP 동의 폼(GDPR)**: 이용자가 사실상 국내라 폼이 뜨지 않는다. 해외 배포 시 추가 검토.
- **iOS ATT(App Tracking Transparency)**: 지금은 요청하지 않는다 → iOS는 비개인화 광고로 나간다.
  넣으면 단가가 오르지만 첫 실행에 시스템 팝업이 하나 늘고 심사 문구가 필요하다.
- **SKAdNetwork 항목(Info.plist)**: 전환 추적용. 광고 노출 자체에는 필요 없다.
