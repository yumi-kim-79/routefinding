/**
 * 핀치 줌 + 드래그가 되는 이미지 (전체화면 뷰어용).
 *
 * 개념도는 "사진 위의 라인"을 읽는 게 목적이라 확대가 필수다(웹은 브라우저가 해준다).
 *
 * ⚠️ 외부 제스처 라이브러리를 쓰지 않는다.
 *    `react-native-gesture-handler` + `reanimated`는 네이티브 의존성이 2개 늘고,
 *    지금까지 react-native-maps·react-native-svg에서 겪은 **RN 버전 불일치 함정**이
 *    그대로 반복될 수 있다. RN 내장 `PanResponder` + `Animated`로 충분하다.
 *
 * 동작:
 *   · 두 손가락 → 손가락 사이 거리 비율로 확대/축소 (1~4배)
 *   · 확대 상태에서 한 손가락 → 이동
 *   · 두 번 탭 → 2배 확대 / 원래대로
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Animated, Image, PanResponder, StyleSheet, View } from 'react-native';

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_MS = 260;

interface ZoomableImageProps {
  uri: string;
  width: number;
  height: number;
  /** 확대 상태가 바뀌면 알려준다 (부모가 가로 스와이프를 잠근다) */
  onZoomChange?: (zoomed: boolean) => void;
  /** 오버레이(라인/텍스트)를 이미지와 함께 확대하려면 여기에 넣는다 */
  children?: React.ReactNode;
}

function distance(t: { pageX: number; pageY: number }[]): number {
  const dx = t[0].pageX - t[1].pageX;
  const dy = t[0].pageY - t[1].pageY;
  return Math.hypot(dx, dy);
}

export const ZoomableImage: React.FC<ZoomableImageProps> = ({
  uri,
  width,
  height,
  onZoomChange,
  children,
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  // Animated.Value는 읽기가 비동기라 제스처 계산용 실수 값을 따로 들고 다닌다
  const state = useRef({ scale: 1, x: 0, y: 0 });
  const gesture = useRef({ startDist: 0, startScale: 1, startX: 0, startY: 0 });
  const lastTap = useRef(0);
  const [zoomed, setZoomed] = useState(false);

  const apply = useCallback(
    (s: number, x: number, y: number) => {
      // 확대 배율에 맞춰 이동 가능 범위를 제한한다 (사진이 화면 밖으로 날아가지 않도록)
      const maxX = Math.max(0, (width * s - width) / 2);
      const maxY = Math.max(0, (height * s - height) / 2);
      const nx = Math.min(maxX, Math.max(-maxX, x));
      const ny = Math.min(maxY, Math.max(-maxY, y));
      state.current = { scale: s, x: nx, y: ny };
      scale.setValue(s);
      translateX.setValue(nx);
      translateY.setValue(ny);
      const nowZoomed = s > 1.01;
      setZoomed((prev) => {
        if (prev !== nowZoomed) {
          onZoomChange?.(nowZoomed);
        }
        return nowZoomed;
      });
    },
    [height, onZoomChange, scale, translateX, translateY, width],
  );

  const reset = useCallback(() => apply(1, 0, 0), [apply]);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        // 확대 중이 아니면 한 손가락 이동은 부모(가로 스와이프)에게 양보한다
        onMoveShouldSetPanResponder: (e, g) =>
          e.nativeEvent.touches.length === 2 ||
          (state.current.scale > 1.01 && (Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2)),

        onPanResponderGrant: (e) => {
          const touches = e.nativeEvent.touches;
          gesture.current.startScale = state.current.scale;
          gesture.current.startX = state.current.x;
          gesture.current.startY = state.current.y;
          gesture.current.startDist =
            touches.length === 2 ? distance(touches as never) : 0;

          if (touches.length === 1) {
            const now = Date.now();
            if (now - lastTap.current < DOUBLE_TAP_MS) {
              if (state.current.scale > 1.01) {
                reset();
              } else {
                apply(2, 0, 0);
              }
              lastTap.current = 0;
            } else {
              lastTap.current = now;
            }
          }
        },

        onPanResponderMove: (e, g) => {
          const touches = e.nativeEvent.touches;
          if (touches.length === 2) {
            const d = distance(touches as never);
            if (gesture.current.startDist === 0) {
              gesture.current.startDist = d;
              return;
            }
            const next = Math.min(
              MAX_SCALE,
              Math.max(MIN_SCALE, (gesture.current.startScale * d) / gesture.current.startDist),
            );
            apply(next, state.current.x, state.current.y);
          } else if (state.current.scale > 1.01) {
            apply(
              state.current.scale,
              gesture.current.startX + g.dx,
              gesture.current.startY + g.dy,
            );
          }
        },

        onPanResponderRelease: () => {
          gesture.current.startDist = 0;
          if (state.current.scale <= 1.01) {
            reset();
          }
        },
        onPanResponderTerminate: () => {
          gesture.current.startDist = 0;
        },
      }),
    [apply, reset],
  );

  return (
    <View style={{ width, height }} {...responder.panHandlers}>
      <Animated.View
        style={[
          styles.fill,
          { transform: [{ translateX }, { translateY }, { scale }] },
        ]}
      >
        <Image source={{ uri }} style={{ width, height }} resizeMode="contain" />
        {children}
      </Animated.View>
      {zoomed ? null : null}
    </View>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
