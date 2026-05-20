/**
 * MY ROUTE 타일 — v1 _myRouteTile + 본문 로직 1:1.
 *
 * 동작:
 *  1) routeRef 있으면 원본 doc(get)로 current(mountain/routeName/imageUrl) 조회 (N+1, v1 보존)
 *  2) routeRef 없음 → 저장 스냅샷(mountain/routeName) 사용, 이미지 없음
 *  3) routeRef 있는데 doc 삭제됨 → "삭제된 루트입니다." 표시
 *  4) searchKeyword 있고 (currentMountain/currentRouteName)에 매칭 안 되면 숨김(null 반환)
 *  5) 삭제: Alert 확인 → users/{uid}/my_routes/{myRouteId}.delete
 *  6) onTap → RouteDetail({ reportId: routeRef.id ?? myRouteId }) (Phase 2-3 placeholder)
 */
import React, { useEffect, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, View } from 'react-native';
import { deleteDoc, doc, getDoc } from '@react-native-firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Text } from '../../../components/common/Text';
import { Button } from '../../../components/common/Button';
import { useTheme } from '../../../theme';
import { db } from '../../../services/firebase';
import { COLLECTIONS, SUBCOLLECTIONS } from '../../../constants/firestoreFields';
import type { MyRoute } from '../../../types/myRoute';
import type { MainStackParamList } from '../../../navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

interface MyRouteCardProps {
  myRoute: MyRoute;
  uid: string;
  searchKeyword: string;
}

type Current =
  | { state: 'loading' }
  | { state: 'snapshot'; mountain: string; routeName: string }
  | {
      state: 'route';
      mountain: string;
      routeName: string;
      imageUrl?: string;
    }
  | { state: 'missing' };

export const MyRouteCard: React.FC<MyRouteCardProps> = ({
  myRoute,
  uid,
  searchKeyword,
}) => {
  const navigation = useNavigation<Nav>();
  const { colors, spacing, radius } = useTheme();

  const [current, setCurrent] = useState<Current>(() =>
    myRoute.routeRef
      ? { state: 'loading' }
      : {
          state: 'snapshot',
          mountain: myRoute.mountain ?? '이름 없음',
          routeName: myRoute.routeName ?? '',
        },
  );

  useEffect(() => {
    if (!myRoute.routeRef) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(myRoute.routeRef!);
        if (cancelled) {
          return;
        }
        if (!snap.exists()) {
          setCurrent({ state: 'missing' });
          return;
        }
        const data = snap.data() as
          | { mountain?: string; routeName?: string; imageUrl?: string }
          | undefined;
        setCurrent({
          state: 'route',
          mountain: data?.mountain ?? '이름 없음',
          routeName: data?.routeName ?? '',
          imageUrl: data?.imageUrl,
        });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[MyRouteCard] routeRef get failed:', e);
        if (!cancelled) {
          setCurrent({ state: 'missing' });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [myRoute.routeRef]);

  // 검색 필터 (v1 1:1: post-deref된 mountain/routeName에 contains 매칭)
  if (current.state !== 'loading' && current.state !== 'missing' && searchKeyword) {
    const m = (current.mountain ?? '').toLowerCase();
    const r = (current.routeName ?? '').toLowerCase();
    if (!m.includes(searchKeyword) && !r.includes(searchKeyword)) {
      return null;
    }
  }

  const onDelete = () => {
    Alert.alert('삭제 확인', '정말 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '확인',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(
              doc(
                db,
                COLLECTIONS.USERS,
                uid,
                SUBCOLLECTIONS.MY_ROUTES,
                myRoute.myRouteId,
              ),
            );
          } catch (e) {
            Alert.alert(
              '오류',
              `삭제 실패: ${e instanceof Error ? e.message : e}`,
            );
          }
        },
      },
    ]);
  };

  const onOpen = () => {
    const reportId = myRoute.routeRef?.id ?? myRoute.myRouteId;
    navigation.navigate('RouteDetail', { reportId });
  };

  let title = '';
  let imageUrl: string | undefined;
  if (current.state === 'loading') {
    title = '불러오는 중…';
  } else if (current.state === 'missing') {
    title = '삭제된 루트입니다.';
  } else {
    title = `${current.mountain} · ${current.routeName}`.replace(/ · $/, '');
    if (current.state === 'route') {
      imageUrl = current.imageUrl;
    }
  }

  return (
    <Pressable
      onPress={current.state === 'missing' ? undefined : onOpen}
      style={({ pressed }) => [
        styles.card,
        {
          borderColor: colors.divider,
          backgroundColor: colors.surface,
          borderRadius: radius.md,
          padding: spacing.md,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.row}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={[styles.thumb, { borderRadius: radius.sm }]}
          />
        ) : (
          <View
            style={[
              styles.thumb,
              styles.thumbEmpty,
              {
                backgroundColor: colors.surfaceVariant,
                borderRadius: radius.sm,
              },
            ]}
          >
            <Text variant="caption" color="disabled">
              사진 없음
            </Text>
          </View>
        )}
        <View style={styles.body}>
          <Text variant="title" numberOfLines={2}>
            {title}
          </Text>
        </View>
        <Button title="삭제" variant="ghost" size="sm" onPress={onDelete} />
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: { borderWidth: 1, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center' },
  thumb: { width: 56, height: 56 },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, marginHorizontal: 12 },
});
