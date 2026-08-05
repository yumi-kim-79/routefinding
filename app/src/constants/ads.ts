/**
 * AdMob 광고 단위 ID.
 *
 * ⚠️ **실제 ID를 여기 한 곳에서만 관리한다.** 화면 코드에 ID를 흩뿌리면
 *    나중에 단위를 바꿀 때 어디를 고쳐야 하는지 알 수 없게 된다.
 *
 * ── 지금 상태 (2026-08-05) ──────────────────────────────────────────────
 *  게시자 ID는 `pub-4653853586463291`이지만, **게시자 ID만으로는 광고를 띄울 수 없다.**
 *  필요한 건 두 가지이고 둘 다 AdMob 콘솔에서 복사해야 한다:
 *    1) **앱 ID**      `ca-app-pub-4653853586463291~0000000000`  (물결 `~`)
 *       → 앱 → 앱 설정 → 앱 ID.  이건 `app.json`에 넣는다(아래 파일 참조).
 *    2) **광고 단위 ID** `ca-app-pub-4653853586463291/0000000000` (슬래시 `/`)
 *       → 앱 → 광고 단위 → 배너 단위 생성 후 복사. 그걸 아래 BANNER에 넣는다.
 *  값을 넣기 전까지는 **구글 공식 테스트 광고**가 나온다(정상 동작 확인 가능).
 *
 * ⚠️ 개발 중에는 실제 단위를 쓰면 안 된다 — 자기 광고를 자기가 보면 **무효 트래픽**으로
 *    계정이 정지될 수 있다. 그래서 `__DEV__`에서는 항상 테스트 ID를 쓴다.
 */
import { Platform } from 'react-native';
import { TestIds } from 'react-native-google-mobile-ads';

/** AdMob 게시자 ID (앱/단위 ID의 앞부분) */
export const ADMOB_PUBLISHER_ID = 'pub-4653853586463291';

/**
 * 실제 배너 광고 단위 ID.
 * [TODO] AdMob 콘솔에서 배너 단위를 만들고 아래 두 값을 채운다. 비워두면 테스트 광고가 나온다.
 */
const REAL_BANNER = Platform.select({
  // [TODO] 안드로이드 배너 단위 ID — AdMob 콘솔에서 만든 뒤 여기에 넣는다.
  //        비어 있는 동안 안드로이드는 테스트 광고가 나간다(수익 0, 동작은 정상).
  android: '',
  ios: 'ca-app-pub-4653853586463291/6926725756',
  default: '',
});

/** 화면에서 쓸 배너 단위 ID (개발 빌드거나 실제 ID가 없으면 테스트 광고) */
export const BANNER_AD_UNIT_ID =
  __DEV__ || !REAL_BANNER ? TestIds.BANNER : REAL_BANNER;

/** 실제 광고가 나가는 상태인지 (화면에 '테스트' 안내를 띄울지 판단용) */
export const IS_TEST_AD = BANNER_AD_UNIT_ID === TestIds.BANNER;
