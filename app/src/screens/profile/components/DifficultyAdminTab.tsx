/**
 * 난이도 채우기 (관리자 전용) — 마이페이지 ▸ 난이도. v2.2.0 신규 (2026-09-07).
 *
 * ⚠️ 왜 별도 화면인가 (2026-09-07 실측):
 *    **리드 루트 2,995개 중 난이도가 있는 건 99개(3%)뿐이다.**
 *    개념도 상세를 하나씩 열어 고치면 하루에 스무 개도 못 채운다.
 *    → 등반지를 고르면 **난이도 없는 루트만 모아** 한 화면에서 연속 입력한다.
 *
 * ⚠️ 새 쿼리를 만들지 않는다. `fetchConcepts()` 가 이미 전체를 캐시하고 있어
 *    거기서 걸러 쓰는 것이 가장 싸다 (services/conceptService.ts).
 *
 * 🚨 **개념도 사진을 같이 보여준다** (2026-09-08 사용자 지적).
 *    난이도가 **사진 안에 글자로 그려져 있는** 루트가 많다. 그래서 필드가 비어 있어도
 *    실제로는 난이도를 아는 루트가 대부분이다 — 사진을 못 보면 채울 수가 없다.
 *    눌러서 크게 볼 수 있어야 한다 (사진 속 글자가 작다).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '../../../components/common/Text';
import { RemoteImage } from '../../../components/common/RemoteImage';
import { ConceptImageViewer } from '../../route/components/ConceptImageViewer';
import { useTheme } from '../../../theme';
import { useKeyboardSpace } from '../../../hooks/useKeyboardSpace';
import { fetchConcepts } from '../../../services/conceptService';
import { setDifficulty } from '../../../services/difficultyService';
import { conceptDifficulty, conceptImages, conceptThumbnail, type Concept } from '../../../types/concept';
import { gradesFor } from '../../../types/difficultySuggestion';

export const DifficultyAdminTab: React.FC = () => {
  const { colors, radius } = useTheme();
  const { space: bottomSpace } = useKeyboardSpace();

  const [all, setAll] = useState<Concept[] | null>(null);
  const [mountain, setMountain] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** 이번 세션에서 채운 것 — 목록에서 즉시 빼려고 (캐시는 늦게 갱신된다) */
  const [done, setDone] = useState<Set<string>>(new Set());
  /** 사진 크게 보기 — 난이도가 사진 속 글자로만 있는 경우가 많다 (머리말) */
  const [viewer, setViewer] = useState<{ images: string[]; index: number } | null>(null);

  useEffect(() => {
    void fetchConcepts()
      .then((r) => setAll(r.items))
      .catch((e: unknown) => {
        Alert.alert('불러오기 실패', e instanceof Error ? e.message : String(e));
        setAll([]);
      });
  }, []);

  /** 난이도가 비어 있는 루트만 */
  const missing = useMemo(
    () => (all ?? []).filter((c) => conceptDifficulty(c) === undefined && !done.has(c.id)),
    [all, done],
  );

  /** 등반지별 남은 개수 — 많은 순서로 (효율이 가장 좋은 곳부터) */
  const byMountain = useMemo(() => {
    const m = new Map<string, number>();
    missing.forEach((c) => {
      const k = (c.mountain ?? '').trim() || '(등반지 없음)';
      m.set(k, (m.get(k) ?? 0) + 1);
    });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [missing]);

  const rows = useMemo(
    () =>
      mountain
        ? missing.filter((c) => ((c.mountain ?? '').trim() || '(등반지 없음)') === mountain)
        : [],
    [missing, mountain],
  );

  const apply = useCallback(
    async (c: Concept, grade: string) => {
      setBusy(true);
      try {
        await setDifficulty(c, grade);
        setDone((prev) => new Set(prev).add(c.id));
        setOpenId(null);
      } catch (e) {
        Alert.alert('저장 실패', e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  if (all === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text variant="caption" color="textSecondary">
          루트를 불러오는 중…
        </Text>
      </View>
    );
  }

  /*
   * 🚨 목록을 `ScrollView` + map 으로 그리면 안 된다 (2026-09-08).
   *    썸네일이 붙으면서 선운산(225개) 같은 등반지에서 **이미지 200장을 한 번에** 만들게 되고
   *    그대로 메모리 초과로 앱이 종료된다. 반드시 가상화 목록을 쓴다.
   */
  const header = (
    <>
      <Text variant="title">난이도 없는 루트 {missing.length}개</Text>
      <Text variant="caption" color="textSecondary">
        전체 {all.length}개 중. 등반지를 고르면 그 안의 루트만 나옵니다.
      </Text>

      {/* 등반지 고르기 — 남은 개수가 많은 곳부터 */}
      <View style={styles.chips}>
        {byMountain.slice(0, 30).map(([m, n]) => (
          <Pressable
            key={m}
            onPress={() => setMountain(mountain === m ? null : m)}
            style={[
              styles.chip,
              {
                borderRadius: radius.full,
                borderColor: mountain === m ? colors.primary : colors.border,
              },
            ]}
          >
            <Text variant="caption" color={mountain === m ? 'primary' : 'textSecondary'}>
              {m} {n}
            </Text>
          </Pressable>
        ))}
      </View>

      {!mountain ? (
        <Text variant="caption" color="disabled" style={styles.hint}>
          ⚠️ 위에서 등반지를 먼저 고르세요.
        </Text>
      ) : null}
    </>
  );

  const renderRow = (c: Concept) => (
    <View style={[styles.row, { borderColor: colors.border, borderRadius: radius.md }]}>
          <View style={styles.rowHead}>
            {/* 🚨 난이도가 사진 안에 글자로 그려져 있는 경우가 많다 — 눌러서 크게 본다 */}
            {conceptThumbnail(c) ? (
              <Pressable
                onPress={() => setViewer({ images: conceptImages(c), index: 0 })}
                style={[styles.thumb, { borderRadius: radius.sm }]}
              >
                <RemoteImage
                  uri={conceptThumbnail(c)}
                  variant="thumb"
                  style={styles.thumbImg}
                  resizeMode="cover"
                />
              </Pressable>
            ) : (
              <View
                style={[
                  styles.thumb,
                  styles.noThumb,
                  { borderColor: colors.border, borderRadius: radius.sm },
                ]}
              >
                <Text variant="caption" color="disabled">
                  사진{'\n'}없음
                </Text>
              </View>
            )}
            <View style={styles.grow}>
              <Text variant="label" numberOfLines={1}>
                {c.routeName || '이름 없음'}
              </Text>
              <Text variant="caption" color="textSecondary">
                {c.zone || '-'} · {c.type}
              </Text>
            </View>
          </View>

          {openId === c.id ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.grades}>
              {gradesFor(c.type).map((g) => (
                <Pressable
                  key={g}
                  disabled={busy}
                  onPress={() => void apply(c, g)}
                  style={[
                    styles.chip,
                    { borderRadius: radius.full, borderColor: colors.border },
                  ]}
                >
                  <Text variant="caption">{g}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <Pressable onPress={() => setOpenId(c.id)} hitSlop={6}>
              <Text variant="label" color="primary">
                난이도 입력
              </Text>
            </Pressable>
          )}
    </View>
  );

  return (
    <>
      <FlatList
        data={rows}
        keyExtractor={(c) => `${c.source}/${c.id}`}
        ListHeaderComponent={header}
        renderItem={({ item }) => renderRow(item)}
        ListEmptyComponent={
          mountain ? (
            <Text variant="body" color="textSecondary" style={styles.hint}>
              이 등반지는 다 채웠습니다. 👏
            </Text>
          ) : null
        }
        contentContainerStyle={[styles.pad, { paddingBottom: bottomSpace + 24 }]}
        keyboardShouldPersistTaps="handled"
        /* 썸네일이 붙어 있어 한 번에 많이 그리면 메모리가 튄다 (머리말) */
        initialNumToRender={6}
        maxToRenderPerBatch={4}
        windowSize={5}
      />

      {viewer ? (
        <ConceptImageViewer
          visible
          images={viewer.images}
          initialIndex={viewer.index}
          onClose={() => setViewer(null)}
        />
      ) : null}
    </>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', rowGap: 8 },
  pad: { padding: 16, rowGap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  chip: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8 },
  hint: { marginTop: 8 },
  row: { borderWidth: 1, padding: 12, rowGap: 8 },
  rowHead: { flexDirection: 'row', alignItems: 'center', columnGap: 10 },
  thumb: { width: 74, height: 74, overflow: 'hidden' },
  thumbImg: { width: '100%', height: '100%' },
  noThumb: { borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  grow: { flex: 1 },
  grades: { marginTop: 2 },
});
