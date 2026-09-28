/**
 * 루트 한 줄 (개념도 탭 목록 + 지도 탭 '이 위치의 루트' 목록 **공용**).
 *
 * 두 줄이 전부다:
 *   영인암장 · 우측 · 늘해랑
 *   리드 · 5.12c · 12m · 3피치
 *
 * ── 🚫 2026-08-29: 썸네일과 액션 아이콘을 **둘 다 걷어냈다** ──────────────
 *  ① 썸네일 — "목록은 글자만 나오는 게 로딩도 빠르고 트래픽도 준다"
 *     이 목록은 한 화면에 여러 장이 동시에 뜨고 검색어를 칠 때마다 통째로 갈린다.
 *     36~39차에 큐·우선순위·취소까지 붙였던 게 전부 이 목록 때문이었다.
 *     사진은 상세로 들어가면 축소본이 먼저 떠서 어차피 바로 보인다(38차).
 *  ② 별·연필·카메라·수정·삭제 아이콘 — "아이콘 때문에 목록이 몇 개 안 보인다"
 *     아이콘 5개가 세로로 쌓여 카드 높이를 정하고 있었다.
 *     전부 **개념도 상세 화면**으로 옮겼다 — 그쪽이 공간이 넉넉하다.
 *
 *  ⚠️ 지도 탭(`ClusterListModal`)도 이 컴포넌트를 쓴다.
 *     예전에는 그쪽만 루트명·등반지만 보여줘서 **같은 루트인데 정보가 달랐다.**
 *     한쪽만 고치지 말 것 — 요약 문구는 `conceptMetaLine()` 한 곳에서 만든다.
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Text } from '../../../components/common/Text';
import { useTheme } from '../../../theme';
import { conceptMetaLine, conceptTitle, type Concept } from '../../../types/concept';
import type { MainStackParamList } from '../../../navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

interface ConceptCardProps {
  concept: Concept;
  /**
   * 눌렀을 때 할 일. 넘기지 않으면 개념도 상세로 바로 이동한다.
   * 지도 탭에서는 **모달을 먼저 닫아야** 하므로 여기로 가로챈다.
   */
  onPress?: (concept: Concept) => void;
  /** 지도 탭의 시트 안에서는 카드 테두리 대신 구분선 한 줄이 어울린다 */
  variant?: 'card' | 'row';
  /**
   * 폐쇄 중인 루트면 제목 옆에 배지를 단다 (2026-09-15).
   * ⚠️ 카드가 직접 판정하지 않는다. 구역 폐쇄를 알려면 crags 를 읽어야 하는데,
   *    카드마다 읽으면 목록 한 화면에 수십 번 읽는다. 목록이 한 번 읽어서 내려준다.
   */
  closed?: boolean;
}

export const ConceptCard: React.FC<ConceptCardProps> = ({
  concept,
  onPress,
  variant = 'card',
  closed = false,
}) => {
  const navigation = useNavigation<Nav>();
  const { colors, radius, spacing } = useTheme();

  const meta = conceptMetaLine(concept);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() =>
        onPress
          ? onPress(concept)
          : navigation.navigate('ConceptDetail', {
              conceptId: concept.id,
              source: concept.source,
            })
      }
      style={({ pressed }) => [
        variant === 'card'
          ? {
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.divider,
              borderRadius: radius.md,
              marginBottom: 8,
            }
          : {
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: colors.divider,
            },
        {
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          backgroundColor: pressed ? colors.surfaceVariant : undefined,
        },
      ]}
    >
      <View style={styles.titleRow}>
        <Text variant="title" numberOfLines={1} style={styles.titleText}>
          {conceptTitle(concept)}
        </Text>
        {closed ? (
          <View style={[styles.badge, { backgroundColor: colors.error, borderRadius: radius.sm }]}>
            <Text variant="caption" style={styles.badgeText}>
              ⛔ 폐쇄
            </Text>
          </View>
        ) : null}
      </View>
      {/*
        요약은 **최대 두 줄**까지 흐르게 둔다.
        난이도·길이·형태·장비까지 넣으면 한 줄에 안 들어가는 루트가 생기는데,
        한 줄로 잘라 버리면 뒤쪽 항목(장비 등)이 통째로 사라진다 — 그게 사용자가
        "있는 항목은 보여줘야지"라고 한 지점이다 (2026-08-31).
      */}
      {meta ? (
        <Text variant="caption" color="textSecondary" numberOfLines={2} style={styles.meta}>
          {meta}
        </Text>
      ) : null}
      {/* 기타 내용(개요) — 있으면 한 줄만 */}
      {concept.overview ? (
        <Text variant="caption" color="disabled" numberOfLines={1} style={styles.meta}>
          {concept.overview}
        </Text>
      ) : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  meta: { marginTop: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', columnGap: 6 },
  titleText: { flexShrink: 1 },
  badge: { paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { color: '#ffffff', fontWeight: '700' },
});
