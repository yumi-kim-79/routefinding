/**
 * 내 제보 관리 탭 — v1 mypage_screen.dart::_buildMyReportsTab 1:1.
 *
 * 쿼리: 두 컬렉션 동시 구독
 *   - 본인:   route_reports / bouldering_reports where authorUid == uid
 *   - 관리자: 위에 더해 where status in ['draft','pending','rejected'] (남의 제보까지)
 * 머지 후 status != 'approved' 필터 + timestamp desc 정렬 (v1 보존).
 *
 * ⚠️ 웹은 `where(status in ...) + orderBy(timestamp)`를 쓰지만 그 조합은 **복합 색인**이 필요하다.
 *    앱은 단일 where만 쓰고 정렬은 클라이언트에서 한다 (conceptService와 같은 방침 —
 *    색인 배포를 기다리지 않아도 되고, 실패 시 조용히 빈 목록이 되는 사고를 막는다).
 * 컬렉션 태그(`Report.collection`)로 삭제 시 안전 분기.
 *
 * 액션 다이얼로그: 삭제=Alert.alert(confirm) / 승인=직접 update / 반려=PromptModal(공용).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, View } from 'react-native';
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
import { ConceptPhotoCard } from './ConceptPhotoCard';
import { ConceptImageViewer } from '../../route/components/ConceptImageViewer';
import type { ConceptPhoto } from '../../../types/conceptPhoto';
import {
  approveConceptPhoto,
  deleteConceptPhoto,
  rejectConceptPhoto,
  subscribeConceptPhotos,
  type ApplyMode,
} from '../../../services/conceptPhotoReview';

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

/**
 * 관리자용: **아직 처리하지 않은** 제보만 (작성자 무관).
 *
 * 승인·반려하면 status가 바뀌어 이 쿼리에서 빠지므로 **목록에서 자동으로 사라진다**
 * (사용자 요청 2026-08-05 — 처리한 건이 계속 쌓여 보이던 문제).
 * 반려된 건은 **올린 사람 본인**의 구독에는 계속 잡혀 사유를 확인할 수 있다.
 */
function subscribeAdminReports(
  coll: ReportCollection,
  setItems: (rows: Report[] | null) => void,
  setError: (msg: string | null) => void,
): () => void {
  const q = query(
    collection(db, coll),
    where('status', 'in', ['draft', 'pending']),
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
  /** 관리자일 때만 채워진다 (남의 제보 포함) */
  const [adminRouteRows, setAdminRouteRows] = useState<Report[] | null>(null);
  const [adminBldRows, setAdminBldRows] = useState<Report[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 반려 사유 모달 상태
  const [rejectTarget, setRejectTarget] = useState<Report | null>(null);

  /**
   * 개념도 사진(concept_photos) 검토 목록.
   * 별도 컬렉션이라 route_reports 구독에는 잡히지 않는다 —
   * 앱에서 등록한 사진이 제보 관리에 안 보이던 원인 (2026-08-04 수정).
   */
  const [photos, setPhotos] = useState<ConceptPhoto[]>([]);
  const [photoRejectTarget, setPhotoRejectTarget] = useState<ConceptPhoto | null>(null);
  /** 사진 크게 보기 (핀치 줌 되는 공용 뷰어 재사용) */
  const [previewPhoto, setPreviewPhoto] = useState<ConceptPhoto | null>(null);

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
    const adminUnsubs: Array<() => void> = [];
    if (isAdmin) {
      adminUnsubs.push(
        subscribeAdminReports('route_reports', setAdminRouteRows, setError),
        subscribeAdminReports('bouldering_reports', setAdminBldRows, setError),
      );
    } else {
      setAdminRouteRows(null);
      setAdminBldRows(null);
    }

    const unsub3 = subscribeConceptPhotos(uid, isAdmin, setPhotos, (msg) =>
      // 사진 구독이 실패해도 제보 목록은 계속 보여준다 (부분 실패 허용)
      // eslint-disable-next-line no-console
      console.warn('[concept_photos] 구독 실패:', msg),
    );
    return () => {
      unsub1();
      unsub2();
      unsub3();
      adminUnsubs.forEach((u) => u());
    };
  }, [uid, isAdmin]);

  const items = useMemo<Report[] | null>(() => {
    if (routeRows === null || bldRows === null) {
      return null;
    }
    // 같은 문서가 '본인 것'과 '관리자 전체'에 동시에 잡히므로 컬렉션/id로 중복을 없앤다
    const map = new Map<string, Report>();
    [
      ...(adminRouteRows ?? []),
      ...(adminBldRows ?? []),
      ...routeRows,
      ...bldRows,
    ].forEach((r) => map.set(`${r.collection}/${r.reportId}`, r));

    return Array.from(map.values())
      .filter((r) => (r.status ?? 'draft') !== 'approved') // v1: approved 제외
      .sort(
        (a, b) =>
          (b.timestamp?.toMillis() ?? 0) - (a.timestamp?.toMillis() ?? 0),
      );
  }, [routeRows, bldRows, adminRouteRows, adminBldRows]);

  const onApprovePhoto = (photo: ConceptPhoto, mode: ApplyMode) => {
    if (!uid) {
      return;
    }
    void approveConceptPhoto(photo, mode, uid).catch((e: unknown) =>
      Alert.alert('사진 승인 실패', e instanceof Error ? e.message : String(e)),
    );
  };

  const onDeletePhoto = (photo: ConceptPhoto) => {
    void deleteConceptPhoto(photo).catch((e: unknown) =>
      Alert.alert('사진 삭제 실패', e instanceof Error ? e.message : String(e)),
    );
  };

  const onConfirmPhotoReject = (reason: string) => {
    const target = photoRejectTarget;
    setPhotoRejectTarget(null);
    if (!target || !uid) {
      return;
    }
    void rejectConceptPhoto(target, reason, uid).catch((e: unknown) =>
      Alert.alert('사진 반려 실패', e instanceof Error ? e.message : String(e)),
    );
  };

  const onConfirmReject = async (reason: string) => {
    const target = rejectTarget;
    setRejectTarget(null);
    if (!target) {
      return;
    }
    try {
      // ⚠️ 예전엔 route_reports로 하드코딩돼 있었다(v1 동작 보존).
      //    관리자가 볼더링 제보까지 보게 되면서(2026-08-05) 그대로 두면
      //    **엉뚱한 컬렉션의 같은 id 문서를 반려**하게 된다 → 카드가 알려준 컬렉션을 쓴다.
      await updateDoc(doc(db, target.collection, target.reportId), {
        status: 'rejected',
        rejectionReason: reason,
      });
    } catch (e) {
      // 화면 전체를 에러로 덮지 않고 알림으로 알린다 (목록은 계속 보여야 한다)
      Alert.alert('반려 실패', e instanceof Error ? e.message : String(e));
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
        ListHeaderComponent={
          photos.length > 0 ? (
            <View style={{ marginBottom: spacing.md }}>
              <Text variant="title" style={{ marginBottom: spacing.sm }}>
                개념도 사진 {isAdmin ? '승인 대기' : '등록 현황'} ({photos.length})
              </Text>
              {photos.map((p) => (
                <ConceptPhotoCard
                  key={p.id}
                  photo={p}
                  isAdmin={isAdmin}
                  isMine={!!uid && p.authorUid === uid}
                  onApprove={onApprovePhoto}
                  onReject={setPhotoRejectTarget}
                  onDelete={onDeletePhoto}
                  onPreview={setPreviewPhoto}
                />
              ))}
            </View>
          ) : null
        }
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

      <ConceptImageViewer
        visible={previewPhoto !== null}
        images={
          previewPhoto ? [previewPhoto.flatUrl || previewPhoto.imageUrl].filter(Boolean) : []
        }
        onClose={() => setPreviewPhoto(null)}
      />

      <PromptModal
        visible={!!photoRejectTarget}
        title="사진 반려 사유"
        message="반려 사유를 입력하세요. 등록한 사람에게 표시됩니다."
        placeholder="반려 사유를 입력하세요"
        submitLabel="반려"
        multiline
        onSubmit={onConfirmPhotoReject}
        onCancel={() => setPhotoRejectTarget(null)}
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
