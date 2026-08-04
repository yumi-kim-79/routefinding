/**
 * 지도 상단 필터 바 — 웹 MapView.vue의 `.filter-bar` 1:1.
 * 리드/볼더링 칩 · 등반지 · 구역 · 검색 · 내 위치.
 * 가로 스크롤(웹 overflow-x: auto 대응).
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Text } from '../../../components/common/Text';
import { useTheme } from '../../../theme';
import type { ConceptType } from '../../../types/concept';
import { PickerModal } from './PickerModal';

const TYPES: readonly ConceptType[] = ['리드', '볼더링'];

interface MapFilterBarProps {
  type: ConceptType;
  onTypeChange: (t: ConceptType) => void;
  mountain: string;
  onMountainChange: (m: string) => void;
  zone: string;
  onZoneChange: (z: string) => void;
  keyword: string;
  onKeywordChange: (k: string) => void;
  mountainList: string[];
  zoneList: string[];
  onMyLocation: () => void;
}

export const MapFilterBar: React.FC<MapFilterBarProps> = ({
  type,
  onTypeChange,
  mountain,
  onMountainChange,
  zone,
  onZoneChange,
  keyword,
  onKeywordChange,
  mountainList,
  zoneList,
  onMyLocation,
}) => {
  const { colors, radius, spacing } = useTheme();
  const [picker, setPicker] = useState<'mountain' | 'zone' | null>(null);

  const selectStyle = [
    styles.select,
    { borderColor: colors.border, borderRadius: radius.full, backgroundColor: colors.surface },
  ];

  return (
    <View style={{ backgroundColor: colors.surface }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.bar, { paddingHorizontal: spacing.sm, gap: spacing.xs }]}
      >
        {TYPES.map((t) => {
          const active = type === t;
          return (
            <Pressable
              key={t}
              accessibilityRole="button"
              onPress={() => onTypeChange(t)}
              style={[
                styles.chip,
                {
                  borderRadius: radius.full,
                  backgroundColor: active ? colors.primary : colors.surfaceVariant,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
            >
              <Text color={active ? 'onPrimary' : 'textSecondary'}>{t}</Text>
            </Pressable>
          );
        })}

        <Pressable accessibilityRole="button" onPress={() => setPicker('mountain')} style={selectStyle}>
          <Text color={mountain ? 'textPrimary' : 'textSecondary'}>{mountain || '전체 산'} ▾</Text>
        </Pressable>

        {mountain && zoneList.length > 0 ? (
          <Pressable accessibilityRole="button" onPress={() => setPicker('zone')} style={selectStyle}>
            <Text color={zone ? 'textPrimary' : 'textSecondary'}>{zone || '전체 구역'} ▾</Text>
          </Pressable>
        ) : null}

        <TextInput
          value={keyword}
          onChangeText={onKeywordChange}
          placeholder="산/구역/루트이름 검색"
          placeholderTextColor={colors.disabled}
          style={[
            styles.search,
            {
              color: colors.textPrimary,
              borderColor: colors.border,
              borderRadius: radius.full,
              backgroundColor: colors.surface,
            },
          ]}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />

        <Pressable
          accessibilityRole="button"
          onPress={onMyLocation}
          style={[styles.chip, { borderRadius: radius.full, borderColor: colors.border, backgroundColor: colors.surface }]}
        >
          <Text color="textSecondary">내 위치</Text>
        </Pressable>
      </ScrollView>

      <PickerModal
        visible={picker === 'mountain'}
        title="등반지 선택"
        options={mountainList}
        value={mountain}
        allLabel="전체 산"
        onSelect={onMountainChange}
        onClose={() => setPicker(null)}
      />
      <PickerModal
        visible={picker === 'zone'}
        title="구역 선택"
        options={zoneList}
        value={zone}
        allLabel="전체 구역"
        onSelect={onZoneChange}
        onClose={() => setPicker(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 7, borderWidth: 1 },
  select: { paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1 },
  search: { minWidth: 180, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, fontSize: 15 },
});
