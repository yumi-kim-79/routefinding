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
 *
 * v2.2.0 (2026-09-07): **구역(zone)별 묶어 보기** 추가.
 *   한 암장에 루트가 많으면(선운산 도솔암 107개) 평평한 목록은 읽을 수가 없다.
 *   ⚠️ **볼더링은 묶지 않는다.** 볼더의 `zone` 은 구역이 아니라 볼더/블록 이름이라
 *      748개가 있고 구역당 평균 3.3개다 — 묶으면 헤더만 잔뜩 생긴다 (2026-09-07 실측).
 */
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  SectionList,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Text } from '../../components/common/Text';
import { AppIcon } from '../../components/common/AppIcon';
import { Button } from '../../components/common/Button';
import { AdBanner } from '../../components/common/AdBanner';
import { useTheme } from '../../theme';
import { ConceptCard } from './components/ConceptCard';
import { useConcepts, type ConceptFilter } from './hooks/useConcepts';
import { FavoriteList } from '../../components/favorites/FavoriteList';
import { useClosedCrags } from '../../hooks/useClosedCrags';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../navigation/types';

const FILTERS: readonly ConceptFilter[] = ['전체', '리드', '볼더링'];

/** 구역이 비어 있는 문서를 모으는 자리 — 실측상 1건뿐이지만 빠뜨리면 안 보인다 */
const NO_ZONE = '구역 미지정';

/** 빈 화면에서 뭘 쳐야 할지 알려주는 예시 */
const SEARCH_EXAMPLES = ['북한산', '인수봉', '파주', '무의도'];

export const ConceptListScreen: React.FC = () => {
  const { colors, radius, spacing } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  /*
   * ⚠️ 즐겨찾기·등반일지·사진등록·수정·삭제 핸들러가 여기 있었다 (2026-08-29에 상세로 이전).
   *    목록은 이제 **읽기 전용**이다. 되돌리려면 ConceptDetailScreen 의 같은 이름 함수들을 참고할 것.
   */
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

  /** 폐쇄 배지 — 구역 폐쇄를 루트에 내려 꽂으려면 한 번 읽어야 한다 */
  const { isConceptClosed } = useClosedCrags();

  /** 접어 둔 구역 */
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  /**
   * 구역별 섹션.
   *
   * ⚠️ 리드만 묶는다 (머리말 참조). 볼더링은 구역이 사실상 볼더 이름이라
   *    묶으면 한 줄짜리 섹션이 수백 개 생긴다 → 등반지로만 묶는다.
   * ⚠️ 섹션 제목은 **등반지 · 구역**이다. 검색 결과에는 여러 등반지가 섞여 있어
   *    구역 이름만 쓰면 '우측벽'이 여러 번 나온다.
   */
  const sections = useMemo(() => {
    const groups = new Map<string, typeof filtered>();
    filtered.forEach((c) => {
      const mountain = (c.mountain ?? '').trim();
      const zone = (c.zone ?? '').trim();
      const key =
        c.type === '볼더링'
          ? mountain || NO_ZONE
          : [mountain, zone || NO_ZONE].filter(Boolean).join(' · ');
      const arr = groups.get(key);
      if (arr) {
        arr.push(c);
      } else {
        groups.set(key, [c]);
      }
    });
    return [...groups.entries()]
      // '구역 미지정'은 항상 맨 아래로 — 정상 구역을 밀어내면 안 된다
      .sort((a, b) => {
        const an = a[0].endsWith(NO_ZONE) ? 1 : 0;
        const bn = b[0].endsWith(NO_ZONE) ? 1 : 0;
        return an - bn || b[1].length - a[1].length;
      })
      .map(([title, data]) => ({
        title,
        count: data.length,
        data: collapsed.has(title) ? [] : data,
      }));
  }, [filtered, collapsed]);

  /*
   * ⚠️ 여기 있던 `dropPendingThumbnails()` 를 **뺐다** (2026-08-29).
   *    이 목록은 이제 썸네일을 아예 요청하지 않는다(ConceptCard 머리말 참조).
   *    그대로 두면 검색어를 칠 때마다 **다른 화면(마이페이지 등)의** 대기 중인
   *    썸네일 요청까지 취소해 버린다 — 이제는 도움이 아니라 방해다.
   *    카드에 썸네일을 되살린다면 이 호출도 함께 되살릴 것.
   */

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
        /*
         * 검색 전 화면 — **즐겨찾기를 먼저 보여준다** (2026-09-14).
         *
         * 이 탭은 "검색어가 없으면 Firestore 를 읽지 않는다"는 정책(useConcepts 머리말) 때문에
         * 지금까지 안내 문구만 있는 빈 화면이었다. 즐겨찾기는 `users/{uid}/my_routes`
         * 구독 하나라 **그 정책을 건드리지 않고** 채울 수 있다 — 5,400건짜리 개념도를
         * 읽지 않는다.
         *
         * 즐겨찾기가 하나도 없으면 `emptyFallback` 으로 원래 안내가 그대로 나온다.
         */
        <FavoriteList
          title="즐겨찾기"
          emptyFallback={
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
          }
        />
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
        <SectionList
          sections={sections}
          keyExtractor={(c) => `${c.source}/${c.id}`}
          /*
           * 🚨 `removeClippedSubviews` 를 **켜지 않는다** (2026-09-08).
           *    SectionList + 고정 헤더(sticky) + 뷰 재활용 조합은 안드로이드에서
           *    네이티브 뷰가 먼저 떨어져 나가 **앱이 그냥 종료된다**
           *    (사용자 보고: "검색만 하면 앱이 나가져").
           *    FlatList 시절에는 안전했던 옵션이라 그대로 가져온 것이 화근이었다.
           */
          stickySectionHeadersEnabled
          renderSectionHeader={({ section }) => (
            <Pressable
              onPress={() =>
                setCollapsed((prev) => {
                  const next = new Set(prev);
                  if (next.has(section.title)) {
                    next.delete(section.title);
                  } else {
                    next.add(section.title);
                  }
                  return next;
                })
              }
              style={[
                styles.sectionHeader,
                { backgroundColor: colors.background, borderBottomColor: colors.divider },
              ]}
            >
              <AppIcon
                name={collapsed.has(section.title) ? 'chevron-right' : 'chevron-down'}
                size={14}
                color={colors.textSecondary}
              />
              <Text variant="label" style={styles.sectionTitle} numberOfLines={1}>
                {section.title}
              </Text>
              <Text variant="caption" color="textSecondary">
                {section.count}
              </Text>
            </Pressable>
          )}
          contentContainerStyle={
            filtered.length === 0 ? styles.emptyContent : { paddingBottom: spacing.md }
          }
          /*
            ⚠️ 별·연필·카메라·수정·삭제 버튼을 **개념도 상세로 옮겼다** (2026-08-29).
               아이콘 5개가 세로로 쌓여 카드 높이를 정하는 바람에
               "목록이 몇 개 안 보인다"는 지적이 나왔다. 상세 화면이 공간이 넉넉하다.
          */
          renderItem={({ item }) => (
            <ConceptCard concept={item} closed={isConceptClosed(item)} />
          )}
          renderSectionFooter={({ section }) =>
            section.data.length === 0 ? (
              <Text variant="caption" color="disabled" style={styles.collapsedHint}>
                접힘 · 눌러서 펼치기
              </Text>
            ) : null
          }
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
          /*
           * 🚀 렌더 예산 (2026-08-25 조정 — "목록이 잘 안 내려간다")
           *
           * 카드마다 썸네일 1장이고, 썸네일은 `getDownloadURL()` 왕복이 필요하다.
           * 한 번에 많이 그리면 그만큼 요청이 동시에 나가 서로를 밀어낸다.
           * 화면에 실제로 보이는 건 5~6장이므로 그 정도만 앞서 그린다.
           *   initialNumToRender  10 → 6   첫 화면이 빨리 뜬다
           *   maxToRenderPerBatch 10 → 4   스크롤 중 한 번에 만드는 카드 수를 줄인다
           *   windowSize           7 → 5   위아래로 붙잡아 두는 화면 수
           * (동시 요청 자체는 imageUrlService 의 큐가 4건으로 제한한다)
           */
          initialNumToRender={6}
          maxToRenderPerBatch={4}
          updateCellsBatchingPeriod={60}
          windowSize={5}
        />
      )}
      {/* 하단 탭 바로 위 배너 */}
      <AdBanner />

    </View>
  );
};

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionTitle: { flex: 1 },
  collapsedHint: { paddingHorizontal: 34, paddingVertical: 8 },
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
