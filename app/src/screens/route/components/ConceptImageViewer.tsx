/**
 * 전체화면 개념도 뷰어 (웹 ImageViewer.vue 대응).
 *
 * 개념도는 "사진 위의 라인"을 읽는 게 목적이라 크게 보는 화면이 필수다.
 * 확대는 RN 내장 PanResponder+Animated — `components/common/ZoomableImage.tsx`
 * (gesture-handler/reanimated를 안 쓰는 이유는 그 파일 주석 참조).
 *
 * ── 🚨 2026-08-25: 가로 FlatList 를 **걷어냈다** ─────────────────────────
 *  사용자 보고 2회: "핀치 확대가 안 되고 다음 사진으로만 넘어간다."
 *
 *  예전 구조는 이랬다:
 *      FlatList horizontal (= 네이티브 ScrollView)
 *        └ ZoomableImage (PanResponder 로 핀치)
 *
 *  네이티브 ScrollView 는 **JS responder 협상 밖에서** 자체 제스처 인식기로 동작한다.
 *  손가락이 움직이는 순간 스크롤이 시작되고, 자식의 두 손가락 판정은
 *  평가될 기회조차 없다. 그래서
 *    · 움직임 없이 판정되는 **두 번 탭만** 통과했고
 *    · capture 단계로 잡아 보고(1차 시도), 손가락 수를 세어 scrollEnabled 를 꺼 봐도(2차 시도)
 *      **이미 스크롤이 시작된 뒤라 소용이 없었다.**
 *      (손가락 수는 PanResponder 콜백에서 세는데, responder 를 못 얻으면 콜백 자체가 안 온다 —
 *       닭이 먼저냐 달걀이 먼저냐)
 *
 *  → 가로 스와이프를 **포기**하고 사진은 한 번에 한 장만 그린다.
 *    사진 넘김은 좌우 화살표 버튼이 맡는다.
 *    이제 제스처 경쟁자가 없어서 **사진 편집기와 똑같이** 동작한다
 *    (편집기가 처음부터 잘 됐던 이유가 바로 부모에 ScrollView 가 없어서였다).
 *
 *  ⚠️ 여기에 ScrollView·FlatList·Swiper 를 다시 넣지 말 것. 같은 문제가 되돌아온다.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Text } from '../../../components/common/Text';
import { AppIcon } from '../../../components/common/AppIcon';
import { ZoomableImage } from '../../../components/common/ZoomableImage';

interface ConceptImageViewerProps {
  visible: boolean;
  images: string[];
  initialIndex?: number;
  onClose: () => void;
}

export const ConceptImageViewer: React.FC<ConceptImageViewerProps> = ({
  visible,
  images,
  initialIndex = 0,
  onClose,
}) => {
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(initialIndex);

  useEffect(() => {
    if (visible) {
      setIndex(initialIndex);
    }
  }, [visible, initialIndex]);

  const last = images.length - 1;
  const go = useCallback(
    (delta: number) => setIndex((i) => Math.min(last, Math.max(0, i + delta))),
    [last],
  );

  if (images.length === 0) {
    return null;
  }

  const safeIndex = Math.min(index, last);

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
      supportedOrientations={['portrait', 'landscape']}
    >
      <View style={styles.backdrop}>
        {/*
          ⚠️ key 에 index 를 넣어 사진이 바뀌면 컴포넌트를 새로 만든다.
             안 그러면 확대해 둔 배율·위치가 다음 사진에 그대로 남는다.
        */}
        <ZoomableImage
          key={`${safeIndex}-${images[safeIndex]}`}
          uri={images[safeIndex]}
          width={width}
          height={height * 0.8}
        />

        {/* 좌우 넘김 — 가로 스와이프를 대신한다 */}
        {images.length > 1 ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="이전 사진"
              onPress={() => go(-1)}
              disabled={safeIndex === 0}
              style={[
                styles.nav,
                styles.navLeft,
                safeIndex === 0 && styles.navDisabled,
              ]}
            >
              <AppIcon name="back" size={22} color="#fff" />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="다음 사진"
              onPress={() => go(1)}
              disabled={safeIndex === last}
              style={[
                styles.nav,
                styles.navRight,
                safeIndex === last && styles.navDisabled,
              ]}
            >
              {/* 'back' 아이콘을 좌우 반전해 '다음'으로 쓴다 */}
              <View style={styles.flip}>
                <AppIcon name="back" size={22} color="#fff" />
              </View>
            </Pressable>
          </>
        ) : null}

        <View style={styles.bottom}>
          <Text variant="caption" style={styles.white}>
            두 손가락으로 벌려 확대 · 끌어서 이동
            {images.length > 1 ? `   ·   ${safeIndex + 1} / ${images.length}` : ''}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={onClose}
          hitSlop={12}
          style={styles.close}
        >
          <Text variant="title" style={styles.white}>
            닫기
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  white: { color: '#fff' },
  bottom: {
    position: 'absolute',
    bottom: 36,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  close: {
    position: 'absolute',
    top: 48,
    right: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  /* 산에서 장갑 낀 손으로도 눌리도록 넉넉하게 (CLAUDE.md) */
  nav: {
    position: 'absolute',
    top: '45%',
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  navLeft: { left: 12 },
  navRight: { right: 12 },
  navDisabled: { opacity: 0.25 },
  flip: { transform: [{ scaleX: -1 }] },
});
