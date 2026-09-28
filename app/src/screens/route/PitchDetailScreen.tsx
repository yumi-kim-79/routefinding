/**
 * 피치 상세 — 개념도/제보 상세의 피치 한 줄을 눌렀을 때 여는 화면.
 *
 * ⚠️ 왜 만들었나 (2026-08-29 사용자 보고:
 *    "피치가 있는 개념도에 피치 상세페이지가 안 열리고, 피치 이미지가 아니라 루트 전체 이미지가 보인다")
 *
 *   원인이 둘이었다.
 *   1) `MainNavigator`에 PitchDetail이 **플레이스홀더**로만 등록돼 있었고,
 *      앱 어디에서도 그 라우트로 이동하지 않았다 → 피치 상세는 애초에 열리지 않았다.
 *   2) 피치 썸네일을 누르면 `images.indexOf(피치사진)`으로 인덱스를 찾아 뷰어를 열었는데,
 *      그 `images`는 `conceptImages(c)` = **루트 대표 사진 목록**이다.
 *      피치 사진(`pitch.imageUrls`)은 거기 애초에 들어있지 않아 항상 `-1` → `0`으로 떨어졌고,
 *      결과적으로 **루트 첫 사진**이 열렸다. 게다가 `imageUrls[0]` 한 장만 썼기 때문에
 *      피치에 사진이 여러 장이어도 나머지는 볼 방법이 없었다.
 *
 *   → 이 화면이 피치 사진을 **피치 자신의 목록**으로 연다. 두 문제가 함께 해결된다.
 *
 * ── 📐 2026-08-29 레이아웃 (사용자 보고: "기종에 따라 아래 정보가 가려진다") ──
 *   처음엔 사진을 **세로로 쌓았다**. 사진이 2장이면 그것만으로 520dp 를 먹어
 *   화면이 짧은 기기에서는 '피치 정보'가 접힌 부분 아래로 밀려났다.
 *   등반자가 이 화면에서 정작 필요한 건 **길이·난이도·장비**인데 그게 안 보이면 화면의 의미가 없다.
 *
 *   → 사진은 **가로로 한 장씩** 넘겨 보고(높이는 화면 높이에 비례해 잡는다),
 *     정보는 항상 첫 화면에 들어오게 한다. 자세히 볼 때는 눌러서 전체화면으로 연다.
 *   ⚠️ 여기 가로 ScrollView 는 괜찮다 — 핀치 확대는 **전체화면 뷰어**에서만 한다
 *     (뷰어 안에 ScrollView 를 넣으면 안 되는 이유는 ConceptImageViewer.tsx 머리말 참조).
 *
 * 데이터: 피치는 부모 문서의 `pitches` 배열 원소라 따로 읽을 문서가 없다
 *   (docs/02_DATA_MODEL.md §6). 그래서 재조회 없이 파라미터로 받은 값을 그대로 그린다.
 *   피치를 고치는 곳은 개념도 수정 화면이고, 거기서 돌아오면 목록이 다시 읽히므로
 *   이 화면이 낡은 값을 들고 있을 구간이 없다.
 */
import React, { useCallback, useLayoutEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Text } from '../../components/common/Text';
import { RemoteImage } from '../../components/common/RemoteImage';
import { useTheme } from '../../theme';
import type { MainStackParamList } from '../../navigation/types';
import { ConceptImageViewer } from './components/ConceptImageViewer';

type Nav = NativeStackNavigationProp<MainStackParamList, 'PitchDetail'>;
type Rt = RouteProp<MainStackParamList, 'PitchDetail'>;

/** 라벨 : 값 한 줄 (개념도 상세와 같은 모양) */
const InfoRow: React.FC<{ label: string; value?: string | number }> = ({
  label,
  value,
}) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return (
    <View style={styles.infoRow}>
      <Text variant="label" color="textSecondary" style={styles.infoLabel}>
        {label}
      </Text>
      <Text variant="body" style={styles.infoValue}>
        {String(value)}
      </Text>
    </View>
  );
};

export const PitchDetailScreen: React.FC = () => {
  const { colors, radius } = useTheme();
  /**
   * iOS 홈 인디케이터(하단 바) 높이. 안드로이드에서는 대개 0 이다.
   * 이걸 빼면 화면이 짧은 아이폰에서 **마지막 정보 줄('장비')이 홈 바에 걸린다** —
   * 44차에서 고친 것과 같은 종류의 문제가 iOS 쪽에만 남는 셈이라 함께 처리한다.
   */
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const { pitch, pitchNumber, routeTitle } = params;

  const [viewer, setViewer] = useState<{ open: boolean; index: number }>({
    open: false,
    index: 0,
  });
  /** 가로로 넘겨 보는 사진의 현재 위치 ("2 / 3" 표시용) */
  const [page, setPage] = useState(0);

  const label = pitch.name?.trim() ? pitch.name.trim() : `${pitchNumber}피치`;

  useLayoutEffect(() => {
    navigation.setOptions({ title: label });
  }, [navigation, label]);

  /** 빈 문자열·중복 URL을 걸러낸다 (제보 폼에서 빈 칸이 저장된 문서가 실제로 있다) */
  const images = (pitch.imageUrls ?? []).filter(
    (u, i, arr): u is string => !!u && arr.indexOf(u) === i,
  );

  const openViewer = useCallback(
    (index: number) => setViewer({ open: true, index }),
    [],
  );

  const imageWidth = width - 32;
  /**
   * 사진 높이를 **화면 높이에 비례**해 잡는다.
   * 고정값(260)으로 두면 화면이 짧은 기기에서 '피치 정보'가 밀려난다 —
   * 실제로 그렇게 보고가 들어왔다(2026-08-29). 아주 큰 화면에서 사진만 커지는 것도 막는다.
   */
  const photoHeight = Math.round(Math.max(150, Math.min(300, height * 0.34)));
  const pageWidth = imageWidth + GAP;

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        { paddingBottom: 24 + insets.bottom },
      ]}
    >
      {/*
        ⚠️ 피치 이름(label)은 **헤더 제목**이 이미 보여준다 — 여기서 또 크게 쓰면
           같은 글자가 두 번 나오면서 세로 공간만 먹는다. 어느 루트인지만 한 줄로 적는다.
      */}
      {routeTitle ? (
        <Text variant="caption" color="textSecondary" style={styles.routeTitle}>
          {routeTitle}
        </Text>
      ) : null}

      {/*
        피치 사진 — 루트 사진이 아니라 이 피치의 사진만 나온다.
        ⚠️ 세로로 쌓지 말 것. 아래 '피치 정보'가 화면 밖으로 밀려난다(2026-08-29 보고).
      */}
      {images.length > 0 ? (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            /* 페이지 폭이 화면 폭과 달라서 pagingEnabled 대신 스냅 간격을 직접 준다 */
            snapToInterval={pageWidth}
            decelerationRate="fast"
            disableIntervalMomentum
            scrollEventThrottle={16}
            onScroll={(e) =>
              setPage(
                Math.round(e.nativeEvent.contentOffset.x / pageWidth),
              )
            }
            style={styles.pager}
            /* 바깥 padding(16) 을 상쇄해 사진이 화면 가장자리까지 자연스럽게 흐르게 한다 */
            contentContainerStyle={styles.pagerContent}
          >
            {images.map((uri, i) => (
              <Pressable
                key={`${i}-${uri}`}
                accessibilityRole="imagebutton"
                accessibilityLabel={`사진 ${i + 1} 크게 보기`}
                onPress={() => openViewer(i)}
                style={{
                  width: imageWidth,
                  marginRight: i === images.length - 1 ? 0 : GAP,
                }}
              >
                <RemoteImage
                  uri={uri}
                  style={{
                    width: imageWidth,
                    height: photoHeight,
                    borderRadius: radius.md,
                    backgroundColor: colors.surfaceVariant,
                  }}
                  resizeMode="contain"
                  // 사용자가 지금 보려고 들어온 사진이다 — 목록 썸네일보다 먼저 처리한다
                  priority="high"
                  // 목록에서 이미 받아둔 축소본을 먼저 띄우고 원본을 뒤이어 얹는다
                  progressive
                />
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.hintRow}>
            <Text variant="caption" color="textSecondary" style={styles.hintText}>
              사진을 누르면 크게 볼 수 있습니다
            </Text>
            {images.length > 1 ? (
              <Text variant="caption" color="textSecondary">
                {Math.min(page, images.length - 1) + 1} / {images.length}
              </Text>
            ) : null}
          </View>
        </>
      ) : (
        <View
          style={[
            styles.noImage,
            { backgroundColor: colors.surfaceVariant, borderRadius: radius.md },
          ]}
        >
          <Text variant="body" color="disabled">
            이 피치에 등록된 사진이 없습니다
          </Text>
        </View>
      )}

      <View style={[styles.section, { borderTopColor: colors.divider }]}>
        <Text variant="title" style={styles.sectionTitle}>
          피치 정보
        </Text>
        <InfoRow
          label="길이"
          value={
            pitch.length === undefined || pitch.length === null || pitch.length === ''
              ? undefined
              : `${pitch.length}m`
          }
        />
        <InfoRow label="등반 형태" value={pitch.style} />
        <InfoRow label="난이도" value={pitch.difficulty} />
        <InfoRow label="장비" value={pitch.gear} />
        {!pitch.length && !pitch.style && !pitch.difficulty && !pitch.gear ? (
          <Text variant="body" color="disabled">
            등록된 정보가 없습니다
          </Text>
        ) : null}
      </View>

      <ConceptImageViewer
        visible={viewer.open}
        images={images}
        initialIndex={viewer.index}
        onClose={() => setViewer((v) => ({ ...v, open: false }))}
      />
    </ScrollView>
  );
};

/** 사진 사이 간격 (스냅 계산에 그대로 쓰이므로 상수로 둔다) */
const GAP = 8;

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 24 },
  routeTitle: { marginBottom: 8 },
  pager: { marginHorizontal: -16 },
  pagerContent: { paddingHorizontal: 16 },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  hintText: { flex: 1 },
  noImage: {
    height: 140,
    marginTop: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: { marginTop: 14, paddingTop: 14, borderTopWidth: 1 },
  sectionTitle: { marginBottom: 6 },
  infoRow: { flexDirection: 'row', paddingVertical: 4 },
  infoLabel: { width: 96 },
  infoValue: { flex: 1 },
});
