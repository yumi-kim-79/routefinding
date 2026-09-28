/**
 * 내 제보 관리 탭 — v1 mypage_screen.dart::_buildMyReportsTab 1:1.
 *
 * 쿼리: 두 컬렉션 동시 구독
 *   - 본인:   route_reports / bouldering_reports where authorUid == uid  (**전 상태**)
 *   - 관리자: 위에 더해 **최근 제보 50건** (남의 것 포함)
 *
 * ⚠️ 2026-09-07 정책 변경: 제보가 **승인 없이 바로 게시**된다 (reportService 머리말).
 *    그 전에는 관리자 목록이 `status in ['draft','pending']` 이었고 머지 후
 *    `!== 'approved'` 로 걸렀는데, 이제 그러면 **목록이 통째로 비어** 관리자가
 *    오자료를 찾을 방법이 없어진다.
 *    → 관리자는 `orderBy(timestamp desc) + limit` 으로 **최근 제보**를 보고,
 *      본인은 자기 제보를 상태와 무관하게 전부 본다.
 *    ⚠️ 전체를 구독하면 안 된다 — 승인 문서가 5천 건이 넘는다. 반드시 limit 을 건다.
 *
 * ⚠️ 웹은 `where(status in ...) + orderBy(timestamp)`를 쓰지만 그 조합은 **복합 색인**이 필요하다.
 *    앱은 단일 where만 쓰고 정렬은 클라이언트에서 한다 (conceptService와 같은 방침 —
 *    색인 배포를 기다리지 않아도 되고, 실패 시 조용히 빈 목록이 되는 사고를 막는다).
 * 컬렉션 태그(`Report.collection`)로 삭제 시 안전 분기.
 *
 * 액션 다이얼로그: 삭제=Alert.alert(confirm) / 승인=직접 update / 반려=PromptModal(공용).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ActivityIndicator, Alert, FlatList, StyleSheet, View } from 'react-native';
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from '@react-native-firebase/firestore';
import { db } from '../../../services/firebase';
import { Text } from '../../../components/common/Text';
import { PromptModal } from '../../../components/common/PromptModal';
import { Button } from '../../../components/common/Button';
import { useTheme } from '../../../theme';
import { useAuthStore } from '../../../stores/authStore';
import type { MainStackParamList } from '../../../navigation/types';
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

/** 관리자 목록에 담을 최근 제보 수 (컬렉션당) */
const ADMIN_RECENT_LIMIT = 50;

/**
 * 관리자용: **최근 제보**(작성자 무관, 상태 무관).
 *
 * ⚠️ 제보가 바로 게시되므로 '처리 대기'라는 상태가 사실상 없다.
 *    관리자가 할 일은 **최근에 올라온 것을 훑어보고 이상한 것을 지우는 것**이다.
 * ⚠️ `orderBy` 단독이라 복합 색인이 필요 없다. `where` 를 같이 걸면 색인이 필요해지고,
 *    색인이 없으면 목록이 조용히 빈 화면이 된다 (커뮤니티에서 겪은 것과 같은 함정).
 */
function subscribeAdminReports(
  coll: ReportCollection,
  setItems: (rows: Report[] | null) => void,
  setError: (msg: string | null) => void,
): () => void {
  const q = query(
    collection(db, coll),
    orderBy('timestamp', 'desc'),
    limit(ADMIN_RECENT_LIMIT),
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
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
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
      // ⚠️ 예전엔 여기서 approved 를 걸렀다. 이제 대부분이 approved 라 거르면 빈 목록이 된다
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
          <View>
            {/*
              ⚠️ 루트제보로 들어가는 **주 진입점** (2026-09-07).
                 원래 하단 탭에 '루트제보'가 있었는데 커뮤니티 탭에 자리를 내줬다.
                 이 버튼을 지우면 마이페이지에서 제보할 방법이 사라진다.
                 (다른 경로: 개념도 상세 ▸ '이 구역에 루트 제보' — 등반지·좌표가 자동으로 채워진다)
            */}
            <Button
              title="루트 제보하기"
              onPress={() => navigation.navigate('ReportWrite', undefined)}
              style={{ marginBottom: spacing.md }}
            />
            {photos.length > 0 ? (
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
            ) : null}
          </View>
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
