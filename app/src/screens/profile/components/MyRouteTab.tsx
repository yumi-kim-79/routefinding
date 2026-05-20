/**
 * MY ROUTE 탭 — v1 mypage_screen.dart::_buildMyRouteTab 1:1.
 *
 * 쿼리: users/{uid}/my_routes orderBy savedAt desc .snapshots()
 * UI: 상단 검색 TextInput(클라이언트 필터, v1과 동일 동작) + FlatList of MyRouteCard
 * 각 카드는 routeRef(있으면) deref해 현재 mountain/routeName/imageUrl 표시 (N+1, v1 보존).
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
} from '@react-native-firebase/firestore';
import { db } from '../../../services/firebase';
import { COLLECTIONS, SUBCOLLECTIONS } from '../../../constants/firestoreFields';
import { Text } from '../../../components/common/Text';
import { useTheme } from '../../../theme';
import { useMyPage } from '../hooks/useMyPage';
import { MyRouteCard } from './MyRouteCard';
import type { MyRoute } from '../../../types/myRoute';

export const MyRouteTab: React.FC = () => {
  const { colors, spacing, radius } = useTheme();
  const { uid } = useMyPage();

  const [items, setItems] = useState<MyRoute[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    if (!uid) {
      return;
    }
    const q = query(
      collection(doc(db, COLLECTIONS.USERS, uid), SUBCOLLECTIONS.MY_ROUTES),
      orderBy('savedAt', 'desc'),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: MyRoute[] = snap.docs.map((d) => ({
          myRouteId: d.id,
          ...(d.data() as Omit<MyRoute, 'myRouteId'>),
        }));
        setItems(rows);
      },
      (e) => setError(e.message),
    );
    return unsub;
  }, [uid]);

  const lowerKeyword = keyword.trim().toLowerCase();

  return (
    <View style={styles.wrap}>
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
        <TextInput
          value={keyword}
          onChangeText={setKeyword}
          placeholder="MY ROUTE 검색"
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
        />
      </View>

      {error ? (
        <View style={styles.center}>
          <Text variant="caption" color="error">
            오류: {error}
          </Text>
        </View>
      ) : items === null ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Text variant="body" color="textSecondary">
            저장한 루트가 없습니다.
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(r) => r.myRouteId}
          contentContainerStyle={{ padding: spacing.md }}
          renderItem={({ item }) =>
            uid ? (
              <MyRouteCard
                myRoute={item}
                uid={uid}
                searchKeyword={lowerKeyword}
              />
            ) : null
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  search: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
});
