/**
 * 입력 폼용 스크롤 — **키보드가 입력칸을 가리지 않게** 한다.
 *
 * ⚠️ 2026-09-07 전면 수정. 그 전 방식(하단에 260px 고정 여백 + iOS 자동 인셋)은
 *    **안드로이드 15부터 통하지 않는다.**
 *    이 앱은 `targetSdk 36` + `edgeToEdgeEnabled=true` 라 `adjustResize` 가 무시된다 —
 *    키보드가 떠도 창이 줄지 않으므로, 창이 줄어드는 걸 전제로 한 여백도
 *    `KeyboardAvoidingView` 도 전부 무력해졌다
 *    (근거는 hooks/useKeyboardSpace.ts 머리말).
 *
 * 지금 하는 일 두 가지:
 *   1) 키보드가 가리는 만큼 **콘텐츠 아래 자리를 비운다** → 끝까지 스크롤이 된다
 *   2) 포커스된 입력칸이 키보드에 가리면 **그만큼 자동으로 밀어 올린다**
 *      ⚠️ 1)만 하면 "스크롤하면 보이기는 한다" 수준이라, 사용자는 여전히
 *         자기가 뭘 쓰는지 못 본 채로 타이핑하게 된다. 2)가 있어야 실제로 해결된다.
 */
import React, { useCallback, useEffect, useRef } from 'react';
import {
  Dimensions,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useKeyboardSpace } from '../../hooks/useKeyboardSpace';

interface KeyboardAwareScrollProps extends ScrollViewProps {
  contentContainerStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

/** 입력칸과 키보드 사이에 남길 숨통 */
const GAP = 16;

export const KeyboardAwareScroll: React.FC<KeyboardAwareScrollProps> = ({
  contentContainerStyle,
  children,
  onScroll,
  ...rest
}) => {
  const { space, visible } = useKeyboardSpace();
  const scrollRef = useRef<ScrollView>(null);
  /** 현재 스크롤 위치 — scrollTo 는 절대 좌표를 받으므로 알고 있어야 한다 */
  const offsetY = useRef(0);
  /** 화면 아래에서 키보드가 잠그는 총 높이 (내비게이션 바 포함) */
  const covered = useRef(0);
  covered.current = visible ? space : 0;

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      offsetY.current = e.nativeEvent.contentOffset.y;
      onScroll?.(e);
    },
    [onScroll],
  );

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';

    const sub = Keyboard.addListener(showEvent, (e) => {
      const kbTotal = e.endCoordinates?.height ?? 0;

      /*
       * ⚠️ 레이아웃이 다시 잡히기 전에 재면 옛 위치가 나온다 — 한 박자 뒤에 잰다.
       *    안드로이드는 키보드 애니메이션이 끝난 뒤라 조금 더 기다린다.
       */
      const shift = () => {
        const input = TextInput.State.currentlyFocusedInput();
        const scroll = scrollRef.current;
        if (!input || !scroll) {
          return;
        }
        input.measureInWindow((_x, y, _w, h) => {
          const screenH = Dimensions.get('window').height;
          // covered 가 아직 갱신 전일 수 있어 이벤트 값으로 보정한다
          const keyboardTop = screenH - Math.max(covered.current, kbTotal);
          const overlap = y + h + GAP - keyboardTop;
          if (overlap > 0) {
            scroll.scrollTo({ y: offsetY.current + overlap, animated: true });
          }
        });
      };

      const timer = setTimeout(shift, Platform.OS === 'ios' ? 0 : 80);
      return () => clearTimeout(timer);
    });

    return () => sub.remove();
  }, []);

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.flex}
      // ⚠️ 키보드가 가리는 만큼 자리를 비운다. 이게 없으면 끝까지 스크롤이 안 된다
      contentContainerStyle={[contentContainerStyle, { paddingBottom: space + GAP }]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      onScroll={handleScroll}
      scrollEventThrottle={16}
      {...rest}
    >
      {children}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
