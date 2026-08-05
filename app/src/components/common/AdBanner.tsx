/**
 * 하단 배너 광고 (AdMob) — iOS·안드로이드 **동일 동작**.
 *
 * 설계 원칙:
 *  1) **광고가 없으면 자리도 없다.** 채워지기 전이나 실패했을 때 빈 회색 띠를 남기면
 *     화면이 잘린 것처럼 보인다. 로드에 성공한 뒤에만 높이를 준다.
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
        // 로드 전에는 높이를 주지 않는다 (빈 띠 방지)
        loaded ? styles.wrap : styles.hidden,
        loaded ? { borderTopColor: colors.divider, backgroundColor: colors.surface } : null,
      ]}
    >
      <BannerAd
        unitId={BANNER_AD_UNIT_ID}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        onAdLoaded={() => setLoaded(true)}
        onAdFailedToLoad={() => {
          // 노출 실패는 흔하다(재고 없음·네트워크). 조용히 감춘다
          setLoaded(false);
          setFailed(true);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth },
  /** 로드 전: 화면 흐름에서 완전히 빠진다 */
  hidden: { height: 0, overflow: 'hidden' },
});
