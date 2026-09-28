/**
 * 개념도(루트) 고르기 시트 — 등반지·구역·루트명으로 검색해서 하나 고른다.
 *
 * ⚠️ 새 쿼리를 만들지 않는다. `fetchConcepts()` 가 이미 전체를 캐시하고 있어
 *    거기서 걸러 쓰는 것이 가장 싸다 (services/conceptService.ts).
 * ⚠️ 5,451개를 전부 그리면 앱이 멈춘다. **검색어가 있을 때만** 목록을 그리고
 *    최대 40개까지만 보여준다.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Text } from './Text';
import { Button } from './Button';
import { useTheme } from '../../theme';
import { useKeyboardSpace } from '../../hooks/useKeyboardSpace';
import { fetchConcepts } from '../../services/conceptService';
import {
  conceptDifficulty,
  conceptSearchIndex,
  conceptTitle,
  type Concept,
} from '../../types/concept';

interface Props {
  visible: boolean;
  onClose: () => void;
  onPick: (c: Concept) => void;
}

const MAX_ROWS = 40;

export const ConceptPicker: React.FC<Props> = ({ visible, onClose, onPick }) => {
  const { colors, radius, spacing } = useTheme();
  const { space: bottomSpace } = useKeyboardSpace();
  const [all, setAll] = useState<Concept[] | null>(null);
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    if (!visible || all !== null) {
      return;
    }
    void fetchConcepts()
      .then((r) => setAll(r.items))
      .catch(() => setAll([]));
  }, [visible, all]);

  const rows = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    if (!k || !all) {
      return [];
    }
    return all.filter((c) => conceptSearchIndex(c).includes(k)).slice(0, MAX_ROWS);
  }, [all, keyword]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.fill, { backgroundColor: colors.background, paddingBottom: bottomSpace }]}>
        <View style={[styles.head, { borderBottomColor: colors.divider }]}>
          <Text variant="title">루트 찾기</Text>
          <Button title="닫기" size="sm" variant="ghost" onPress={onClose} />
        </View>

        <TextInput
          value={keyword}
          onChangeText={setKeyword}
          placeholder="등반지 · 구역 · 루트명으로 검색"
          placeholderTextColor={colors.disabled}
          autoFocus
          style={[
            styles.input,
            { borderColor: colors.divider, borderRadius: radius.sm, color: colors.textPrimary, margin: spacing.md },
          ]}
        />

        {all === null ? (
          <View style={styles.center}>
            <ActivityIndicator />
          </View>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(c) => `${c.source}/${c.id}`}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Text variant="caption" color="disabled" style={styles.empty}>
                {keyword.trim()
                  ? '찾는 루트가 없습니다.'
                  : '검색어를 입력하세요. (루트가 5천 개가 넘어 전체 목록은 보여주지 않습니다)'}
              </Text>
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => onPick(item)}
                style={[styles.row, { borderBottomColor: colors.divider }]}
              >
                <Text variant="body" numberOfLines={1}>
                  {conceptTitle(item)}
                </Text>
                <Text variant="caption" color="textSecondary">
                  {[item.type, conceptDifficulty(item)].filter(Boolean).join(' · ')}
                </Text>
              </Pressable>
            )}
          />
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
  },
  input: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { padding: 16 },
  row: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, rowGap: 2 },
});
