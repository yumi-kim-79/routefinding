/**
 * AdMob 광고 단위 ID.
 *
 * ⚠️ **실제 ID를 여기 한 곳에서만 관리한다.** 화면 코드에 ID를 흩뿌리면
 *    나중에 단위를 바꿀 때 어디를 고쳐야 하는지 알 수 없게 된다.
 *
 * ── 값의 종류 (헷갈리기 쉬움) ────────────────────────────────────────────
 *  게시자 ID `pub-4653853586463291`만으로는 광고를 띄울 수 없다. 앱마다 두 개가 필요하다:
 *    1) **앱 ID**      `ca-app-pub-…`**`~`**`…`  (물결) → `app/app.json`
 *    2) **광고 단위 ID** `ca-app-pub-…`**`/`**`…` (슬래시) → 이 파일 REAL_BANNER
 *  iOS와 Android는 AdMob 콘솔에서 **서로 다른 앱**이라 값이 각각 다르다.
 *
 * ⚠️ 개발 중에는 실제 단위를 쓰면 안 된다 — 자기 광고를 자기가 보면 **무효 트래픽**으로
 *    계정이 정지될 수 있다. 그래서 `__DEV__`에서는 항상 테스트 ID를 쓴다.
 */
import { Platform } from 'react-native';
import { TestIds } from 'react-native-google-mobile-ads';

/** AdMob 게시자 ID (앱/단위 ID의 앞부분) */
export const ADMOB_PUBLISHER_ID = 'pub-4653853586463291';

/**
 * 실제 배너 광고 단위 ID (2026-08-05 양쪽 다 적용 완료).
 * 비우면 자동으로 테스트 광고로 되돌아간다.
 */
const REAL_BANNER = Platform.select({
  // 'Android 하단 배너' 단위. ⚠️ v1(Flutter) 시절 '메인배너' 단위는 그대로 두었다 —
  //   같은 단위를 두 앱이 나눠 쓰면 어느 쪽 수익인지 보고서에서 구분되지 않는다.
  android: 'ca-app-pub-4653853586463291/5365131997',
  ios: 'ca-app-pub-4653853586463291/6926725756',
  default: '',
});

/**
 * 🔧 **임시: 실광고 대신 테스트 광고를 강제한다** (2026-08-05).
 *
 * 왜: release 빌드에서 **양쪽 다 배너가 안 보였다.** 이때 원인이 두 가지인데
 * 화면만 봐서는 구분이 안 된다:
 *   (a) 연동이 잘못됐다 (ID·초기화·레이아웃)
 *   (b) 연동은 맞는데 **새로 만든 광고 단위라 아직 재고가 안 붙었다**
 *       — AdMob 신규 단위는 첫 노출까지 보통 몇 시간, 길면 24시간 걸린다.
 *       특히 iOS 앱은 아직 App Store에 없어서 더 적게 채워진다.
 *
 * 구글 테스트 광고는 **항상 100% 채워진다.** 그래서 테스트로 한 번 띄워 보면
 * (a)인지 (b)인지 바로 갈린다. 배너가 보이면 연동은 정상이고 기다리면 되는 것이다.
 *
 * ✅ 확인이 끝나면 **이 값을 `false`로 되돌린다** (그래야 수익이 잡힌다).
 */
export const FORCE_TEST_ADS = true;

/** 화면에서 쓸 배너 단위 ID (개발 빌드거나 실제 ID가 없으면 테스트 광고) */
export const BANNER_AD_UNIT_ID =
  __DEV__ || FORCE_TEST_ADS || !REAL_BANNER ? TestIds.BANNER : REAL_BANNER;

/** 실제 광고가 나가는 상태인지 (화면에 '테스트' 안내를 띄울지 판단용) */
export const IS_TEST_AD = BANNER_AD_UNIT_ID === TestIds.BANNER;
