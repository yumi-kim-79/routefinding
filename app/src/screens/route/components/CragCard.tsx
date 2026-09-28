/**
 * 암장 정보 요약 카드 — 개념도 상세 위쪽.
 *
 * ⚠️ 접근 정보는 **개념도보다 먼저 찾는 정보**다 (경쟁 분석 2순위).
 *    그래서 사진 다음, 기본 정보 앞에 둔다.
 * ⚠️ 문서가 없는 암장이 대부분이다(967개 구역). 그래도 카드는 띄운다 —
 *    "정보가 없다"는 사실 자체를 알아야 관리자가 채운다.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Text } from '../../../components/common/Text';
import { AppIcon } from '../../../components/common/AppIcon';
import { useTheme } from '../../../theme';
import { subscribeCrag } from '../../../services/cragService';
import { cragDisplayName, cragSummary, type Crag } from '../../../types/crag';
import type { Concept } from '../../../types/concept';
import type { MainStackParamList } from '../../../navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

export const CragCard: React.FC<{ concept: Concept }> = ({ concept }) => {
  const { colors, radius } = useTheme();
  const navigation = useNavigation<Nav>();
  const [crag, setCrag] = useState<Crag | null>(null);

  useEffect(
    () => subscribeCrag(concept.mountain, concept.zone, setCrag),
    [concept.mountain, concept.zone],
  );

  if (!concept.mountain?.trim()) {
    return null;
  }

  const summary = crag ? cragSummary(crag) : '';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() =>
        navigation.navigate('CragDetail', {
          mountain: concept.mountain ?? '',
          zone: concept.zone,
          latitude: concept.latitude !== undefined ? Number(concept.latitude) : undefined,
          longitude: concept.longitude !== undefined ? Number(concept.longitude) : undefined,
        })
      }
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surfaceVariant,
          borderRadius: radius.md,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.body}>
        <Text variant="label">{cragDisplayName(concept.mountain, concept.zone)}</Text>
        <Text variant="caption" color={summary ? 'textSecondary' : 'disabled'}>
          {crag?.notice
            ? `⚠️ ${crag.notice}`
            : summary || '접근·주차 정보가 아직 없습니다'}
        </Text>
      </View>
      <AppIcon name="chevron-right" size={16} color={colors.textSecondary} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 10,
    marginHorizontal: 12,
    marginTop: 12,
    padding: 12,
  },
  body: { flex: 1, rowGap: 2 },
});
