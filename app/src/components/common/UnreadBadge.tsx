/**
 * 읽지 않은 알림 배지 (공용) — v1 mypage_screen.dart의 N+1 FutureBuilder와 동일.
 *
 * 쿼리: `notifications where receiverId==uid AND checked==false AND <field>==value`.
 * field = 'postId' (MyPostsTab) | 'commentId' (MyCommentsTab) — 향후 reportId/crewId 확장 가능.
 *
 * 인덱스 누락 등 에러 시 `console.warn`만 출력하고 배지를 그리지 않는다(앱 안 깸).
 * 큰 결정(인덱스 변경)이 필요해지면 콘솔의 인덱스 생성 URL을 사용자에게 보고.
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  collection,
  getDocs,
  query,
  where,
} from '@react-native-firebase/firestore';
import { db } from '../../services/firebase';
import { COLLECTIONS } from '../../constants/firestoreFields';
import { Text } from './Text';
import { useTheme } from '../../theme';

type LinkField = 'postId' | 'commentId' | 'reportId' | 'crewId';

interface UnreadBadgeProps {
  uid: string;
  field: LinkField;
  value: string;
}

export const UnreadBadge: React.FC<UnreadBadgeProps> = ({
  uid,
  field,
  value,
}) => {
  const { colors } = useTheme();
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const q = query(
          collection(db, COLLECTIONS.NOTIFICATIONS),
          where('receiverId', '==', uid),
          where('checked', '==', false),
          where(field, '==', value),
        );
        const snap = await getDocs(q);
        if (!cancelled) {
          setCount(snap.size);
        }
      } catch (e) {
        // 인덱스 누락 등 — v1 1:1(앱 안 깸). 에러 메시지에 인덱스 생성 URL 포함됨.
        // eslint-disable-next-line no-console
        console.warn(`[UnreadBadge] ${field}=${value} query failed:`, e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, field, value]);

  if (count <= 0) {
    return null;
  }
  return (
    <View style={[styles.badge, { backgroundColor: colors.error }]}>
      <Text variant="caption" style={{ color: colors.onPrimary, fontSize: 10 }}>
        {count > 99 ? '99+' : String(count)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
});
