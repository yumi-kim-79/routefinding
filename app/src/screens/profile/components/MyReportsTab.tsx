/**
 * 내 제보 관리 탭 — v1 mypage_screen.dart::_buildMyReportsTab 1:1.
 *
 * 쿼리: 두 컬렉션 동시 구독
 *   - route_reports where authorUid==uid
 *   - bouldering_reports where authorUid==uid
 * 머지 후 status != 'approved' 필터 + timestamp desc 정렬 (v1 보존).
 * 컬렉션 태그(`Report.collection`)로 삭제 시 안전 분기.
 *
 * 액션 다이얼로그: 삭제=Alert.alert(confirm) / 승인=직접 update / 반려=PromptModal(공용).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import {
  collection,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from '@react-native-firebase/firestore';
import { db } from '../../../services/firebase';
import { Text } from '../../../components/common/Text';
import { PromptModal } from '../../../components/common/PromptModal';
import { useTheme } from '../../../theme';
import { useAuthStore } from '../../../stores/authStore';
import { useMyPage } from '../hooks/useMyPage';
import { isAdminEmail } from '../../../constants/admin';
import { type Report, type ReportCollection } from '../../../types/report';
import { ReportCard } from './ReportCard';

type Subset = Omit<Report, 'reportId' | 'collection'>;

function subscribeReports(
  coll: ReportCollection,
  uid: string,
  setItems: (rows: Report[] | null) => void,
  setError: (msg: string | null) => void,
): () => void {
  const q = query(
    collection(db, coll),
    where('authorUid', '==', uid),
  );
  return onSnapshot(
    q,
    (snap) => {
      const rows: Report[] = snap.docs.map((d) => ({
        reportId: d.id,
        collection: coll,
        ...(d.data() as Subset),
      }));
      setItems(rows);
    },
    (e) => setError(e.message),
  );
}

export const MyReportsTab: React.FC = () => {
  const { colors, spacing } = useTheme();
  const { uid, profile } = useMyPage();
  const email = useAuthStore((s) => s.user?.email);
  const isAdmin = isAdminEmail(email);

  const [routeRows, setRouteRows] = useState<Report[] | null>(null);
  const [bldRows, setBldRows] = useState<Report[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 반려 사유 모달 상태
  const [rejectTarget, setRejectTarget] = useState<Report | null>(null);

  useEffect(() => {
    if (!uid) {
      return;
    }
    const unsub1 = subscribeReports(
      'route_reports',
      uid,
      setRouteRows,
      setError,
    );
    const unsub2 = subscribeReports(
      'bouldering_reports',
      uid,
      setBldRows,
      setError,
    );
    return () => {
      unsub1();
      unsub2();
    };
  }, [uid]);

  const items = useMemo<Report[] | null>(() => {
    if (routeRows === null || bldRows === null) {
      return null;
    }
    return [...routeRows, ...bldRows]
      .filter((r) => (r.status ?? 'draft') !== 'approved') // v1: approved 제외
      .sort(
        (a, b) =>
          (b.timestamp?.toMillis() ?? 0) - (a.timestamp?.toMillis() ?? 0),
      );
  }, [routeRows, bldRows]);

  const onConfirmReject = async (reason: string) => {
    const target = rejectTarget;
    setRejectTarget(null);
    if (!target) {
      return;
    }
    try {
      // v1: 반려는 route_reports에만 적용
      await updateDoc(doc(db, 'route_reports', target.reportId), {
        status: 'rejected',
        rejectionReason: reason,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : '반려 실패');
    }
  };

  if (error) {
    return (
      <View style={styles.center}>
        <Text variant="caption" color="error">
          에러: {error}
        </Text>
      </View>
    );
  }
  if (items === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <FlatList
        data={items}
        keyExtractor={(r) => `${r.collection}/${r.reportId}`}
        contentContainerStyle={{ padding: spacing.md }}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text variant="body" color="textSecondary">
              관리할 제보가 없습니다.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <ReportCard
            report={item}
            profile={profile}
            isMine={!!uid && item.authorUid === uid}
            isAdmin={isAdmin}
            onRequestReject={(r) => setRejectTarget(r)}
          />
        )}
      />

      <PromptModal
        visible={!!rejectTarget}
        title="반려 사유 입력"
        message="반려 사유를 입력하세요. (route_reports에만 적용됩니다)"
        placeholder="반려 사유를 입력하세요"
        submitLabel="반려"
        multiline
        onSubmit={onConfirmReject}
        onCancel={() => setRejectTarget(null)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
});
