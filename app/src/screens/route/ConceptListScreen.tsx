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
import React, { useCallback, useMemo, useState } from 'react';
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
import { Button } from '../../components/common/Button';
import { useTheme } from '../../theme';
import { ConceptCard } from './components/ConceptCard';
import { ConceptPhotoEditor } from './components/ConceptPhotoEditor';
import { useConcepts, type ConceptFilter } from './hooks/useConcepts';
import type { Concept } from '../../types/concept';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../stores/authStore';
import { isAdminEmail } from '../../constants/admin';
import { useFavorites } from './hooks/useFavorites';
import { deleteReport } from '../../services/reportService';
import { Alert } from 'react-native';

const FILTERS: readonly ConceptFilter[] = ['전체', '리드', '볼더링'];

/** 빈 화면에서 뭘 쳐야 할지 알려주는 예시 */
const SEARCH_EXAMPLES = ['북한산', '인수봉', '파주', '무의도'];

export const ConceptListScreen: React.FC = () => {
  const { colors, radius, spacing } = useTheme();
  /** 사진 등록 대상 (카드의 카메라 버튼으로 연다) */
  const [photoTarget, setPhotoTarget] = useState<Concept | null>(null);
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const isAdmin = isAdminEmail(useAuthStore((st) => st.user?.email));
  const favorites = useFavorites();

  /** 등반일지 쓰기 — 장소·루트명이 채워진 채 열린다 (웹 카드의 연필 버튼) */
  const writeLog = useCallback(
    (c: Concept) =>
      navigation.navigate('ClimbingLogEdit', {
        initial: {
          place: [c.mountain, c.zone].filter(Boolean).join(' '),
          routeName: c.routeName ?? '',
          conceptId: c.id,
          conceptSource: c.source,
        },
      }),
    [navigation],
  );

  const editConcept = useCallback(
    (c: Concept) => navigation.navigate('ConceptEdit', { conceptId: c.id, source: c.source }),
    [navigation],
  );

  const deleteConcept = useCallback((c: Concept) => {
    Alert.alert(
      '개념도 삭제',
      `"${c.routeName ?? '이름 없음'}"을(를) 정말 삭제할까요?\n되돌릴 수 없습니다.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => {
            void deleteReport(c.source, c.id).catch((e: unknown) =>
              Alert.alert('삭제 실패', e instanceof Error ? e.message : String(e)),
            );
          },
        },
      ],
    );
  }, []);
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

  /**
   * 검색 결과가 **한 등반지**(가능하면 한 구역)로 좁혀졌으면, 그 자리에서 제보할 수 있게 한다.
   * 여러 등반지가 섞인 결과에서는 무엇을 채워야 할지 알 수 없으므로 버튼을 띄우지 않는다
   * (엉뚱한 등반지로 채워 넣는 것보다 안 띄우는 편이 낫다).
   */
  const reportTarget = useMemo(() => {
    if (filtered.length === 0) {
      return null;
    }
    const mountains = new Set(filtered.map((c) => c.mountain).filter(Boolean));
    if (mountains.size !== 1) {
      return null;
    }
    const zones = new Set(filtered.map((c) => c.zone).filter(Boolean));
    const withCoord = filtered.find(
      (c) =>
        String(c.latitude ?? '').trim() !== '' && String(c.longitude ?? '').trim() !== '',
    );
    const sameType = new Set(filtered.map((c) => c.type));
    return {
      mountain: [...mountains][0] as string,
      zone: zones.size === 1 ? ([...zones][0] as string) : undefined,
      // 같은 구역이면 좌표도 대개 비슷하다 — 시작점만 잡아준다(폼에서 고칠 수 있다)
      latitude: zones.size === 1 && withCoord ? String(withCoord.latitude) : undefined,
      longitude: zones.size === 1 && withCoord ? String(withCoord.longitude) : undefined,
      typeRoot: sameType.size === 1 ? [...sameType][0] : undefined,
    };
  }, [filtered]);

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

      {/*
        보고 있는 등반지·구역에 루트를 바로 제보한다 (2026-08-05 요청).
        예전엔 홈으로 나가 루트제보 탭에서 등반지·구역·좌표를 처음부터 골라야 했다.
      */}
      {hasQuery && !loading && reportTarget ? (
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.xs }}>
          <Button
            title={`${reportTarget.mountain}${
              reportTarget.zone ? ` · ${reportTarget.zone}` : ''
            }에 루트 제보`}
            variant="secondary"
            size="sm"
            onPress={() =>
              navigation.navigate('ReportWrite', {
                prefill: {
                  typeRoot: reportTarget.typeRoot,
                  mountain: reportTarget.mountain,
                  zone: reportTarget.zone,
                  latitude: reportTarget.latitude,
                  longitude: reportTarget.longitude,
                },
              })
            }
          />
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
          renderItem={({ item }) => (
            <ConceptCard
              concept={item}
              onPhotoPress={setPhotoTarget}
              isFavorite={favorites.isFavorite(item.id)}
              onFavoritePress={favorites.toggle}
              onLogPress={writeLog}
              isAdmin={isAdmin}
              onEditPress={editConcept}
              onDeletePress={deleteConcept}
            />
          )}
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
