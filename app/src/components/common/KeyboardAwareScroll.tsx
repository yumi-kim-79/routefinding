/**
 * 입력 폼용 스크롤 — **키보드가 입력칸을 가리지 않게** 한다.
 *
 * ⚠️ 실측 (2026-08-05, 등반일지 작성):
 *   `KeyboardAvoidingView behavior="padding"`만으로는 iOS에서 하단 입력칸이 가려진다.
 *   SafeAreaView 안쪽이라 높이 계산이 어긋나기 때문이다.
 *   → iOS는 `automaticallyAdjustKeyboardInsets`(RN 0.70+)로 **스크롤 인셋을 자동 조정**하고,
 *     Android는 매니페스트의 `adjustResize`가 화면을 줄여준다.
 *   여기에 넉넉한 하단 여백을 더해 마지막 입력칸까지 항상 올라오게 한다.
 *
 * 폼 화면은 이 컴포넌트를 쓰면 세 화면이 같은 동작을 갖는다.
 */
import React from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

interface KeyboardAwareScrollProps extends ScrollViewProps {
  contentContainerStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

/** 마지막 입력칸이 키보드 위로 올라올 만큼의 여백 */
const BOTTOM_ROOM = 260;

export const KeyboardAwareScroll: React.FC<KeyboardAwareScrollProps> = ({
  contentContainerStyle,
  children,
  ...rest
}) => (
  <ScrollView
    style={styles.flex}
    contentContainerStyle={[contentContainerStyle, styles.room]}
    keyboardShouldPersistTaps="handled"
    keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
    // iOS 전용 — 키보드 높이만큼 contentInset을 자동으로 잡아준다
    automaticallyAdjustKeyboardInsets
    {...rest}
  >
    {children}
  </ScrollView>
);

const styles = StyleSheet.create({
  flex: { flex: 1 },
  room: { paddingBottom: BOTTOM_ROOM },
});
