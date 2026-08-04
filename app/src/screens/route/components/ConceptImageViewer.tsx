/**
 * 전체화면 개념도 뷰어 (웹 ImageViewer.vue 대응).
 *
 * 개념도는 "사진 위의 라인"을 읽는 게 목적이라 크게 보는 화면이 필수다.
 * 가로 스와이프 + **핀치 줌/드래그/두 번 탭 확대** (2026-08-04 추가, 웹에서 되던 기능).
 * 확대는 RN 내장 PanResponder+Animated로 구현했다 — `components/common/ZoomableImage.tsx`
 * (gesture-handler/reanimated를 안 쓰는 이유는 그 파일 주석 참조).
 */
import React, { useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Text } from '../../../components/common/Text';
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
  /** 확대 중에는 가로 스와이프를 잠근다 (안 그러면 이동과 페이지 넘김이 싸운다) */
  const [zoomed, setZoomed] = useState(false);

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
      onShow={() => setIndex(initialIndex)}
      supportedOrientations={['portrait', 'landscape']}
    >
      <View style={styles.backdrop}>
        <FlatList
          data={images}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEnabled={!zoomed}
          keyExtractor={(uri, i) => `${i}-${uri}`}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, i) => ({
            length: width,
            offset: width * i,
            index: i,
          })}
          onMomentumScrollEnd={(e) =>
            setIndex(Math.round(e.nativeEvent.contentOffset.x / width))
          }
          renderItem={({ item }) => (
            <ZoomableImage
              uri={item}
              width={width}
              height={height * 0.8}
              onZoomChange={setZoomed}
            />
          )}
        />

        {images.length > 1 ? (
          <View style={styles.counter}>
            <Text variant="label" style={styles.counterText}>
              {index + 1} / {images.length}
            </Text>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          onPress={onClose}
          hitSlop={12}
          style={styles.close}
        >
          <Text variant="title" style={styles.closeText}>
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
  },
  counter: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  counterText: { color: '#fff' },
  close: {
    position: 'absolute',
    top: 48,
    right: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  closeText: { color: '#fff' },
});
