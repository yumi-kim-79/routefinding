/**
 * 수정 제안 검토 탭 (관리자 전용) — 마이페이지. v2.2.0 신규.
 *
 * ⚠️ 원본과 제안을 **나란히** 보여준다. 뭐가 어떻게 바뀌는지 보이지 않으면
 *    관리자는 그냥 다 승인하거나 다 무시하게 된다.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../../components/common/Text';
import { useTheme } from '../../../theme';
import {
  applySuggestion,
  rejectSuggestion,
  subscribeSuggestions,
} from '../../../services/editSuggestionService';
import { fieldLabel, type EditSuggestion } from '../../../types/editSuggestion';

export const EditSuggestionsTab: React.FC = () => {
  const { colors, radius } = useTheme();
  const [list, setList] = useState<EditSuggestion[] | null>(null);
  const [error, setError] = useState('');
  const [onlyOpen, setOnlyOpen] = useState(true);

  useEffect(() => subscribeSuggestions(setList, setError), []);

  const rows = useMemo(
    () => (list ?? []).filter((s) => (onlyOpen ? s.status === 'open' : true)),
    [list, onlyOpen],
  );

  if (error) {
    return (
      <View style={styles.center}>
        <Text variant="body" color="error" style={styles.centerText}>
          {error}
        </Text>
      </View>
    );
  }

  if (list === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <FlatList
      data={rows}
      keyExtractor={(s) => s.id}
      contentContainerStyle={styles.pad}
      ListHeaderComponent={
        <Pressable onPress={() => setOnlyOpen((v) => !v)} style={styles.filter} hitSlop={6}>
          <Text variant="label" color="primary">
            {onlyOpen
              ? `검토 대기 ${(list ?? []).filter((s) => s.status === 'open').length} · 전체 보기`
              : '전체 · 대기만 보기'}
          </Text>
        </Pressable>
      }
      ListEmptyComponent={
        <Text variant="body" color="textSecondary" style={styles.centerText}>
          {onlyOpen ? '검토할 제안이 없습니다.' : '제안이 없습니다.'}
        </Text>
      }
      renderItem={({ item }) => (
        <View style={[styles.card, { borderColor: colors.border, borderRadius: radius.md }]}>
          <Text variant="label">{item.title}</Text>
          <Text variant="caption" color="textSecondary">
            {item.nickname}
            {item.status !== 'open' ? ` · ${item.status === 'applied' ? '반영됨' : '반려됨'}` : ''}
          </Text>

          {/* 원본 → 제안 (위 머리말: 나란히 보여야 판단이 된다) */}
          {Object.entries(item.patch).map(([k, v]) => (
            <View key={k} style={styles.diff}>
              <Text variant="caption" color="textSecondary" style={styles.diffKey}>
                {fieldLabel(k)}
              </Text>
              <Text variant="caption" color="disabled" style={styles.diffOld}>
                {item.before[k as keyof typeof item.before] || '(비어 있음)'}
              </Text>
              <Text variant="caption" color="primary" style={styles.diffNew}>
                → {v || '(지움)'}
              </Text>
            </View>
          ))}

          {item.reason ? (
            <Text variant="caption" color="textSecondary">
              사유: {item.reason}
            </Text>
          ) : null}

          {item.status === 'open' ? (
            <View style={styles.btns}>
              <Pressable
                onPress={() =>
                  void applySuggestion(item).catch((e: unknown) =>
                    Alert.alert('반영 실패', e instanceof Error ? e.message : String(e)),
                  )
                }
                hitSlop={6}
              >
                <Text variant="label" color="primary">
                  반영
                </Text>
              </Pressable>
              <Pressable onPress={() => void rejectSuggestion(item.id)} hitSlop={6}>
                <Text variant="label" color="error">
                  반려
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      )}
    />
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  centerText: { textAlign: 'center', padding: 16 },
  pad: { padding: 16, rowGap: 10 },
  filter: { paddingBottom: 8 },
  card: { borderWidth: 1, padding: 12, rowGap: 4 },
  diff: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 6 },
  diffKey: { width: 62 },
  diffOld: { textDecorationLine: 'line-through' },
  diffNew: { flexShrink: 1 },
  btns: { flexDirection: 'row', columnGap: 16, marginTop: 6 },
});
