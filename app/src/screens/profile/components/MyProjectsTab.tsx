/**
 * 프로젝트(도전 중) 탭 — 마이페이지. v2.2.0 신규.
 *
 * ⚠️ 즐겨찾기와 헷갈리면 안 된다. 화면에서 그 차이를 말로 적어 둔다:
 *      즐겨찾기 = 가보고 싶다 / 프로젝트 = 붙었는데 아직 못 깼다
 * ⚠️ 완등을 기록하면 여기서 **자동으로 빠진다** (services/projectService.ts).
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Text } from '../../../components/common/Text';
import { AppIcon } from '../../../components/common/AppIcon';
import { useTheme } from '../../../theme';
import { useAuthStore } from '../../../stores/authStore';
import { addTry, subscribeProjects, type ProjectRow } from '../../../services/projectService';
import type { ConceptSource } from '../../../types/concept';
import type { MainStackParamList } from '../../../navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

export const MyProjectsTab: React.FC = () => {
  const { colors, radius } = useTheme();
  const navigation = useNavigation<Nav>();
  const uid = useAuthStore((s) => s.user?.uid);

  const [list, setList] = useState<ProjectRow[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!uid) {
      setList([]);
      return;
    }
    return subscribeProjects(uid, setList, setError);
  }, [uid]);

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
      data={list}
      keyExtractor={(p) => p.id}
      contentContainerStyle={styles.pad}
      ListHeaderComponent={
        <Text variant="caption" color="textSecondary" style={styles.head}>
          붙었는데 아직 못 깬 루트. 완등을 기록하면 자동으로 빠집니다.
        </Text>
      }
      ListEmptyComponent={
        <Text variant="body" color="textSecondary" style={styles.centerText}>
          도전 중인 루트가 없습니다.{'\n'}개념도에서 '도전 중 담기'를 눌러 보세요.
        </Text>
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() =>
            navigation.navigate('ConceptDetail', {
              conceptId: item.routeId,
              source: item.source as ConceptSource,
            })
          }
          style={[styles.row, { borderBottomColor: colors.divider }]}
        >
          <View style={styles.body}>
            <Text variant="body" numberOfLines={1}>
              {item.routeName || '이름 없음'}
              {item.difficulty ? ` · ${item.difficulty}` : ''}
            </Text>
            <Text variant="caption" color="textSecondary">
              {[item.mountain, item.zone].filter(Boolean).join(' · ')}
              {item.tries > 0 ? ` · ${item.tries}회 붙음` : ''}
            </Text>
          </View>
          <Pressable
            accessibilityLabel="시도 1회 추가"
            onPress={() => {
              if (!uid) {
                return;
              }
              void addTry(uid, item.id).catch((e: unknown) =>
                Alert.alert('실패', e instanceof Error ? e.message : String(e)),
              );
            }}
            hitSlop={8}
            style={[styles.tryBtn, { borderColor: colors.border, borderRadius: radius.full }]}
          >
            <AppIcon name="plus" size={13} color={colors.primary} />
            <Text variant="caption" color="primary">
              붙음
            </Text>
          </Pressable>
        </Pressable>
      )}
    />
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  centerText: { textAlign: 'center', padding: 16 },
  pad: { paddingBottom: 24 },
  head: { padding: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  body: { flex: 1, rowGap: 2 },
  tryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 3,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
});
