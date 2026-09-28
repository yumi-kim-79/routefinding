/**
 * 개념도 사진 등록 + 라인/텍스트 그리기 (전체화면 편집기) — 웹 `ConceptPhotoEditor.vue` 이식.
 *
 * 두 가지 모드로 쓴다:
 *   A) **개념도 등록 모드** (`concept` 전달) — 웹과 동일한 흐름
 *      1) 사진 촬영/앨범 첨부 → 2) 선·글자 → 3) 등록 → 원본+합성본 업로드 +
 *         `concept_photos` 문서 생성 (status: 'pending', 관리자 승인 대기)
 *   B) **로컬 편집 모드** (`onPicked` 전달, 2026-08-05 추가) — 업로드하지 않는다.
 *      루트제보 폼의 '사진 추가'에서 쓴다. 저장하면 **합성된 로컬 사진 uri**를 돌려주고,
 *      그 사진은 제보와 함께 저장된다.
 *      → 새 루트를 올릴 때 라인을 그리려고 "먼저 제보 → 승인 기다렸다가 → 사진 등록"을
 *        거칠 필요가 없다.
 *
 * ── 화면 구성 (2026-08-05 전면 개편) ─────────────────────────────────────
 *  사진이 작아 라인을 정확히 긋기 어렵다는 피드백을 받아 **캔버스를 화면 전체로** 키웠다.
 *   · 스크롤을 없앴다 — 스크롤과 그리기 제스처가 서로를 잡아먹는다
 *   · 도구·색상 바는 항상 아래에 떠 있어 확대 중에도 바꿀 수 있다
 *
 * ── 2026-08-17 개편: **보기 / 선 / 텍스트 3모드** ───────────────────────
 *  사용자 보고: "화면을 터치만 해도 그려지고 글자가 들어가서 불편하다.
 *               확대나 위치 조정을 할 수가 없다."
 *
 *  이전에는 도구가 `line`/`text` 둘뿐이라 **한 손가락 터치는 언제나 그리기**였다.
 *  확대하려면 두 손가락을 정확히 동시에 대야 했고, 한쪽이 조금 먼저 닿으면 선이 그어졌다.
 *
 *  → 기본값을 **`pan`(보기)** 으로 바꿨다.
 *     · 보기: 두 번 탭 확대 · 핀치 확대/축소 · 한 손가락 이동. **절대 그려지지 않는다**
 *     · 선 / 텍스트: 그 도구를 **눌러 선택했을 때만** 그리기·글자 입력이 된다
 *       (선택 중에도 두 손가락 확대·이동은 그대로 된다)
 *
 * ── 2026-08-17 좌표 정정: `locationX` → `pageX` ─────────────────────────
 *  사용자 보고: "손가락으로 그리면 조금 다른 포인트에 그려지는 느낌이 난다."
 *
 *  `locationX/locationY`는 **터치를 실제로 받은 자식 뷰 기준** 좌표다.
 *  캔버스 안에는 `Animated.View`(확대/이동됨) → `Image` → SVG 오버레이가 겹쳐 있어서
 *  어느 뷰가 터치를 받았느냐에 따라 기준이 달라지고, 확대 중에는 그 차이가 커진다.
 *  → `pageX/pageY`(화면 절대 좌표)에서 **측정해 둔 캔버스 위치**를 빼서 계산한다.
 *     캔버스 위치는 `measureInWindow`로 레이아웃 후 한 번 재고, 회전/리사이즈 때 갱신한다.
 *
 * ── 좌표 규약 (중요) ────────────────────────────────────────────────────
 *  좌표는 **사진 박스 기준 0~1 정규화**다(웹과 동일).
 *  ⚠️ 그래서 캔버스는 **사진의 실제 종횡비와 정확히 같아야** 한다.
 *     예전엔 4:3 고정이라 위아래 검은 여백까지 좌표 범위에 들어갔고,
 *     같은 데이터를 웹에서 열면 선이 어긋났다 (2026-08-05 정정).
 *  ⚠️ 확대/이동 중에 찍힌 화면 좌표는 **역변환**해서 사진 좌표로 되돌린다.
 *     (아래 `toContent` — 변환식 s = c + (p - c)·k + t 의 역)
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboardSpace } from '../../../hooks/useKeyboardSpace';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { captureRef } from 'react-native-view-shot';
import { cameraOptions, libraryOptions } from '../../../constants/image';
import { Text } from '../../../components/common/Text';
import { Input } from '../../../components/common/Input';
import { Button } from '../../../components/common/Button';
import { AppIcon } from '../../../components/common/AppIcon';
import { ConceptPhotoOverlay } from '../../../components/common/ConceptPhotoOverlay';
import { useTheme } from '../../../theme';
import type { Concept } from '../../../types/concept';
import {
  FONT_RATIO,
  PHOTO_COLORS,
  type NormPoint,
  type PhotoLine,
  type PhotoText,
} from '../../../types/conceptPhoto';
import { conceptPhotoTitle, submitConceptPhoto } from '../../../services/conceptPhotoService';

interface ConceptPhotoEditorProps {
  visible: boolean;
  /** 개념도 등록 모드의 대상. 로컬 편집 모드에서는 없다 */
  concept?: Concept | null;
  /**
   * 로컬 편집 모드 — 넘기면 업로드하지 않고 합성된 사진 uri를 돌려준다.
   * (루트제보 폼에서 사용)
   */
  onPicked?: (uri: string) => void;
  /** 이미 고른 사진을 열어 바로 그리기 시작할 때 (첨부한 사진 편집) */
  initialUri?: string | null;
  onClose: () => void;
  onSaved?: () => void;
}

/** 캔버스 조작 모드. 기본은 `pan`(보기) — 실수로 그려지는 것을 막는다 */
type Tool = 'pan' | 'line' | 'text';
/** 되돌리기 기록에 남는 것 (보기 모드는 아무것도 만들지 않는다) */
type DrawKind = 'line' | 'text';

const MIN_SCALE = 1;
const MAX_SCALE = 6;

function touchDistance(t: { pageX: number; pageY: number }[]): number {
  return Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY);
}
function touchCenter(t: { pageX: number; pageY: number }[]): { cx: number; cy: number } {
  return { cx: (t[0].pageX + t[1].pageX) / 2, cy: (t[0].pageY + t[1].pageY) / 2 };
}

export const ConceptPhotoEditor: React.FC<ConceptPhotoEditorProps> = ({
  visible,
  concept,
  onPicked,
  initialUri,
  onClose,
  onSaved,
}) => {
  /** 업로드 없이 사진만 돌려주는 모드인가 */
  const localMode = !!onPicked;
  const { colors, radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  /*
   * ⚠️ 도구 바에 글자 입력칸이 붙어 있다. edge-to-edge 라 키보드가 떠도 창이 안 줄어서
   *    인셋만 주면 입력칸이 키보드 뒤로 숨는다 (hooks/useKeyboardSpace.ts 머리말).
   */
  const { space: barBottom } = useKeyboardSpace();

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  /** 사진 원본 종횡비 (가로/세로). 캔버스를 여기에 맞춰야 좌표가 웹과 일치한다 */
  const [aspect, setAspect] = useState(4 / 3);
  const [tool, setTool] = useState<Tool>('pan');
  const [color, setColor] = useState<string>(PHOTO_COLORS[0]);
  const [textValue, setTextValue] = useState('');
  const [lines, setLines] = useState<PhotoLine[]>([]);
  const [texts, setTexts] = useState<PhotoText[]>([]);
  const [drawing, setDrawing] = useState<PhotoLine | null>(null);
  const [history, setHistory] = useState<DrawKind[]>([]);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState('');

  /** 캔버스가 놓일 수 있는 최대 영역 */
  const [area, setArea] = useState({ w: 1, h: 1 });
  /** 실제 사진 박스 크기 (종횡비를 지킨 결과) */
  const stage = useMemo(() => {
    const byWidth = { w: area.w, h: area.w / aspect };
    return byWidth.h <= area.h ? byWidth : { w: area.h * aspect, h: area.h };
  }, [area, aspect]);

  const stageRef = useRef<View | null>(null);

  // ── 확대/이동 ─────────────────────────────────────────────────────────
  const scaleA = useRef(new Animated.Value(1)).current;
  const txA = useRef(new Animated.Value(0)).current;
  const tyA = useRef(new Animated.Value(0)).current;
  const view = useRef({ k: 1, tx: 0, ty: 0 });
  /** 제스처 시작 시점 스냅샷. ux/uy = 캔버스 중심 기준 손가락 중점 오프셋 */
  const gesture = useRef({ dist: 0, k: 1, tx: 0, ty: 0, ux: 0, uy: 0 });
  const lastTap = useRef({ t: 0, x: 0, y: 0 });
  /**
   * ⚠️ 확대 중 **매 프레임 setState가 돌면 캔버스 전체가 다시 그려져** 버벅인다.
   *    실제로 값이 바뀔 때만 렌더한다. (2026-08-17 버벅임 신고의 원인)
   */
  const zoomedRef = useRef(false);
  const [zoomed, setZoomed] = useState(false);

  /** 캔버스의 화면상 좌상단 — pageX/Y를 캔버스 안 좌표로 바꿀 때 쓴다 */
  const origin = useRef({ x: 0, y: 0 });
  const measureStage = useCallback(() => {
    stageRef.current?.measureInWindow((x, y) => {
      origin.current = { x, y };
    });
  }, []);

  const applyView = useCallback(
    (k: number, tx: number, ty: number) => {
      const maxX = Math.max(0, (stage.w * k - stage.w) / 2);
      const maxY = Math.max(0, (stage.h * k - stage.h) / 2);
      const nx = Math.min(maxX, Math.max(-maxX, tx));
      const ny = Math.min(maxY, Math.max(-maxY, ty));
      view.current = { k, tx: nx, ty: ny };
      scaleA.setValue(k);
      txA.setValue(nx);
      tyA.setValue(ny);

      const nowZoomed = k > 1.01;
      if (nowZoomed !== zoomedRef.current) {
        zoomedRef.current = nowZoomed;
        setZoomed(nowZoomed);
      }
    },
    [scaleA, stage.h, stage.w, txA, tyA],
  );

  const resetView = useCallback(() => applyView(1, 0, 0), [applyView]);

  /**
   * 화면 절대 좌표(pageX/pageY) → 사진 좌표(0~1).
   *
   * ⚠️ `locationX`를 쓰면 안 된다 — 터치를 받은 **자식 뷰 기준**이라 기준이 흔들린다
   *    (2026-08-17 "다른 포인트에 그려진다" 신고의 원인).
   *
   * 변환은 `s = c + (p - c)·k + t` 이므로 역은 `p = c + (s - c - t)/k`.
   */
  const toContent = useCallback(
    (pageX: number, pageY: number): NormPoint => {
      const { k, tx, ty } = view.current;
      const sx = pageX - origin.current.x;
      const sy = pageY - origin.current.y;
      const cx = stage.w / 2;
      const cy = stage.h / 2;
      const px = cx + (sx - cx - tx) / k;
      const py = cy + (sy - cy - ty) / k;
      return {
        x: Math.min(1, Math.max(0, px / stage.w)),
        y: Math.min(1, Math.max(0, py / stage.h)),
      };
    },
    [stage.h, stage.w],
  );

  /** 캔버스 중심 기준 오프셋 (앵커 확대용) */
  const toOffset = useCallback(
    (pageX: number, pageY: number) => ({
      x: pageX - origin.current.x - stage.w / 2,
      y: pageY - origin.current.y - stage.h / 2,
    }),
    [stage.h, stage.w],
  );

  /** 지정한 화면 지점을 고정한 채 배율만 바꾼다 */
  const zoomAt = useCallback(
    (k: number, pageX: number, pageY: number) => {
      const u = toOffset(pageX, pageY);
      const { k: k0, tx, ty } = view.current;
      applyView(k, u.x - ((u.x - tx) * k) / k0, u.y - ((u.y - ty) * k) / k0);
    },
    [applyView, toOffset],
  );

  // PanResponder 콜백은 생성 시점 값을 가둔다 → 변하는 값은 ref로 읽는다
  const live = useRef({ tool, color, textValue, texts, stage });
  live.current = { tool, color, textValue, texts, stage };
  const strokeRef = useRef<NormPoint[]>([]);
  /** 지금 끌고 있는 글자의 인덱스 (없으면 null) */
  const dragTextRef = useRef<number | null>(null);

  /**
   * 찍힌 지점에 글자가 있는지 찾는다 (있으면 그 인덱스).
   *
   * 글자 크기는 세로의 4%(FONT_RATIO)이고 가로 폭은 글자 수에 비례한다.
   * 정확한 텍스트 측정 API가 없어 **글자당 폭 ≈ 글꼴 크기의 0.6배**로 근사한다.
   * 손가락이 굵으니 최소 잡기 범위를 따로 둔다.
   */
  const hitTestText = useCallback((p: NormPoint): number | null => {
    const { texts: list, stage: box } = live.current;
    const fontH = FONT_RATIO; // 세로 기준 정규화 높이
    let bestIndex = -1;
    let bestDist = Number.POSITIVE_INFINITY;

    list.forEach((t, i) => {
      const fontPx = box.h * FONT_RATIO;
      const halfW = Math.max(
        0.035,
        (fontPx * 0.6 * Math.max(1, t.text.length)) / 2 / Math.max(1, box.w),
      );
      const halfH = Math.max(0.03, fontH * 0.75);
      const dx = Math.abs(p.x - t.x);
      const dy = Math.abs(p.y - t.y);
      if (dx <= halfW && dy <= halfH) {
        // 여러 개가 겹치면 중심이 가까운 것을 고른다
        const d = dx * dx + dy * dy;
        if (d < bestDist) {
          bestDist = d;
          bestIndex = i;
        }
      }
    });
    return bestIndex >= 0 ? bestIndex : null;
  }, []);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,

        onPanResponderGrant: (e) => {
          const touches = e.nativeEvent.touches;
          if (touches.length >= 2) {
            const c = touchCenter(touches as never);
            const u = toOffset(c.cx, c.cy);
            gesture.current = {
              dist: touchDistance(touches as never),
              k: view.current.k,
              tx: view.current.tx,
              ty: view.current.ty,
              ux: u.x,
              uy: u.y,
            };
            return;
          }

          gesture.current.tx = view.current.tx;
          gesture.current.ty = view.current.ty;

          const t0 = touches[0];

          /*
           * 보기 모드 — 절대 그리지 않는다. 두 번 탭이면 그 지점을 확대한다.
           * (2026-08-17: 기본 모드가 여기다. 그려지는 건 도구를 고른 뒤에만)
           */
          if (live.current.tool === 'pan') {
            const now = Date.now();
            const near =
              Math.hypot(t0.pageX - lastTap.current.x, t0.pageY - lastTap.current.y) < 40;
            if (now - lastTap.current.t < 280 && near) {
              if (view.current.k > 1.01) {
                resetView();
              } else {
                zoomAt(2.5, t0.pageX, t0.pageY);
              }
              lastTap.current = { t: 0, x: 0, y: 0 };
            } else {
              lastTap.current = { t: now, x: t0.pageX, y: t0.pageY };
            }
            return;
          }

          const p = toContent(t0.pageX, t0.pageY);
          if (live.current.tool === 'text') {
            // 이미 찍어둔 글자를 눌렀다면 **새로 만들지 않고 그 글자를 잡는다**
            // (잘못 찍었을 때 끌어서 옮길 수 있어야 한다 — 2026-08-05 요청)
            const hit = hitTestText(p);
            if (hit !== null) {
              dragTextRef.current = hit;
              return;
            }
            const t = live.current.textValue.trim();
            if (!t) {
              Alert.alert('넣을 글자를 먼저 입력해 주세요.');
              return;
            }
            setTexts((prev) => [...prev, { x: p.x, y: p.y, text: t, color: live.current.color }]);
            setHistory((prev) => [...prev, 'text']);
            return;
          }
          strokeRef.current = [p];
          setDrawing({ points: [p], color: live.current.color });
        },

        onPanResponderMove: (e, g) => {
          const touches = e.nativeEvent.touches;

          // 두 손가락 → 확대·이동. 그리는 중이었다면 그 획은 버린다(손가락 하나 더 얹은 건 그릴 의도가 아니다)
          if (touches.length >= 2) {
            dragTextRef.current = null;
            if (strokeRef.current.length > 0) {
              strokeRef.current = [];
              setDrawing(null);
            }
            const d = touchDistance(touches as never);
            if (gesture.current.dist === 0) {
              const c0 = touchCenter(touches as never);
              const u0 = toOffset(c0.cx, c0.cy);
              gesture.current = {
                dist: d,
                k: view.current.k,
                tx: view.current.tx,
                ty: view.current.ty,
                ux: u0.x,
                uy: u0.y,
              };
              return;
            }
            const c = touchCenter(touches as never);
            const u = toOffset(c.cx, c.cy);
            const k = Math.min(
              MAX_SCALE,
              Math.max(MIN_SCALE, (gesture.current.k * d) / gesture.current.dist),
            );
            // 손가락 중점을 고정한 채 확대 + 두 손가락 이동을 한 수식으로
            const ratio = k / gesture.current.k;
            applyView(
              k,
              u.x - (gesture.current.ux - gesture.current.tx) * ratio,
              u.y - (gesture.current.uy - gesture.current.ty) * ratio,
            );
            return;
          }

          // 보기 모드에서 한 손가락 — 확대돼 있으면 이동만 한다
          if (live.current.tool === 'pan') {
            if (view.current.k > 1.01) {
              applyView(view.current.k, gesture.current.tx + g.dx, gesture.current.ty + g.dy);
            }
            return;
          }

          // 잡고 있는 글자가 있으면 손가락을 따라 옮긴다
          if (dragTextRef.current !== null) {
            const p = toContent(e.nativeEvent.pageX, e.nativeEvent.pageY);
            const idx = dragTextRef.current;
            setTexts((prev) =>
              prev.map((t, i) => (i === idx ? { ...t, x: p.x, y: p.y } : t)),
            );
            return;
          }

          if (live.current.tool === 'text' || strokeRef.current.length === 0) {
            return;
          }
          // 한 손가락 → 그리기 (확대 상태에서도 사진 좌표로 정확히 되돌려 기록한다)
          const p = toContent(e.nativeEvent.pageX, e.nativeEvent.pageY);
          const last = strokeRef.current[strokeRef.current.length - 1];
          // 같은 자리 반복만 걸러낸다. 임계값이 크면 곡선이 각진다 (웹과 같은 0.0015)
          if (Math.hypot(p.x - last.x, p.y - last.y) < 0.0015 / view.current.k) {
            return;
          }
          strokeRef.current = [...strokeRef.current, p];
          setDrawing({ points: strokeRef.current, color: live.current.color });
          void g;
        },

        onPanResponderRelease: () => {
          gesture.current.dist = 0;
          if (dragTextRef.current !== null) {
            dragTextRef.current = null;
            return;
          }
          if (strokeRef.current.length === 0) {
            return;
          }
          const stroke = { points: strokeRef.current, color: live.current.color };
          strokeRef.current = [];
          // 점 하나만 찍힌 경우도 남긴다 — 토포의 확보점 표시에 쓰인다
          setLines((prev) => [...prev, stroke]);
          setHistory((prev) => [...prev, 'line']);
          setDrawing(null);
        },
        onPanResponderTerminate: () => {
          gesture.current.dist = 0;
          dragTextRef.current = null;
          strokeRef.current = [];
          setDrawing(null);
        },
      }),
    [applyView, hitTestText, resetView, toContent, toOffset, zoomAt],
  );

  // ── 사진 선택 ─────────────────────────────────────────────────────────
  const pickPhoto = useCallback(
    (from: 'camera' | 'library') => {
      void (async () => {
        const res =
          from === 'camera'
            ? await launchCamera(cameraOptions())
            : await launchImageLibrary(libraryOptions(1));
        const asset = res.assets?.[0];
        if (res.didCancel || !asset?.uri) {
          return;
        }
        setPhotoUri(asset.uri);
        // 캔버스를 사진 종횡비에 맞춰야 좌표가 웹과 일치한다
        if (asset.width && asset.height) {
          setAspect(asset.width / asset.height);
        } else {
          Image.getSize(
            asset.uri,
            (w, h) => setAspect(w / h),
            () => setAspect(4 / 3),
          );
        }
        // 사진을 바꾸면 기존에 그린 건 의미가 없다 (웹과 동일)
        setLines([]);
        setTexts([]);
        setHistory([]);
        setDrawing(null);
        resetView();
      })();
    },
    [resetView],
  );

  /**
   * 이미 첨부한 사진을 편집하러 들어온 경우, 열릴 때 그 사진을 올린다.
   * `visible`이 false→true로 바뀔 때만 해야 한다 — 편집 중에 다시 세팅하면 그린 게 날아간다.
   */
  useEffect(() => {
    if (!visible || !initialUri) {
      return;
    }
    setPhotoUri(initialUri);
    Image.getSize(
      initialUri,
      (w, h) => setAspect(w / h),
      () => setAspect(4 / 3),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const reset = useCallback(() => {
    setPhotoUri(null);
    setLines([]);
    setTexts([]);
    setDrawing(null);
    setHistory([]);
    setTextValue('');
    setProgress('');
    resetView();
  }, [resetView]);

  const closeAll = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const undo = useCallback(() => {
    setHistory((prev) => {
      const last = prev[prev.length - 1];
      if (last === 'line') {
        setLines((l) => l.slice(0, -1));
      } else if (last === 'text') {
        setTexts((t) => t.slice(0, -1));
      }
      return prev.slice(0, -1);
    });
  }, []);

  const clearAll = useCallback(() => {
    setLines([]);
    setTexts([]);
    setHistory([]);
  }, []);

  const onAreaLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setArea({ w: Math.max(1, width), h: Math.max(1, height) });
  }, []);

  const save = useCallback(() => {
    if (!photoUri || saving || (!concept && !localMode)) {
      return;
    }
    void (async () => {
      setSaving(true);
      try {
        let flatUri: string | null = null;
        if (lines.length > 0 || texts.length > 0) {
          setProgress('라인 합성 중…');
          // ⚠️ 확대 상태로 캡처하면 잘린 그림이 구워진다 → 반드시 원래 배율로 되돌린 뒤 캡처
          resetView();
          await new Promise((r) => setTimeout(r, 150));
          try {
            /*
             * ⚠️ 실측 2026-08-09 (RN 0.81 / 신아키텍처):
             *   `react-native-view-shot@4.0.3`으로 캐프처하면 **배경 사진이 검게** 나오고
             *   라인·글자(SVG)만 보였다. 4.0.3은 2024-12 버전이라
             *   Fabric 런타임에서 <Image>를 못 그린다.
             *   → 5.1.1로 올리면서 해결(Android ViewShot.java가 639→1047줄로 재작성됨).
             *   다시 검게 나오면 view-shot 버전부터 의심할 것.
             */
            flatUri = await captureRef(stageRef, { format: 'jpg', quality: 0.92 });
          } catch (capErr) {
            /*
             * ⚠️ 실측 2026-08-05:
             *   `react-native-view-shot`이 네이티브 바이너리에 없으면 여기서 터진다
             *   (`TurboModuleRegistry.getEnforcing(...): 'RNViewShot' could not be found`).
             *   package.json에만 추가하고 `pod install`을 안 했을 때 나는 증상이다.
             *   예전에는 이 예외가 밖으로 새어 나가 **저장 버튼이 무한 로딩에 걸렸다.**
             *   여기서 잡아 사용자에게 무슨 일인지 알리고, 그냥 끝내지 않고 선택지를 준다.
             */
            const msg = capErr instanceof Error ? capErr.message : String(capErr);
            const missingModule = msg.includes('RNViewShot');
            setSaving(false);
            setProgress('');
            if (localMode) {
              // 로컬 모드에는 업로드가 없다 — 선이 안 구워진 원본을 쓸지만 물어보면 된다
              Alert.alert(
                '라인 합성 실패',
                missingModule
                  ? '이 빌드에는 사진 합성 기능이 빠져 있습니다.\n' +
                    '(개발자 참고: react-native-view-shot 미설치 — pod install 필요)\n\n' +
                    '선이 빠진 원본 사진을 그대로 첨부할 수 있습니다.'
                  : `${msg}\n\n선이 빠진 원본 사진을 그대로 첨부할 수 있습니다.`,
                [
                  { text: '취소', style: 'cancel' },
                  {
                    text: '원본 그대로 첨부',
                    onPress: () => {
                      onPicked?.(photoUri);
                      closeAll();
                    },
                  },
                ],
              );
              return;
            }
            Alert.alert(
              '라인 합성 실패',
              missingModule
                ? '이 빌드에는 사진 합성 기능이 빠져 있습니다.\n' +
                  '(개발자 참고: react-native-view-shot 미설치 — pod install 필요)\n\n' +
                  '원본 사진과 선 좌표만 저장할 수도 있습니다. 앱에서는 선이 보이지만,\n' +
                  '승인해서 개념도에 넣을 때는 선이 빠진 원본이 들어갑니다.'
                : `${msg}\n\n원본 사진과 선 좌표만 저장할 수도 있습니다.`,
              [
                { text: '취소', style: 'cancel' },
                {
                  text: '원본만 저장',
                  onPress: () => {
                    setSaving(true);
                    void submitConceptPhoto({
                      concept: concept as Concept,
                      photoUri,
                      flatUri: null,
                      lines,
                      texts,
                      onProgress: setProgress,
                    })
                      .then(() => {
                        Alert.alert('등록 완료', '관리자 승인 후 개념도에 반영됩니다.');
                        onSaved?.();
                        closeAll();
                      })
                      .catch((e2: unknown) =>
                        Alert.alert('등록 실패', e2 instanceof Error ? e2.message : String(e2)),
                      )
                      .finally(() => {
                        setSaving(false);
                        setProgress('');
                      });
                  },
                },
              ],
            );
            return;
          }
        }
        if (localMode) {
          // 업로드하지 않는다 — 합성본(없으면 원본)을 폼에 돌려주고 닫는다.
          // 제보를 저장할 때 다른 첨부 사진과 함께 업로드된다.
          onPicked?.(flatUri ?? photoUri);
          closeAll();
          return;
        }
        await submitConceptPhoto({
          concept: concept as Concept,
          photoUri,
          flatUri,
          lines,
          texts,
          onProgress: setProgress,
        });
        Alert.alert('등록 완료', '관리자 승인 후 개념도에 반영됩니다.\n승인 전에는 본인에게만 보입니다.');
        onSaved?.();
        closeAll();
      } catch (e) {
        Alert.alert('등록 실패', e instanceof Error ? e.message : String(e));
      } finally {
        setSaving(false);
        setProgress('');
      }
    })();
  }, [
    closeAll,
    concept,
    lines,
    localMode,
    onPicked,
    onSaved,
    photoUri,
    resetView,
    saving,
    texts,
  ]);

  // 개념도 등록 모드인데 대상이 없으면 그릴 것이 없다 (로컬 모드는 대상이 필요 없다)
  if (!concept && !localMode) {
    return null;
  }

  const allLines = drawing ? [...lines, drawing] : lines;
  const canUndo = history.length > 0;

  const toolBtn = (active: boolean) => [
    styles.toolBtn,
    {
      borderRadius: radius.md,
      borderColor: active ? colors.primary : colors.border,
      backgroundColor: active ? colors.primary : colors.surface,
    },
  ];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={closeAll}>
      <View style={[styles.wrap, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        {/* 헤더 — 캔버스를 최대한 넓게 쓰려고 한 줄로 압축했다 */}
        <View style={[styles.header, { borderBottomColor: colors.divider }]}>
          <Pressable accessibilityRole="button" onPress={closeAll} hitSlop={10} disabled={saving}>
            <AppIcon name="x" size={22} color={colors.textPrimary} />
          </Pressable>
          <View style={styles.flex}>
            <Text variant="label" numberOfLines={1}>
              {concept ? conceptPhotoTitle(concept) : '사진 · 라인 그리기'}
            </Text>
          </View>
          {photoUri ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => pickPhoto('library')}
              hitSlop={8}
              disabled={saving}
            >
              <Text variant="caption" color="primary">
                사진 변경
              </Text>
            </Pressable>
          ) : null}
        </View>

        {!photoUri ? (
          <View style={[styles.pick, { padding: spacing.md }]}>
            <Button title="사진 촬영" onPress={() => pickPhoto('camera')} size="lg" />
            <Button
              title="앨범에서 첨부"
              variant="secondary"
              onPress={() => pickPhoto('library')}
              size="lg"
            />
            <Text variant="caption" color="textSecondary">
              {localMode
                ? '사진을 올린 뒤 등반 라인을 그리면, 그린 그대로 제보에 첨부됩니다.'
                : '개념도 사진을 올린 뒤, 사진 위에 등반 라인을 그릴 수 있습니다.'}
            </Text>
          </View>
        ) : (
          <>
            {/* 캔버스 — 화면의 대부분을 차지한다 */}
            <View style={styles.area} onLayout={onAreaLayout}>
              {/*
                ⚠️ **캔버스 크기를 잰 뒤에만 사진을 올린다** (2026-08-05 실측).
                   `area`는 첫 렌더에서 1x1이고 onLayout이 돌아야 실제 크기가 된다.
                   그 사이에 <Image>가 먼저 마운트되면 iOS가 **1px 크기로 디코딩한 비트맵을
                   캐시**해 두고, 뷰가 커진 뒤에도 그걸 확대해 쓴다 → 모자이크처럼 뭉개진다.
                   나갔다 다시 첨부하면 그땐 이미 크기가 잡혀 있어 정상으로 보였다
                   (매번 같은 패턴이던 이유).
                   `key`에 크기를 넣어, 혹시 나중에 크기가 바뀌어도 다시 디코딩하게 한다.
              */}
              {area.w > 1 ? (
              <View
                style={[styles.stageBox, { width: stage.w, height: stage.h }]}
                {...responder.panHandlers}
              >
                <View
                  ref={stageRef}
                  collapsable={false}
                  /*
                   * ⚠️ 캔버스의 화면상 위치를 재둬야 pageX/pageY 를 사진 좌표로 되돌릴 수 있다.
                   *    (measureInWindow 는 레이아웃이 끝난 뒤에야 정확하다)
                   */
                  onLayout={measureStage}
                  style={[styles.stageBox, { width: stage.w, height: stage.h }]}
                >
                  <Animated.View
                    style={[
                      styles.stageBox,
                      {
                        width: stage.w,
                        height: stage.h,
                        transform: [
                          { translateX: txA },
                          { translateY: tyA },
                          { scale: scaleA },
                        ],
                      },
                    ]}
                  >
                    <Image
                      key={`${photoUri}:${Math.round(stage.w)}x${Math.round(stage.h)}`}
                      source={{ uri: photoUri }}
                      style={{ width: stage.w, height: stage.h }}
                      resizeMode="cover"
                      fadeDuration={0}
                    />
                    <ConceptPhotoOverlay
                      lines={allLines}
                      texts={texts}
                      width={stage.w}
                      height={stage.h}
                    />
                  </Animated.View>
                </View>
              </View>
              ) : null}

              {zoomed ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={resetView}
                  style={[styles.resetBtn, { backgroundColor: colors.surface, borderRadius: radius.full }]}
                >
                  <Text variant="caption" color="primary">
                    원래 크기
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {/* 도구 바 — 확대 중에도 언제든 바꿀 수 있게 항상 떠 있다 */}
            <View style={[styles.bar, { backgroundColor: colors.surface, paddingBottom: barBottom }]}>
              {tool === 'text' ? (
                <View style={styles.textRow}>
                  <Input
                    placeholder="넣을 글자 (예: 1P, 슬랩)"
                    value={textValue}
                    onChangeText={setTextValue}
                    maxLength={20}
                  />
                </View>
              ) : null}

              <View style={styles.toolRow}>
                {/*
                  ⚠️ '보기'가 기본이다 (2026-08-17).
                     예전에는 line/text 뿐이라 한 손가락이 닿기만 해도 그려졌고,
                     그래서 확대·위치 조정을 할 수가 없었다.
                */}
                <Pressable accessibilityRole="button" onPress={() => setTool('pan')} style={toolBtn(tool === 'pan')}>
                  <AppIcon name="search" size={16} color={tool === 'pan' ? colors.onPrimary : colors.textSecondary} />
                  <Text variant="caption" color={tool === 'pan' ? 'onPrimary' : 'textSecondary'}>
                    보기
                  </Text>
                </Pressable>

                <Pressable accessibilityRole="button" onPress={() => setTool('line')} style={toolBtn(tool === 'line')}>
                  <AppIcon name="line" size={16} color={tool === 'line' ? colors.onPrimary : colors.textSecondary} />
                  <Text variant="caption" color={tool === 'line' ? 'onPrimary' : 'textSecondary'}>
                    선
                  </Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => setTool('text')} style={toolBtn(tool === 'text')}>
                  <AppIcon name="type" size={16} color={tool === 'text' ? colors.onPrimary : colors.textSecondary} />
                  <Text variant="caption" color={tool === 'text' ? 'onPrimary' : 'textSecondary'}>
                    글자
                  </Text>
                </Pressable>

                <View style={styles.colors}>
                  {PHOTO_COLORS.map((c) => (
                    <Pressable
                      key={c}
                      accessibilityRole="button"
                      accessibilityLabel={`색상 ${c}`}
                      onPress={() => setColor(c)}
                      style={[
                        styles.swatch,
                        {
                          backgroundColor: c,
                          borderColor: color === c ? colors.primary : colors.border,
                          borderWidth: color === c ? 3 : 1,
                        },
                      ]}
                    />
                  ))}
                </View>

                <Pressable
                  accessibilityRole="button"
                  onPress={undo}
                  disabled={!canUndo}
                  style={[styles.iconBtn, { opacity: canUndo ? 1 : 0.4 }]}
                >
                  <AppIcon name="undo" size={19} color={colors.textSecondary} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={clearAll}
                  disabled={!canUndo}
                  style={[styles.iconBtn, { opacity: canUndo ? 1 : 0.4 }]}
                >
                  <AppIcon name="trash" size={19} color={colors.error} />
                </Pressable>
              </View>

              <Text variant="caption" color="textSecondary" style={styles.hint}>
                {tool === 'pan'
                  ? '두 번 탭하거나 두 손가락으로 확대 · 끌어서 이동 · 그리려면 선/텍스트를 누르세요'
                  : tool === 'line'
                    ? '한 손가락으로 끌면 선이 그려집니다 · 두 손가락으로 확대·이동'
                    : '글자를 입력한 뒤 위치를 누르세요 · 찍은 글자는 끌어서 옮길 수 있습니다'}
              </Text>

              <Button
                title={
                  saving
                    ? progress || '저장 중…'
                    : localMode
                      ? '이 사진 사용'
                      : '등록 (승인 요청)'
                }
                onPress={save}
                disabled={saving}
                loading={saving}
                size="lg"
              />
              {saving ? (
                <View style={styles.savingRow}>
                  <ActivityIndicator color={colors.primary} />
                  <Text variant="caption" color="textSecondary">
                    {localMode ? '사진을 합성하는 중입니다…' : '업로드 중입니다. 화면을 벗어나지 마세요.'}
                  </Text>
                </View>
              ) : null}
            </View>
          </>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pick: { rowGap: 10 },
  area: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' },
  stageBox: { overflow: 'hidden' },
  resetBtn: { position: 'absolute', top: 10, right: 10, paddingHorizontal: 12, paddingVertical: 6 },
  bar: { paddingHorizontal: 12, paddingTop: 8, rowGap: 8 },
  textRow: { marginBottom: -8 },
  toolRow: { flexDirection: 'row', alignItems: 'center', columnGap: 6, flexWrap: 'wrap' },
  toolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
  },
  colors: { flexDirection: 'row', columnGap: 6, marginHorizontal: 4 },
  swatch: { width: 24, height: 24, borderRadius: 12 },
  iconBtn: { padding: 6 },
  hint: { textAlign: 'center' },
  savingRow: { flexDirection: 'row', alignItems: 'center', columnGap: 8, justifyContent: 'center' },
});
