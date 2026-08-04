/**
 * 전체화면 개념도 뷰어 (웹 ImageViewer.vue 대응).
 *
 * 개념도는 "사진 위의 라인"을 읽는 게 목적이라 크게 보는 화면이 필수다.
 * 현재는 가로 스와이프 + contain 표시까지. 핀치 줌은 별도 제스처 라이브러리가 필요해
 * [TBD] — 라인 그리기(P1)와 함께 도입 여부를 결정한다(docs/03_TECH_STACK.md).
 */
import React, { useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Text } from '../../../components/common/Text';

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
            <Image
              source={{ uri: item }}
              style={{ width, height: height * 0.8 }}
              resizeMode="contain"
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
