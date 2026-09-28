/**
 * 원격 이미지 — GCS 원본 주소를 다운로드 URL로 바꿔서 띄운다.
 *
 * 개념도 사진 URL이 `storage.googleapis.com` 형식으로 저장돼 있어 그냥 쓰면 403이다
 * (`services/imageUrlService.ts` 주석 참조). 화면마다 따로 처리하지 않도록 여기서 흡수한다.
 * 변환이 필요 없는 URL이면 추가 요청 없이 그대로 그린다.
 *
 * ── 🚀 2026-08-25: 목록 썸네일 속도 ────────────────────────────────────────
 *  · `variant="thumb"` — 40KB 축소본(`_400x400`)을 쓴다. 없으면 자동으로 원본
 *  · `priority` — 상세/뷰어는 'high'. 목록 썸네일에 밀리지 않게 큐 앞에 선다
 *  · 이미 변환해 둔 URL은 **첫 렌더에 바로** 그린다(깜빡임 제거)
 *  · `fadeDuration={0}` — 안드로이드 기본 페이드가 목록에서 잔상처럼 보인다
 *
 * ── 🚀 2026-08-28: 점진적 로딩 + 상태 표시 (사용자 피드백) ─────────────────
 *  "처음 '이미지 없음'으로 보이다가 로딩되니 이미지가 없다고 착각할 것 같다.
 *   그리고 이미지가 많은 루트는 여전히 늦다."
 *
 *  · `progressive` — **40KB 썸네일을 먼저 띄우고** 원본이 준비되면 위에 얹는다.
 *    목록에서 들어온 경우 썸네일은 대개 이미 받아둔 것이라 **즉시** 그려진다.
 *    사용자는 기다리는 대신 흐릿한 사진을 곧바로 보고, 잠시 뒤 선명해진다.
 *  · 상태를 셋으로 분리했다:
 *      사진 자체가 없다      → `emptyLabel`("사진 없음")
 *      있는데 받는 중이다    → 스피너 + **"불러오는 중"**
 *      받다가 실패했다       → "불러오지 못함"
 *    ⚠️ 예전에는 로딩 중에도 "이미지 없음"이 보여 사진이 없는 줄 알았다.
 *  · `defer` 는 **원본에만** 적용된다. 썸네일은 가벼우니 언제나 먼저 띄운다.
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  View,
  type ImageStyle,
  type StyleProp,
} from 'react-native';
import { Text } from './Text';
import { useTheme } from '../../theme';
import {
  cachedImageUrl,
  cachedThumbnailUrl,
  isRawGcsUrl,
  resolveImageUrl,
  resolveThumbnailUrl,
  type ImagePriority,
} from '../../services/imageUrlService';

interface RemoteImageProps {
  uri: string | undefined | null;
  style?: StyleProp<ImageStyle>;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
  /** 사진 자체가 없을 때 보여줄 문구 (로딩 중에는 쓰지 않는다) */
  emptyLabel?: string;
  /** 'high' = 지금 보고 있는 사진(상세·뷰어), 'low' = 목록 썸네일 */
  priority?: ImagePriority;
  /** true 면 **원본** 로딩을 미룬다 (상세 캐러셀의 순차 로딩용). 썸네일은 그대로 뜬다 */
  defer?: boolean;
  /** 원본이 화면에 올라온 순간 (순차 로딩 진행용) */
  onLoaded?: () => void;
  /**
   * 'thumb' — 목록 카드처럼 작게 보이는 자리. 축소본만 쓴다.
   * ⚠️ 상세·전체화면에는 쓰지 말 것. 확대하면 뭉개진다.
   */
  variant?: 'full' | 'thumb';
  /** 썸네일을 먼저 띄우고 원본을 뒤이어 얹는다 (상세·전체화면 권장) */
  progressive?: boolean;
  /**
   * 안드로이드 디코딩 방식 (iOS 는 무시한다).
   *
   * ⚠️ 기본값을 **`resize`** 로 둔 이유 (Play Console '비트맵 이미지 최적화', 2026-08-29)
   *   기본값 `auto` 는 큰 사진을 원본 해상도로 디코딩해 두고 그리기만 줄이는 쪽을
   *   고를 때가 있다. 2048px 사진 한 장이 **16MB 비트맵**이 되고, 목록에 여러 장이면
   *   그대로 메모리 경고로 이어진다(이 앱이 `largeHeap` 을 켜야 했던 이유이기도 하다).
   *   `resize` 는 **디코딩 단계에서** 화면 크기에 맞춰 줄인다 — 메모리가 크게 줄고
   *   목록에서는 화질 차이가 보이지 않는다.
   *
   * ⚠️ 확대해서 보는 자리(전체화면 뷰어)에는 `'auto'` 를 넘길 것.
   *    `resize` 로 줄여서 디코딩한 비트맵을 확대하면 뭉개진다.
   */
  resizeMethod?: 'auto' | 'resize' | 'scale' | 'none';
}

export const RemoteImage: React.FC<RemoteImageProps> = ({
  uri,
  style,
  resizeMode = 'cover',
  emptyLabel = '사진 없음',
  priority = 'low',
  defer = false,
  onLoaded,
  variant = 'full',
  progressive = false,
  resizeMethod = 'resize',
}) => {
  const { colors } = useTheme();

  /*
   * ⚠️ 초기값을 **동기로** 캐시에서 꺼낸다.
   *    목록을 스크롤하면 카드가 재활용되며 같은 이미지가 계속 다시 마운트되는데,
   *    매번 비동기로 조회하면 한 프레임씩 스피너가 번쩍인다 (2026-08-28).
   */
  /** 흐릿하게 먼저 보여줄 축소본 */
  const [thumbUrl, setThumbUrl] = useState<string | null>(() =>
    progressive && variant === 'full' ? cachedThumbnailUrl(uri) ?? null : null,
  );
  /** 실제로 보여줄 이미지 (variant='thumb' 면 축소본, 아니면 원본) */
  const [mainUrl, setMainUrl] = useState<string | null>(() =>
    variant === 'full'
      ? cachedImageUrl(uri) ?? null
      : cachedThumbnailUrl(uri) ?? null,
  );
  const [mainLoaded, setMainLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  // ── 미리 띄울 축소본 ──────────────────────────────────────────────────
  useEffect(() => {
    if (!progressive || !uri || variant === 'thumb') {
      setThumbUrl(null);
      return;
    }
    const known = cachedThumbnailUrl(uri);
    if (known) {
      setThumbUrl(known);
      return;
    }
    let alive = true;
    // ⚠️ 세 번째 인자 false — 축소본이 없으면 **그냥 포기**한다.
    //    원본을 미리보기로 받아 오면 같은 파일을 두 번 받는 셈이라 의미가 없다.
    void resolveThumbnailUrl(uri, priority, false).then((url) => {
      if (alive && url) {
        setThumbUrl(url);
      }
    });
    return () => {
      alive = false;
    };
  }, [uri, progressive, priority, variant]);

  // ── 본 이미지 ────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    setFailed(false);
    setMainLoaded(false);

    if (!uri) {
      setMainUrl(null);
      return;
    }
    const known =
      variant === 'full' ? cachedImageUrl(uri) : cachedThumbnailUrl(uri);
    if (known !== undefined) {
      setMainUrl(known || null);
      return;
    }
    if (!isRawGcsUrl(uri) && variant === 'full') {
      setMainUrl(uri);
      return;
    }
    if (defer) {
      // 아직 차례가 아니다 — 썸네일만 띄우고 기다린다
      setMainUrl(null);
      return;
    }

    setMainUrl(null);
    const load =
      variant === 'thumb'
        ? resolveThumbnailUrl(uri, priority)
        : resolveImageUrl(uri, priority);
    void load.then((url) => {
      if (alive) {
        setMainUrl(url || null);
      }
    });
    return () => {
      alive = false;
    };
  }, [uri, priority, defer, variant]);

  // 1) 사진 자체가 없다
  if (!uri) {
    return (
      <View style={[style, styles.center, { backgroundColor: colors.surfaceVariant }]}>
        <Text variant="caption" color="disabled">
          {emptyLabel}
        </Text>
      </View>
    );
  }

  // 2) 받다가 실패했고 대신 보여줄 것도 없다
  if (failed && !thumbUrl) {
    return (
      <View style={[style, styles.center, { backgroundColor: colors.surfaceVariant }]}>
        <Text variant="caption" color="disabled">
          불러오지 못함
        </Text>
      </View>
    );
  }

  /*
   * 스피너는 **보여줄 게 아직 아무것도 없을 때만** 띄운다.
   * 캐시에서 즉시 꺼낸 이미지 위에 한두 프레임 스피너가 겹쳐 번쩍이면
   * 목록이 지저분해 보인다 (2026-08-28).
   */
  const showSpinner = !thumbUrl && !mainUrl && !mainLoaded;

  return (
    <View style={[style, styles.wrap, { backgroundColor: colors.surfaceVariant }]}>
      {/* 흐릿한 축소본 — 원본이 올라오면 가려진다 */}
      {thumbUrl && !mainLoaded ? (
        <Image
          source={{ uri: thumbUrl }}
          style={StyleSheet.absoluteFill}
          resizeMode={resizeMode}
          resizeMethod={resizeMethod}
          fadeDuration={0}
        />
      ) : null}

      {mainUrl ? (
        <Image
          source={{ uri: mainUrl }}
          style={StyleSheet.absoluteFill}
          resizeMode={resizeMode}
          // 디코딩 단계에서 화면 크기로 줄인다 (비트맵 메모리 — 위 prop 주석 참조)
          resizeMethod={resizeMethod}
          // 안드로이드 기본 페이드는 목록을 빠르게 내릴 때 잔상처럼 보인다
          fadeDuration={0}
          onLoad={() => {
            setMainLoaded(true);
            onLoaded?.();
          }}
          onError={() => setFailed(true)}
        />
      ) : null}

      {/* ⚠️ 로딩 중에는 "사진 없음"이 아니라 **불러오는 중**이다 (2026-08-28) */}
      {showSpinner ? (
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <ActivityIndicator size="small" color={colors.textSecondary} />
          <Text variant="caption" color="disabled" style={styles.loadingText}>
            불러오는 중
          </Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  // borderRadius 가 자식 이미지에도 먹으려면 잘라내야 한다
  wrap: { overflow: 'hidden' },
  center: { alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 4 },
});
