/**
 * 개념도 사진 등록 + 라인/텍스트 그리기 (모달) — 웹 `ConceptPhotoEditor.vue` 이식.
 *
 * 흐름 (웹과 동일):
 *   1) 사진 촬영 또는 앨범에서 첨부
 *   2) 사진 위에 선을 긋거나 글자를 찍는다 (기본색 6종 · 되돌리기 · 전체 지우기)
 *   3) 등록 → 원본 + 합성본 업로드 + `concept_photos` 문서 생성 (status: 'pending')
 *
 * 좌표는 0~1 정규화로 저장한다 (`types/conceptPhoto.ts` 규약 — 웹과 동일).
 * 원본 사진은 손대지 않으므로 나중에 선만 고치거나 지울 수 있다.
 *
 * ⚠️ 승인 전에는 올린 본인과 관리자만 볼 수 있다 (firestore.rules).
 *
 * ── 웹과 다른 점 ────────────────────────────────────────────────────────
 *  · 그리기 입력: 웹은 pointer 이벤트 + setPointerCapture, 앱은 RN 내장 `PanResponder`.
 *    (웹에서 필요했던 `draggable=false`/`dragstart` 차단 같은 함정은 RN엔 없다)
 *  · 합성: 웹은 canvas, 앱은 `react-native-view-shot`으로 화면에 그려진 그대로 캡처한다.
 *    캡처 해상도가 화면 폭 기준이라 원본보다 작아질 수 있다 [TBD] 실사용 후 화질 확인.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { captureRef } from 'react-native-view-shot';
import { Text } from '../../../components/common/Text';
import { Input } from '../../../components/common/Input';
import { Button } from '../../../components/common/Button';
import { AppIcon } from '../../../components/common/AppIcon';
import { ConceptPhotoOverlay } from '../../../components/common/ConceptPhotoOverlay';
import { useTheme } from '../../../theme';
import type { Concept } from '../../../types/concept';
import {
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

export const ConceptPhotoEditor: React.FC<ConceptPhotoEditorProps> = ({
  visible,
  concept,
  onClose,
  onSaved,
}) => {
  const { colors, radius, spacing } = useTheme();

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>('line');
  const [color, setColor] = useState<string>(PHOTO_COLORS[0]);
  const [textValue, setTextValue] = useState('');
  const [lines, setLines] = useState<PhotoLine[]>([]);
  const [texts, setTexts] = useState<PhotoText[]>([]);
  const [drawing, setDrawing] = useState<PhotoLine | null>(null);
  const [history, setHistory] = useState<Tool[]>([]);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState('');
  const [stage, setStage] = useState({ w: 1, h: 1 });

  const stageRef = useRef<View | null>(null);
  // PanResponder 콜백은 생성 시점 값을 가둬버리므로, 변하는 값은 ref로 읽는다
  const live = useRef({ tool, color, textValue, stage });
  live.current = { tool, color, textValue, stage };
  const strokeRef = useRef<NormPoint[]>([]);

  const reset = useCallback(() => {
    setPhotoUri(null);
    setLines([]);
    setTexts([]);
    setDrawing(null);
    setHistory([]);
    setTextValue('');
    setProgress('');
  }, []);

  const closeAll = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  /** 사진 선택 — 촬영 / 앨범 */
  const pickPhoto = useCallback((from: 'camera' | 'library') => {
    void (async () => {
      const res =
        from === 'camera'
          ? await launchCamera({ mediaType: 'photo', saveToPhotos: false })
          : await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1 });
      if (res.didCancel || !res.assets?.[0]?.uri) {
        return;
      }
      setPhotoUri(res.assets[0].uri as string);
      // 사진을 바꾸면 기존에 그린 건 의미가 없다 (웹과 동일)
      setLines([]);
      setTexts([]);
      setHistory([]);
      setDrawing(null);
    })();
  }, []);

  /** 화면 좌표 → 0~1 정규화 */
  const norm = useCallback((x: number, y: number): NormPoint => {
    const { w, h } = live.current.stage;
    return {
      x: Math.min(1, Math.max(0, x / w)),
      y: Math.min(1, Math.max(0, y / h)),
    };
  }, []);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,

        onPanResponderGrant: (e) => {
          const { locationX, locationY } = e.nativeEvent;
          const p = norm(locationX, locationY);

          if (live.current.tool === 'text') {
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

        onPanResponderMove: (e) => {
          if (live.current.tool === 'text' || strokeRef.current.length === 0) {
            return;
          }
          const { locationX, locationY } = e.nativeEvent;
          const p = norm(locationX, locationY);
          const last = strokeRef.current[strokeRef.current.length - 1];
          // 같은 자리 반복만 걸러낸다. 임계값이 크면 곡선이 각진다 (웹과 같은 0.0015)
          if (Math.hypot(p.x - last.x, p.y - last.y) < 0.0015) {
            return;
          }
          strokeRef.current = [...strokeRef.current, p];
          setDrawing({ points: strokeRef.current, color: live.current.color });
        },

        onPanResponderRelease: () => {
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
          strokeRef.current = [];
          setDrawing(null);
        },
      }),
    [norm],
  );

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

  const onStageLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setStage({ w: Math.max(1, width), h: Math.max(1, height) });
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
          // 화면에 그려진 사진+오버레이를 그대로 굽는다
          flatUri = await captureRef(stageRef, { format: 'jpg', quality: 0.92 });
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
  }, [closeAll, concept, lines, onSaved, photoUri, saving, texts]);

  if (!concept) {
    return null;
  }

  const allLines = drawing ? [...lines, drawing] : lines;
  const canUndo = history.length > 0;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={closeAll}>
      <View style={[styles.wrap, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.divider, padding: spacing.md }]}>
          <Pressable accessibilityRole="button" onPress={closeAll} hitSlop={10} disabled={saving}>
            <AppIcon name="x" size={22} color={colors.textPrimary} />
          </Pressable>
          <View style={styles.headerMid}>
            <Text variant="title">개념도 사진 등록</Text>
            <Text variant="caption" color="textSecondary" numberOfLines={1}>
              {conceptPhotoTitle(concept)}
            </Text>
          </View>
          <View style={styles.headerRight} />
        </View>

        <ScrollView
          contentContainerStyle={{ padding: spacing.md }}
          keyboardShouldPersistTaps="handled"
          // 그리는 중에는 스크롤이 개입하지 않도록
          scrollEnabled={!drawing}
        >
          {!photoUri ? (
            <View style={{ rowGap: spacing.sm }}>
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
              {/* 도구 */}
              <View style={styles.toolbar}>
                {(['line', 'text'] as const).map((t) => {
                  const on = tool === t;
                  return (
                    <Pressable
                      key={t}
                      accessibilityRole="button"
                      onPress={() => setTool(t)}
                      style={[
                        styles.toolBtn,
                        {
                          borderRadius: radius.md,
                          borderColor: on ? colors.primary : colors.border,
                          backgroundColor: on ? colors.primary : colors.surface,
                        },
                      ]}
                    >
                      <AppIcon
                        name={t === 'line' ? 'line' : 'type'}
                        size={16}
                        color={on ? colors.onPrimary : colors.textSecondary}
                      />
                      <Text variant="caption" color={on ? 'onPrimary' : 'textSecondary'}>
                        {t === 'line' ? '선' : '글자'}
                      </Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  accessibilityRole="button"
                  onPress={undo}
                  disabled={!canUndo}
                  style={[
                    styles.toolBtn,
                    { borderRadius: radius.md, borderColor: colors.border, opacity: canUndo ? 1 : 0.45 },
                  ]}
                >
                  <AppIcon name="undo" size={16} color={colors.textSecondary} />
                  <Text variant="caption" color="textSecondary">
                    되돌리기
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={clearAll}
                  disabled={!canUndo}
                  style={[
                    styles.toolBtn,
                    { borderRadius: radius.md, borderColor: colors.border, opacity: canUndo ? 1 : 0.45 },
                  ]}
                >
                  <AppIcon name="trash" size={16} color={colors.error} />
                  <Text variant="caption" color="textSecondary">
                    전체 지우기
                  </Text>
                </Pressable>
              </View>

              {/* 색 */}
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
                        borderWidth: color === c ? 3 : 2,
                      },
                    ]}
                  />
                ))}
              </View>

              {tool === 'text' ? (
                <Input
                  placeholder="넣을 글자 (예: 1P, 슬랩)"
                  value={textValue}
                  onChangeText={setTextValue}
                  maxLength={20}
                />
              ) : null}

              {/* 캔버스 */}
              <View
                ref={stageRef}
                collapsable={false}
                onLayout={onStageLayout}
                style={[styles.stage, { borderRadius: radius.md }]}
                {...responder.panHandlers}
              >
                <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="contain" />
                <ConceptPhotoOverlay
                  lines={allLines}
                  texts={texts}
                  width={stage.w}
                  height={stage.h}
                />
              </View>

              <Text variant="caption" color="textSecondary" style={{ marginTop: spacing.xs }}>
                {tool === 'line'
                  ? '사진 위에서 손가락을 끌면 선이 그려집니다.'
                  : '글자를 입력한 뒤 사진에서 위치를 누르세요.'}
              </Text>

              <Pressable
                accessibilityRole="button"
                onPress={() => pickPhoto('library')}
                style={{ paddingVertical: spacing.sm }}
              >
                <Text variant="caption" color="primary">
                  다른 사진으로 바꾸기
                </Text>
              </Pressable>
            </>
          )}

          <Button
            title={saving ? progress || '저장 중…' : '등록 (승인 요청)'}
            onPress={save}
            disabled={saving || !photoUri}
            loading={saving}
            size="lg"
            style={{ marginTop: spacing.md }}
          />
          {saving ? (
            <View style={styles.savingRow}>
              <ActivityIndicator color={colors.primary} />
              <Text variant="caption" color="textSecondary">
                업로드 중입니다. 화면을 벗어나지 마세요.
              </Text>
            </View>
          ) : null}
          <Text variant="caption" color="textSecondary" style={styles.notice}>
            등록하면 관리자 승인 후 개념도에 반영됩니다. 승인 전에는 본인에게만 보입니다.
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    columnGap: 12,
  },
  headerMid: { flex: 1 },
  headerRight: { width: 22 },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  toolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
  },
  colors: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  swatch: { width: 28, height: 28, borderRadius: 14 },
  stage: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: '#111',
    overflow: 'hidden',
  },
  photo: { width: '100%', height: '100%' },
  savingRow: { flexDirection: 'row', alignItems: 'center', columnGap: 8, marginTop: 8 },
  notice: { marginTop: 10, textAlign: 'center' },
});
