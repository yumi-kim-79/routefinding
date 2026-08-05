/**
 * 하단 배너 광고 (AdMob) — iOS·안드로이드 **동일 동작**.
 *
 * 설계 원칙:
 *  1) **광고가 없으면 자리도 없다.** 채워지기 전이나 실패했을 때 빈 회색 띠를 남기면
 *     화면이 잘린 것처럼 보인다.
 *     ⚠️ 단, **강제로 `height: 0`을 주면 안 된다** (2026-08-05 정정).
 *        적응형 배너는 자기 너비를 재서 광고를 요청하는데, 부모가 0이면 요청 자체가
 *        어그러질 수 있다. `BannerAd`는 로드 전에는 아무것도 그리지 않아
 *        **가만히 둬도 높이가 0**이다 — 눌러 담을 필요가 없었다.
 *  2) **앱 기능을 막지 않는다.** 초기화·로드 실패는 전부 삼키고 배너만 사라진다.
 *  3) 크기는 `ANCHORED_ADAPTIVE_BANNER` — 기기 폭에 맞춰 구글이 높이를 정한다.
 *     고정 320x50을 쓰면 태블릿·큰 화면에서 작게 떠 수익이 떨어진다.
 *
 * 배치: 하단 탭 **바로 위**. 탭을 가리지 않도록 화면 루트의 마지막 자식으로 둔다.
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { BANNER_AD_UNIT_ID } from '../../constants/ads';
import { ensureAdsInitialized } from '../../services/adsService';
import { useTheme } from '../../theme';

export const AdBanner: React.FC = () => {
  const { colors } = useTheme();
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    void ensureAdsInitialized().then(() => {
      if (alive) {
        setReady(true);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!ready || failed) {
    return null;
  }

  return (
    <View
      style={[
        styles.wrap,
        // 테두리·배경도 로드된 뒤에만 — 안 그러면 빈 화면에 실선 한 줄이 남는다
        loaded
          ? {
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: colors.divider,
              backgroundColor: colors.surface,
            }
          : null,
      ]}
    >
      <BannerAd
        unitId={BANNER_AD_UNIT_ID}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        onAdLoaded={() => setLoaded(true)}
        onAdFailedToLoad={(e: unknown) => {
          /*
           * 노출 실패는 흔하다(재고 없음·네트워크). 화면에서는 조용히 감추되,
           * **이유는 반드시 남긴다.** 예전엔 통째로 삼켜서 "연동이 틀렸는지,
           * 그냥 재고가 없는지"를 구분할 방법이 없었다 (2026-08-05).
           * `adb logcat | grep '\[ads\]'` / Xcode 콘솔에서 확인한다.
           */
          console.warn('[ads] 배너 로드 실패:', BANNER_AD_UNIT_ID, e);
          setLoaded(false);
          setFailed(true);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  /** 로드 전에는 BannerAd가 아무것도 그리지 않으므로 이 View의 높이도 0이 된다 */
  wrap: { alignItems: 'center' },
});
