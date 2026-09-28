/**
 * 키보드가 가리는 만큼의 **하단 여백**을 알려 준다.
 *
 * ⚠️ 왜 필요한가 (2026-09-07 실측):
 *    이 앱은 `targetSdk 36` + `edgeToEdgeEnabled=true` 다. **안드로이드 15(API 35)부터
 *    `adjustResize` 가 무시된다** — 키보드가 떠도 창이 줄지 않는다.
 *    예전에는 창이 줄면서 하단 입력창이 저절로 밀려 올라왔는데, 지금은 그냥 덮인다.
 *    `KeyboardAvoidingView` 도 이 상태에서는 계산 결과가 0이라 아무 일도 하지 않는다
 *    (RN 0.81 KeyboardAvoidingView 는 줄어든 창 높이를 전제로 계산한다).
 *    → 키보드 높이를 직접 받아서 우리가 자리를 비운다.
 *
 * ⚠️ 안드로이드(API 30+)에서 RN 이 주는 `endCoordinates.height` 는
 *    **내비게이션 바를 뺀 순수 키보드 높이**다 (ReactRootView.checkForKeyboardEvents:
 *    `imeInsets.bottom - barInsets.bottom`). 화면 아래에서 실제로 잠기는 높이는
 *    거기에 하단 인셋을 더한 값이다. 그래서 `space` 는 둘을 합쳐서 돌려준다.
 *
 * ⚠️ iOS 는 `keyboardWillShow` 를 쓴다. `Did` 를 쓰면 키보드가 다 올라온 뒤에 움직여서
 *    한 박자 늦게 덜컥 뛴다.
 */
import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface KeyboardSpace {
  /** 키보드가 없을 때는 하단 인셋, 있을 때는 키보드 + 인셋 */
  space: number;
  /** 순수 키보드 높이 (인셋 제외) */
  keyboardHeight: number;
  visible: boolean;
}

export function useKeyboardSpace(): KeyboardSpace {
  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const show = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates?.height ?? 0);
    });
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const visible = keyboardHeight > 0;
  return {
    keyboardHeight,
    visible,
    space: visible ? keyboardHeight + insets.bottom : insets.bottom,
  };
}
