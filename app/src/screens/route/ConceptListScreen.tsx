/**
 * 개념도 탭 — v2 리뉴얼판 (v1 concept_list_screen.dart / 웹 ConceptListView.vue 대체).
 *
 * 리뉴얼 방향(사용자 결정 2026-08-03): **검색 중심**
 *   - 기존: 리드/볼더링 칩 + 등반지 드롭다운 + 구역 드롭다운 + 검색  (4단계)
 *   - v2  : 검색 한 줄                                              (1단계)
 *     등반지·구역·루트명·개요를 한 검색창에서 전부 필터한다.
 *
 *   ⚠️ **검색 전에는 목록을 띄우지 않는다.** 승인 루트가 5,400건이 넘어
 *      전체 목록은 의미가 없고, 산속 네트워크에서 전량 로딩은 그대로 대기시간이 된다.
 *      조회 자체도 첫 검색까지 미룬다(useConcepts) → 검색 안 하면 Firestore 읽기 0.
 *
 * 데이터: 기존 컬렉션 그대로 (route_reports + bouldering_reports, status=='approved').
 *   스키마 변경 없음 — docs/02_DATA_MODEL.md 준수.
 */
import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Text } from '../../components/common/Text';
import { useTheme } from '../../theme';
import { ConceptCard } from './components/ConceptCard';
import { ConceptPhotoEditor } from './components/ConceptPhotoEditor';
import { useConcepts, type ConceptFilter } from './hooks/useConcepts';
import type { Concept } from '../../types/concept';

const FILTERS: readonly ConceptFilter[] = ['전체', '리드', '볼더링'];

/** 빈 화면에서 뭘 쳐야 할지 알려주는 예시 */
const SEARCH_EXAMPLES = ['북한산', '인수봉', '파주', '무의도'];

export const ConceptListScreen: React.FC = () => {
  const { colors, radius, spacing } = useTheme();
  /** 사진 등록 대상 (카드의 카메라 버튼으로 연다) */
  const [photoTarget, setPhotoTarget] = useState<Concept | null>(null);
  const {
    filtered,
    keyword,
    setKeyword,
    filter,
    setFilter,
    hasQuery,
    loading,
    refreshing,
    refresh,
    error,
    warnings,
  } = useConcepts();

  return (
    <View style={[styles.wrap, { backgroundColor: colors.background }]}>
      {/* 검색 한 줄 */}
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
        <TextInput
          value={keyword}
          onChangeText={setKeyword}
          placeholder="등반지 · 구역 · 루트명 검색"
          placeholderTextColor={colors.disabled}
          style={[
            styles.search,
            {
              color: colors.textPrimary,
              borderColor: colors.border,
              borderRadius: radius.md,
              backgroundColor: colors.surface,
            },
          ]}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      {/* 보조 칩 — 검색 결과가 있을 때만 의미가 있으므로 그때만 노출 */}
      {hasQuery ? (
        <View style={[styles.chipRow, { paddingHorizontal: spacing.md }]}>
          {FILTERS.map((f) => {
            const active = filter === f;
            return (
              <Pressable
                key={f}
                accessibilityRole="button"
                onPress={() => setFilter(f)}
                style={[
                  styles.chip,
                  {
                    borderRadius: radius.full,
                    backgroundColor: active
                      ? colors.primary
                      : colors.surfaceVariant,
                  },
                ]}
              >
                <Text
                  variant="label"
                  style={{
                    color: active ? colors.onPrimary : colors.textSecondary,
                  }}
                >
                  {f}
                </Text>
              </Pressable>
            );
          })}

          {!loading ? (
            <Text variant="caption" color="textSecondary" style={styles.count}>
              {filtered.length}개
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* 부분 실패 경고 (한쪽 컬렉션만 못 읽은 경우) */}
      {hasQuery && !error && warnings.length > 0 ? (
        <Text
          variant="caption"
          color="warning"
          style={{ paddingHorizontal: spacing.md, paddingTop: spacing.xs }}
        >
          일부 목록을 불러오지 못했습니다. (당겨서 새로고침)
        </Text>
      ) : null}

      {!hasQuery ? (
        /* 검색 전 안내 — 목록 없음 */
        <View style={styles.center}>
          <Text variant="title" color="textSecondary" style={styles.centerText}>
            찾을 개념도를 검색해 주세요
          </Text>
          <Text
            variant="body"
            color="textSecondary"
            style={[styles.centerText, styles.guideDesc]}
          >
            등반지 · 구역 · 루트명으로 찾을 수 있습니다.
          </Text>
          <View style={styles.exampleRow}>
            {SEARCH_EXAMPLES.map((ex) => (
              <Pressable
                key={ex}
                accessibilityRole="button"
                onPress={() => setKeyword(ex)}
                style={[
                  styles.exampleChip,
                  { borderRadius: radius.full, borderColor: colors.border },
                ]}
              >
                <Text variant="label" color="primary">
                  {ex}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text variant="body" color="error" style={styles.centerText}>
            개념도를 불러오지 못했습니다.
          </Text>
          <Text variant="caption" color="textSecondary" style={styles.centerText}>
            {error}
          </Text>
        </View>
      ) : loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
          <Text
            variant="caption"
            color="textSecondary"
            style={[styles.centerText, styles.guideDesc]}
          >
            루트 정보를 불러오는 중…
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => `${c.source}/${c.id}`}
          contentContainerStyle={
            filtered.length === 0 ? styles.emptyContent : { padding: spacing.md }
          }
          renderItem={({ item }) => <ConceptCard concept={item} onPhotoPress={setPhotoTarget} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text variant="body" color="textSecondary" style={styles.centerText}>
                '{keyword.trim()}' 검색 결과가 없습니다.
              </Text>
            </View>
          }
          keyboardShouldPersistTaps="handled"
          // 이미지가 많은 목록 — 한 번에 그리는 양을 제한 (5,400건 규모 대비)
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews
        />
      )}
      <ConceptPhotoEditor
        visible={photoTarget !== null}
        concept={photoTarget}
        onClose={() => setPhotoTarget(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  search: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
    paddingBottom: 2,
  },
  chip: { paddingHorizontal: 14, paddingVertical: 6 },
  count: { marginLeft: 'auto' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  centerText: { textAlign: 'center' },
  guideDesc: { marginTop: 8 },
  exampleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
  },
  exampleChip: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  emptyContent: { flexGrow: 1 },
});
