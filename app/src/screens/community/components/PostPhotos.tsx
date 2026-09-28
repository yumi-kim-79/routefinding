/**
 * 글 사진 — **1:1 정사각 가로 캐러셀** (인스타 형태).
 *
 * 설계 결정 (2026-09-07)
 *  · 카드 폭 = 화면 폭. 좌우 여백을 두지 않는다 — 인스타 느낌의 핵심이다
 *  · **크롭하지 않는다.** `resizeMode="cover"` 로 **표시만** 정사각으로 맞춘다.
 *    크롭 라이브러리를 새로 넣지 않으려는 선택이고, 원본 비율은 전체화면 뷰어에서 그대로 보인다
 *  · 목록이라 `variant="thumb"`(40KB 축소본). 원본은 뷰어에서만 받는다
 *
 * ⚠️ 여기 가로 ScrollView 는 **안전하다.** 35·37차의 핀치 문제는
 *    *전체화면 뷰어 안에서* ScrollView 와 제스처가 경쟁해 생긴 것이고,
 *    이 카드는 확대를 하지 않는다.
 *    ⚠️ 단, `ConceptImageViewer` 안에는 절대 ScrollView 를 넣지 말 것.
 */
import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { RemoteImage } from '../../../components/common/RemoteImage';
import { useTheme } from '../../../theme';

interface PostPhotosProps {
  urls: string[];
  /** 사진을 누르면 전체화면 뷰어를 연다 */
  onPress?: (index: number) => void;
}

export const PostPhotos: React.FC<PostPhotosProps> = ({ urls, onPress }) => {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);

  if (urls.length === 0) {
    return null;
  }

  const size = width; // 1:1 — 폭과 높이가 같다

  return (
    <View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={urls.length > 1}
        scrollEventThrottle={16}
        onScroll={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / size))}
      >
        {urls.map((uri, i) => (
          <Pressable
            key={`${i}-${uri}`}
            accessibilityRole="imagebutton"
            accessibilityLabel={`사진 ${i + 1} 크게 보기`}
            onPress={() => onPress?.(i)}
          >
            <RemoteImage
              uri={uri}
              style={{ width: size, height: size, backgroundColor: colors.surfaceVariant }}
              resizeMode="cover"
              variant="thumb"
            />
          </Pressable>
        ))}
      </ScrollView>

      {/* 점 인디케이터 — 2장 이상일 때만 */}
      {urls.length > 1 ? (
        <View style={styles.dots} pointerEvents="none">
          {urls.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i === page ? colors.primary : colors.divider,
                  opacity: i === page ? 1 : 0.7,
                },
              ]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    columnGap: 5,
    paddingVertical: 8,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
