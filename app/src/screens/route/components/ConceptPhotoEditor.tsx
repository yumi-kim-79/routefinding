/**
 * 개념도 사진 등록 + 라인/텍스트 그리기 (전체화면 편집기) — 웹 `ConceptPhotoEditor.vue` 이식.
 *
 * 흐름 (웹과 동일):
 *   1) 사진 촬영 또는 앨범에서 첨부
 *   2) 사진 위에 선을 긋거나 글자를 찍는다 (기본색 6종 · 되돌리기 · 전체 지우기)
 *   3) 등록 → 원본 + 합성본 업로드 + `concept_photos` 문서 생성 (status: 'pending')
 *
 * ── 화면 구성 (2026-08-05 전면 개편) ─────────────────────────────────────
 *  사진이 작아 라인을 정확히 긋기 어렵다는 피드백을 받아 **캔버스를 화면 전체로** 키웠다.
 *   · 스크롤을 없앴다 — 스크롤과 그리기 제스처가 서로를 잡아먹는다
 *   · **두 손가락 = 확대·이동, 한 손가락 = 그리기**. 확대한 상태에서도 그릴 수 있다
 *   · 도구·색상 바는 항상 아래에 떠 있어 확대 중에도 바꿀 수 있다
 *
 * ── 좌표 규약 (중요) ────────────────────────────────────────────────────
 *  좌표는 **사진 박스 기준 0~1 정규화**다(웹과 동일).
 *  ⚠️ 그래서 캔버스는 **사진의 실제 종횡비와 정확히 같아야** 한다.
 *     예전엔 4:3 고정이라 위아래 검은 여백까지 좌표 범위에 들어갔고,
 *     같은 데이터를 웹에서 열면 선이 어긋났다 (2026-08-05 정정).
 *  ⚠️ 확대/이동 중에 찍힌 화면 좌표는 **역변환**해서 사진 좌표로 되돌린다.
 *     (아래 `toContent` — 변환식 s = c + (p - c)·k + t 의 역)
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
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
  concept: Concept | null;
  onClose: () => void;
  onSaved?: () => void;
}

type Tool = 'line' | 'text';

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
  onClose,
  onSaved,
}) => {
  const { colors, radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  /** 사진 원본 종횡비 (가로/세로). 캔버스를 여기에 맞춰야 좌표가 웹과 일치한다 */
  const [aspect, setAspect] = useState(4 / 3);
  const [tool, setTool] = useState<Tool>('line');
  const [color, setColor] = useState<string>(PHOTO_COLORS[0]);
  const [textValue, setTextValue] = useState('');
  const [lines, setLines] = useState<PhotoLine[]>([]);
  const [texts, setTexts] = useState<PhotoText[]>([]);
  const [drawing, setDrawing] = useState<PhotoLine | null>(null);
  const [history, setHistory] = useState<Tool[]>([]);
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
  const gesture = useRef({ dist: 0, k: 1, tx: 0, ty: 0, cx: 0, cy: 0 });
  const [zoomed, setZoomed] = useState(false);

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
      setZoomed(k > 1.01);
    },
    [scaleA, stage.h, stage.w, txA, tyA],
  );

  const resetView = useCallback(() => applyView(1, 0, 0), [applyView]);

  /**
   * 캔버스 안의 화면 좌표 → 사진 좌표(0~1).
   * 변환은 `s = c + (p - c)·k + t` 이므로 역은 `p = c + (s - c - t)/k`.
   */
  const toContent = useCallback(
    (sx: number, sy: number): NormPoint => {
      const { k, tx, ty } = view.current;
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
            gesture.current = {
              dist: touchDistance(touches as never),
              k: view.current.k,
              tx: view.current.tx,
              ty: view.current.ty,
              ...touchCenter(touches as never),
            };
            return;
          }

          const p = toContent(e.nativeEvent.locationX, e.nativeEvent.locationY);
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
              gesture.current = {
                dist: d,
                k: view.current.k,
                tx: view.current.tx,
                ty: view.current.ty,
                ...touchCenter(touches as never),
              };
              return;
            }
            const c = touchCenter(touches as never);
            const k = Math.min(
              MAX_SCALE,
              Math.max(MIN_SCALE, (gesture.current.k * d) / gesture.current.dist),
            );
            applyView(
              k,
              gesture.current.tx + (c.cx - gesture.current.cx),
              gesture.current.ty + (c.cy - gesture.current.cy),
            );
            return;
          }

          // 잡고 있는 글자가 있으면 손가락을 따라 옮긴다
          if (dragTextRef.current !== null) {
            const p = toContent(e.nativeEvent.locationX, e.nativeEvent.locationY);
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
          const p = toContent(e.nativeEvent.locationX, e.nativeEvent.locationY);
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
    [applyView, hitTestText, toContent],
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
    if (!concept || !photoUri || saving) {
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
          await new Promise((r) => setTimeout(r, 60));
          try {
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
                      concept,
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
        await submitConceptPhoto({
          concept,
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
  }, [closeAll, concept, lines, onSaved, photoUri, resetView, saving, texts]);

  if (!concept) {
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
              {conceptPhotoTitle(concept)}
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
              개념도 사진을 올린 뒤, 사진 위에 등반 라인을 그릴 수 있습니다.
            </Text>
          </View>
        ) : (
          <>
            {/* 캔버스 — 화면의 대부분을 차지한다 */}
            <View style={styles.area} onLayout={onAreaLayout}>
              <View
                style={[styles.stageBox, { width: stage.w, height: stage.h }]}
                {...responder.panHandlers}
              >
                <View
                  ref={stageRef}
                  collapsable={false}
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
            <View style={[styles.bar, { backgroundColor: colors.surface, paddingBottom: insets.bottom }]}>
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
                {tool === 'line'
                  ? '한 손가락으로 끌면 선이 그려집니다 · 두 손가락으로 확대·이동'
                  : '글자를 입력한 뒤 위치를 누르세요 · 찍은 글자는 끌어서 옮길 수 있습니다'}
              </Text>

              <Button
                title={saving ? progress || '저장 중…' : '등록 (승인 요청)'}
                onPress={save}
                disabled={saving}
                loading={saving}
                size="lg"
              />
              {saving ? (
                <View style={styles.savingRow}>
                  <ActivityIndicator color={colors.primary} />
                  <Text variant="caption" color="textSecondary">
                    업로드 중입니다. 화면을 벗어나지 마세요.
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
