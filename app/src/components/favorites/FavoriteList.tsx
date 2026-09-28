/**
 * 즐겨찾기 목록 — **세 화면이 같은 것을 쓴다** (개념도 · 마이페이지 · 지도 시트).
 *
 * 2026-09-14 사용자 보고: "즐겨찾기 해도 즐겨찾기 목록을 볼 수가 없네."
 *   별(★)은 개념도 상세에서 채워지는데, **모아 보는 곳이 어디에도 없었다.**
 *   마이페이지의 MY ROUTE 탭이 v2.2.0 에서 등반일지로 교체되면서 통째로 사라졌고
 *   (MyPageScreen 머리말), 개념도·지도에는 애초에 없었다.
 *
 * ⚠️ 원본 루트를 다시 읽지 않는다. `my_routes` 문서에 저장해 둔 등반지·루트명·썸네일만
 *    쓴다(favoriteService.FavoriteRoute 머리말). 이름이 바뀐 루트는 목록에서 옛 이름으로
 *    보일 수 있지만, 눌러서 들어간 상세는 원본을 읽으므로 항상 최신이다.
 */
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Text } from '../common/Text';
import { AppIcon } from '../common/AppIcon';
import { RemoteImage } from '../common/RemoteImage';
import { useTheme } from '../../theme';
import { useFavoriteList } from '../../hooks/useFavoriteList';
import type { FavoriteRoute } from '../../services/favoriteService';
import type { MainStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

interface FavoriteListProps {
  /** 검색칸을 보여줄지 — 마이페이지처럼 많이 쌓이는 곳에서만 켠다 */
  searchable?: boolean;
  /** 몇 개까지만 보여줄지 (개념도 첫 화면처럼 곁들여 보여주는 자리) */
  limit?: number;
  /** 목록 위에 붙일 제목 */
  title?: string;
  /** 비어 있을 때 문구 */
  emptyLabel?: string;
  /**
   * 비어 있을 때 문구 대신 통째로 보여줄 것.
   * 개념도 탭이 쓴다 — 즐겨찾기가 없으면 원래의 '검색해 주세요' 안내가 나와야 한다.
   * (구독을 한 곳에서만 하려고 이 방향으로 뒀다. 화면이 따로 세어 보면 리스너가 둘이 된다)
   */
  emptyFallback?: React.ReactNode;
  /** 목록 자체가 스크롤하지 않고 부모에 얹힐 때 (개념도 화면) */
  scrollEnabled?: boolean;
}

export const FavoriteList: React.FC<FavoriteListProps> = ({
  searchable = false,
  limit,
  title,
  emptyLabel = '즐겨찾기한 루트가 없습니다.\n개념도 상세에서 ★ 를 누르면 여기에 모입니다.',
  emptyFallback,
  scrollEnabled = true,
}) => {
  const { colors, radius, spacing } = useTheme();
  const navigation = useNavigation<Nav>();
  const { items, error, signedOut, remove } = useFavoriteList();
  const [keyword, setKeyword] = useState('');

  const shown = useMemo(() => {
    if (!items) {
      return null;
    }
    const q = keyword.trim().toLowerCase();
    const matched = q
      ? items.filter(
          (f) =>
            f.mountain.toLowerCase().includes(q) ||
            f.routeName.toLowerCase().includes(q),
        )
      : items;
    return typeof limit === 'number' ? matched.slice(0, limit) : matched;
  }, [items, keyword, limit]);

  const open = (f: FavoriteRoute) =>
    /*
     * ⚠️ `ConceptDetail` 로 간다. 예전 MyRouteCard 는 `RouteDetail`(= 제보 상세,
     *    관리자용 화면)로 보내고 있었다 — 눌러도 엉뚱한 화면이 떴다.
     * `source` 가 없으면(옛 문서) 생략한다. 상세 화면이 두 컬렉션을 차례로 시도한다.
     */
    navigation.navigate('ConceptDetail', {
      conceptId: f.conceptId,
      ...(f.source ? { source: f.source } : {}),
    });

  /** 즐겨찾기가 하나도 없는데 제목만 덩그러니 남으면 이상하다 */
  const hideHeader = shown !== null && shown.length === 0 && !keyword.trim() && !!emptyFallback;

  const header =
    !hideHeader && (title || searchable) ? (
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
        {title ? (
          <Text variant="title" style={styles.title}>
            {title}
            {items && items.length > 0 ? `  ${items.length}` : ''}
          </Text>
        ) : null}
        {searchable ? (
          <TextInput
            value={keyword}
            onChangeText={setKeyword}
            placeholder="등반지 · 루트명 검색"
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
            clearButtonMode="while-editing"
          />
        ) : null}
      </View>
    ) : null;

  if (signedOut) {
    return (
      <View style={styles.center}>
        <Text variant="body" color="textSecondary">
          로그인하면 즐겨찾기를 볼 수 있습니다.
        </Text>
      </View>
    );
  }

  if (shown === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {header}
      {error ? (
        <Text variant="caption" color="error" style={styles.error}>
          즐겨찾기를 불러오지 못했습니다. {error}
        </Text>
      ) : null}
      {shown.length === 0 ? (
        !keyword.trim() && emptyFallback ? (
          <>{emptyFallback}</>
        ) : (
          <View style={styles.center}>
            <Text variant="body" color="textSecondary" style={styles.emptyText}>
              {keyword.trim() ? '검색 결과가 없습니다.' : emptyLabel}
            </Text>
          </View>
        )
      ) : (
        <FlatList
          data={shown}
          scrollEnabled={scrollEnabled}
          keyExtractor={(f) => f.conceptId}
          contentContainerStyle={{ paddingBottom: spacing.md }}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              onPress={() => open(item)}
              style={({ pressed }) => [
                styles.row,
                {
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  borderBottomColor: colors.divider,
                  backgroundColor: pressed ? colors.surfaceVariant : undefined,
                },
              ]}
            >
              <RemoteImage
                uri={item.imageUrl}
                variant="thumb"
                emptyLabel=""
                style={[styles.thumb, { borderRadius: radius.sm, backgroundColor: colors.surfaceVariant }]}
              />
              <View style={styles.rowText}>
                <Text variant="body" numberOfLines={1}>
                  {item.routeName || '이름 없는 루트'}
                </Text>
                <Text variant="caption" color="textSecondary" numberOfLines={1}>
                  {item.mountain || '등반지 미상'}
                </Text>
              </View>
              {/*
                별을 다시 누르면 해제. 목록에서 바로 지울 수 있어야 정리가 된다.
                ⚠️ hitSlop 을 넉넉히 준다 — 행 전체가 '상세로 이동' 이라
                   별이 작으면 해제하려다 상세로 들어가 버린다.
              */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="즐겨찾기 해제"
                hitSlop={12}
                onPress={() => remove(item.conceptId)}
                style={styles.star}
              >
                <AppIcon name="star" size={22} color={colors.primary} filled />
              </Pressable>
            </Pressable>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  title: { marginBottom: 8 },
  search: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  thumb: { width: 52, height: 52 },
  rowText: { flex: 1, rowGap: 2 },
  star: { padding: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { textAlign: 'center', lineHeight: 21 },
  error: { paddingHorizontal: 16, paddingBottom: 8 },
});
