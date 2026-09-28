/**
 * 핀치 줌 + 드래그가 되는 이미지 (전체화면 뷰어용).
 *
 * 개념도는 "사진 위의 라인"을 읽는 게 목적이라 확대가 필수다(웹은 브라우저가 해준다).
 *
 * ⚠️ 외부 제스처 라이브러리를 쓰지 않는다.
 *    `react-native-gesture-handler` + `reanimated`는 네이티브 의존성이 2개 늘고,
 *    react-native-maps·react-native-svg에서 겪은 **RN 버전 불일치 함정**이 반복될 수 있다.
 *    RN 내장 `PanResponder` + `Animated`로 충분하다. (사용자 결정 2026-08-17)
 *
 * ── 동작 (2026-08-25 사용자 요청으로 확정) ───────────────────────────────
 *   · 두 손가락으로 벌리고 오므리기 → 확대/축소 (손가락 중점 기준)
 *   · 확대된 상태에서 한 손가락으로 끌기 → 이동
 *   · 두 손가락으로 밀기 → 이동
 *   · **두 번 탭 확대는 없다** — 사용자 요청으로 제거했다(아래 참조)
 *
 * ── 🚨 2026-08-25: 부모에 스크롤 컨테이너를 두지 말 것 ────────────────────
 *  핀치가 두 번이나 "안 된다"고 보고된 원인은 이 파일이 아니라 **부모**였다.
 *  `ConceptImageViewer` 가 가로 FlatList(= 네이티브 ScrollView) 안에 이 컴포넌트를
 *  넣고 있었고, 네이티브 ScrollView 는 **JS responder 협상 밖에서** 자체 제스처
 *  인식기로 동작한다. 손가락이 움직이는 순간 스크롤이 시작돼 두 손가락 판정이
 *  평가될 기회조차 없었다.
 *
 *  capture 단계로 잡는 것도, 손가락 수를 세어 scrollEnabled 를 끄는 것도 소용없었다
 *  (손가락 수는 PanResponder 콜백에서 세는데 responder 를 못 얻으면 콜백이 안 온다).
 *  → 뷰어에서 FlatList 를 걷어내고 한 번에 한 장만 그리도록 바꿔 해결했다.
 *
 *  ⚠️ 이 컴포넌트를 ScrollView·FlatList 안에 넣지 말 것. 같은 문제가 되돌아온다.
 *
 * ── 🚨 2026-08-28: 핀치가 **또** 안 되던 진짜 원인 — View 평탄화 ──────────
 *  FlatList 를 걷어냈는데도 두 손가락 확대가 동작하지 않는다는 보고를 또 받았다.
 *
 *  제스처를 받는 컨테이너의 스타일이 `{ width, height }` 뿐이었다.
 *  안드로이드(특히 New Architecture)는 **시각적으로 의미 없는 View 를 네이티브 계층에서
 *  없애 버린다**(view flattening). 없어진 뷰에는 멀티터치가 제대로 전달되지 않는다.
 *
 *  같은 앱의 사진 편집기가 처음부터 잘 됐던 이유가 여기 있었다 —
 *  편집기 캔버스는 `stageBox: { overflow: 'hidden' }` 이라 평탄화 대상이 아니었다.
 *  (편집기는 자식에 `collapsable={false}` 까지 붙여 두었다)
 *
 *  → 컨테이너에 **`collapsable={false}`** 를 명시하고, `overflow: 'hidden'` +
 *    배경색을 줘서 **반드시 실제 네이티브 뷰로 남게** 한다.
 *  → 손가락 개수도 `nativeEvent.touches` 하나에만 기대지 않고
 *    RN 이 직접 세는 `gestureState.numberActiveTouches` 와 **큰 쪽**을 쓴다.
 *
 *  ⚠️ 여기서 `collapsable={false}` 를 지우지 말 것. 눈에 보이는 변화가 없어 보여도
 *     안드로이드에서 제스처가 통째로 죽는다.
 *
 * 좌표 수식 (transform 순서 translateX·translateY·scale, 뷰 중심 c 기준):
 *     화면 = c + (사진좌표 - c)·k + t
 *   손가락 아래 지점을 고정한 채 k를 k'로 바꾸려면, u = 화면 - c 일 때
 *     t' = u' - (u₀ - t₀)·(k'/k₀)
 *   이 하나로 **앵커 확대 + 두 손가락 이동**이 동시에 처리된다.
 */
import React, { useCallback, useMemo, useRef } from 'react';
import {
  Animated,
  type LayoutChangeEvent,
  PanResponder,
  type PanResponderGestureState,
  StyleSheet,
  View,
} from 'react-native';
import { RemoteImage } from './RemoteImage';

const MIN_SCALE = 1;
const MAX_SCALE = 5;

interface Touch {
  pageX: number;
  pageY: number;
}

interface ZoomableImageProps {
  uri: string;
  width: number;
  height: number;
  /** 확대 상태가 바뀌면 알려준다 (부모가 가로 스와이프를 잠근다) */
  onZoomChange?: (zoomed: boolean) => void;
  /** 오버레이(라인/텍스트)를 이미지와 함께 확대하려면 여기에 넣는다 */
  children?: React.ReactNode;
}

const dist = (t: Touch[]): number =>
  Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY);

const center = (t: Touch[]): { x: number; y: number } => ({
  x: (t[0].pageX + t[1].pageX) / 2,
  y: (t[0].pageY + t[1].pageY) / 2,
});

/**
 * 지금 화면에 닿아 있는 손가락 수.
 * ⚠️ `nativeEvent.touches` 하나만 믿지 않는다 — 플랫폼·아키텍처에 따라 비는 경우가 있다.
 *    RN 이 responder 시스템에서 직접 세는 `numberActiveTouches` 와 큰 쪽을 쓴다.
 */
const fingers = (t: Touch[], g: PanResponderGestureState): number =>
  Math.max(t.length, g.numberActiveTouches);

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

  /** Animated.Value는 읽기가 비동기라 계산용 실수 값을 따로 들고 다닌다 */
  const view = useRef({ k: 1, tx: 0, ty: 0 });
  /** 제스처 시작 시점 스냅샷. ux/uy = 뷰 중심 기준 손가락 중점 오프셋 */
  const start = useRef({ d: 0, k: 1, tx: 0, ty: 0, ux: 0, uy: 0 });
  /**
   * 한 손가락 이동의 기준점.
   * ⚠️ 핀치 중에 손가락 하나를 떼면 손가락 수가 2 → 1 로 바뀌는데,
   *    `gestureState.dx` 는 제스처 **시작**부터 누적된 값이라 그대로 쓰면 사진이 튄다.
   *    손가락 수가 바뀌는 순간의 dx/dy 를 0점으로 다시 잡는다.
   */
  const pan = useRef({ dx0: 0, dy0: 0, count: 0 });

  /** 컨테이너의 화면상 좌상단 — pageX/Y를 뷰 안 좌표로 바꿀 때 쓴다 */
  const origin = useRef({ x: 0, y: 0 });
  const containerRef = useRef<View | null>(null);

  /**
   * ⚠️ 렌더는 값이 실제로 바뀔 때만.
   *    매 프레임 setState가 돌면 뷰어 전체가 다시 그려져 버벅인다(2026-08-17).
   */
  const zoomedRef = useRef(false);

  const onLayout = useCallback((_e: LayoutChangeEvent) => {
    // measureInWindow는 레이아웃이 끝난 뒤에야 정확하다
    containerRef.current?.measureInWindow((x, y) => {
      origin.current = { x, y };
    });
  }, []);

  /** 화면(page) 좌표 → 뷰 중심 기준 오프셋 */
  const toOffset = useCallback(
    (px: number, py: number) => ({
      x: px - origin.current.x - width / 2,
      y: py - origin.current.y - height / 2,
    }),
    [height, width],
  );

  const apply = useCallback(
    (k: number, tx: number, ty: number) => {
      // 확대 배율에 맞춰 이동 범위를 제한한다 (사진이 화면 밖으로 날아가지 않도록)
      const maxX = Math.max(0, (width * k - width) / 2);
      const maxY = Math.max(0, (height * k - height) / 2);
      const nx = Math.min(maxX, Math.max(-maxX, tx));
      const ny = Math.min(maxY, Math.max(-maxY, ty));

      view.current = { k, tx: nx, ty: ny };
      scale.setValue(k);
      translateX.setValue(nx);
      translateY.setValue(ny);

      const nowZoomed = k > 1.01;
      if (nowZoomed !== zoomedRef.current) {
        zoomedRef.current = nowZoomed;
        onZoomChange?.(nowZoomed);
      }
    },
    [height, onZoomChange, scale, translateX, translateY, width],
  );

  const reset = useCallback(() => apply(1, 0, 0), [apply]);

  /** 두 손가락 제스처 시작점을 기록한다 */
  const beginPinch = useCallback(
    (touches: Touch[]) => {
      const c = center(touches);
      const u = toOffset(c.x, c.y);
      start.current = {
        d: dist(touches),
        k: view.current.k,
        tx: view.current.tx,
        ty: view.current.ty,
        ux: u.x,
        uy: u.y,
      };
    },
    [toOffset],
  );

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        // 부모가 이 제스처를 뺏어가지 못하게 한다
        onPanResponderTerminationRequest: () => false,

        onPanResponderGrant: (e, g) => {
          const touches = e.nativeEvent.touches as unknown as Touch[];
          if (fingers(touches, g) >= 2 && touches.length >= 2) {
            beginPinch(touches);
            return;
          }
          start.current.d = 0;
          start.current.tx = view.current.tx;
          start.current.ty = view.current.ty;
          pan.current = { dx0: 0, dy0: 0, count: 1 };
        },

        onPanResponderMove: (e, g) => {
          const touches = e.nativeEvent.touches as unknown as Touch[];
          const n = fingers(touches, g);

          // 손가락 수가 바뀌면 이동 기준점을 다시 잡는다 (안 그러면 사진이 튄다)
          if (n !== pan.current.count) {
            pan.current = { dx0: g.dx, dy0: g.dy, count: n };
            start.current.tx = view.current.tx;
            start.current.ty = view.current.ty;
          }

          // 좌표가 두 개 다 있어야 거리·중점을 계산할 수 있다
          if (n >= 2 && touches.length >= 2) {
            if (start.current.d === 0) {
              beginPinch(touches);
              return;
            }
            const k = Math.min(
              MAX_SCALE,
              Math.max(MIN_SCALE, (start.current.k * dist(touches)) / start.current.d),
            );
            const c = center(touches);
            const u = toOffset(c.x, c.y);
            const ratio = k / start.current.k;
            // 손가락 중점을 고정한 채 확대 + 두 손가락 이동을 한 수식으로
            apply(
              k,
              u.x - (start.current.ux - start.current.tx) * ratio,
              u.y - (start.current.uy - start.current.ty) * ratio,
            );
            return;
          }

          // 한 손가락 — 확대돼 있을 때만 이동
          if (view.current.k > 1.01) {
            apply(
              view.current.k,
              start.current.tx + (g.dx - pan.current.dx0),
              start.current.ty + (g.dy - pan.current.dy0),
            );
          }
        },

        onPanResponderRelease: () => {
          start.current.d = 0;
          pan.current = { dx0: 0, dy0: 0, count: 0 };
          // 손가락을 떼며 배율이 1 아래로 내려가 있으면 원래대로 되돌린다
          if (view.current.k <= 1.01) {
            reset();
          }
        },
        onPanResponderTerminate: () => {
          start.current.d = 0;
          pan.current = { dx0: 0, dy0: 0, count: 0 };
        },
      }),
    [apply, beginPinch, reset, toOffset],
  );

  return (
    <View
      ref={containerRef}
      onLayout={onLayout}
      /*
       * ⚠️ 지우지 말 것 — 안드로이드 view flattening 방지.
       *    스타일이 크기뿐인 View 는 네이티브 계층에서 사라져 멀티터치가 죽는다.
       *    (2026-08-28 "두 손가락 확대가 안 된다" 신고의 원인)
       */
      collapsable={false}
      style={[styles.stage, { width, height }]}
      {...responder.panHandlers}
    >
      <Animated.View
        style={[
          styles.fill,
          { transform: [{ translateX }, { translateY }, { scale }] },
        ]}
      >
        <RemoteImage
          uri={uri}
          style={{ width, height }}
          resizeMode="contain"
          // 전체화면으로 보고 있는 사진 — 목록 썸네일보다 먼저 처리한다
          priority="high"
          // 축소본을 먼저 띄워 빈 화면을 없앤다. 원본이 오면 선명해진다
          progressive
          /*
           * ⚠️ 여기만 `auto` 다. RemoteImage 기본값 `resize` 는 화면 크기에 맞춰
           *    **줄여서 디코딩**하므로 메모리에 좋지만, 이 화면은 손가락으로 확대한다.
           *    줄여 놓은 비트맵을 3배로 키우면 뭉개진다 — 확대하는 자리에서는 원본 해상도를 쓴다.
           */
          resizeMethod="auto"
        />
        {children}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  // overflow·배경색이 있으면 평탄화 대상이 아니다 (collapsable={false} 와 이중 보호)
  stage: { overflow: 'hidden', backgroundColor: '#000' },
  fill: { flex: 1 },
});
