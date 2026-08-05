/**
 * 제보 상세 — 관리자 제보관리/내 제보에서 카드를 눌렀을 때 여는 화면.
 *
 * ⚠️ 왜 만들었나 (2026-08-05):
 *   여기는 `MainNavigator`에 **플레이스홀더**("후속 스프린트 구현 대상")로 등록돼 있었다.
 *   그래서 제보관리에서 카드를 누르면 빈 화면만 떴다. 관리자가 **내용을 못 보고 승인**하는
 *   상태였다는 뜻이다 — 목록 카드에는 썸네일 1장과 산·루트명뿐이라 사진·피치·좌표를
 *   확인할 방법이 없었다.
 *
 * 데이터: 제보 문서 = 승인되면 그대로 개념도가 된다(같은 컬렉션, 같은 필드).
 *   → `Concept` 타입을 그대로 재사용하고, 여기서는 **검토에 필요한 것**을 더 보여준다:
 *     상태·반려 사유·좌표·작성자 + 승인/반려/삭제.
 *
 * 개념도 상세(ConceptDetailScreen)와 나누는 이유:
 *   그쪽은 "등반하러 온 사람"이 보는 화면(즐겨찾기·등반일지·사진 등록)이고,
 *   이쪽은 "검토하는 사람"이 보는 화면이다. 한 화면에 섞으면 둘 다 산만해진다.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { deleteDoc, doc, getDoc, updateDoc } from '@react-native-firebase/firestore';
import { db } from '../../services/firebase';
import { clearConceptCache } from '../../services/conceptService';
import { Text } from '../../components/common/Text';
import { Button } from '../../components/common/Button';
import { RemoteImage } from '../../components/common/RemoteImage';
import { PromptModal } from '../../components/common/PromptModal';
import { ConceptImageViewer } from '../route/components/ConceptImageViewer';
import { ApproachMapModal } from '../route/components/ApproachMapModal';
import { useTheme } from '../../theme';
import { formatDate } from '../../utils/date';
import { useAuthStore } from '../../stores/authStore';
import { isAdminEmail } from '../../constants/admin';
import {
  conceptImages,
  conceptTitle,
  type Concept,
  type ConceptSource,
  type ConceptType,
} from '../../types/concept';
import { statusToKorean, type ReportStatus } from '../../types/report';
import type { MainStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList, 'RouteDetail'>;
type Rt = RouteProp<MainStackParamList, 'RouteDetail'>;

/** 문서에서 함께 읽는 검토용 필드 (Concept에는 없는 것들) */
interface ReviewFields {
  status?: ReportStatus;
  rejectionReason?: string;
  rejectReason?: string;
  authorUid?: string;
}

type LoadState =
  | { state: 'loading' }
  | { state: 'ready'; concept: Concept; review: ReviewFields }
  | { state: 'missing' }
  | { state: 'error'; message: string };

const InfoRow: React.FC<{ label: string; value?: string | number }> = ({
  label,
  value,
}) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return (
    <View style={styles.infoRow}>
      <Text variant="label" color="textSecondary" style={styles.infoLabel}>
        {label}
      </Text>
      <Text variant="body" style={styles.infoValue}>
        {String(value)}
      </Text>
    </View>
  );
};

export const ReportDetailScreen: React.FC = () => {
  const { colors, radius, spacing } = useTheme();
  const { width } = useWindowDimensions();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();

  const authUser = useAuthStore((s) => s.user);
  const isAdmin = isAdminEmail(authUser?.email);

  const [load, setLoad] = useState<LoadState>({ state: 'loading' });
  const [viewer, setViewer] = useState<{ open: boolean; index: number }>({
    open: false,
    index: 0,
  });
  const [approachOpen, setApproachOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // 목록에서 넘어오면 컬렉션을 알려준다. 모를 때만 두 곳을 순서대로 시도한다
      // (같은 id가 두 컬렉션에 있을 일은 없지만, 없는 쪽을 먼저 읽어도 손해가 없다)
      const candidates: ConceptSource[] = params.collection
        ? [params.collection]
        : ['route_reports', 'bouldering_reports'];

      let lastError: string | null = null;
      for (const source of candidates) {
        try {
          const snap = await getDoc(doc(db, source, params.reportId));
          if (cancelled) {
            return;
          }
          if (snap.exists()) {
            const data = (snap.data() ?? {}) as Record<string, unknown>;
            const typeRoot = data.typeRoot;
            const type: ConceptType =
              typeRoot === '리드' || typeRoot === '볼더링'
                ? typeRoot
                : source === 'route_reports'
                  ? '리드'
                  : '볼더링';
            setLoad({
              state: 'ready',
              concept: {
                ...(data as Omit<Concept, 'id' | 'source' | 'type'>),
                id: snap.id,
                source,
                type,
              },
              review: data as ReviewFields,
            });
            return;
          }
        } catch (e) {
          lastError = e instanceof Error ? e.message : String(e);
        }
      }
      if (!cancelled) {
        setLoad(
          lastError ? { state: 'error', message: lastError } : { state: 'missing' },
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.reportId, params.collection]);

  useEffect(() => {
    navigation.setOptions({
      title: load.state === 'ready' ? conceptTitle(load.concept) : '제보 상세',
    });
  }, [navigation, load]);

  /** 승인/반려/삭제는 모두 처리 후 목록으로 돌아간다 (구독이 목록을 알아서 갱신한다) */
  const finish = useCallback(() => {
    clearConceptCache();
    navigation.goBack();
  }, [navigation]);

  const onApprove = useCallback(() => {
    if (load.state !== 'ready') {
      return;
    }
    const { concept } = load;
    Alert.alert('제보 승인', '승인하면 개념도와 지도에 바로 표시됩니다.', [
      { text: '취소', style: 'cancel' },
      {
        text: '승인',
        onPress: async () => {
          setBusy(true);
          try {
            // ⚠️ 컬렉션을 하드코딩하면 볼더링 제보를 승인할 때 엉뚱한 문서를 건드린다
            await updateDoc(doc(db, concept.source, concept.id), {
              status: 'approved',
            });
            finish();
          } catch (e) {
            Alert.alert('승인 실패', e instanceof Error ? e.message : String(e));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }, [load, finish]);

  const onReject = useCallback(
    async (reason: string) => {
      setRejectOpen(false);
      if (load.state !== 'ready') {
        return;
      }
      const { concept } = load;
      setBusy(true);
      try {
        await updateDoc(doc(db, concept.source, concept.id), {
          status: 'rejected',
          rejectionReason: reason,
        });
        finish();
      } catch (e) {
        Alert.alert('반려 실패', e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [load, finish],
  );

  const onDelete = useCallback(() => {
    if (load.state !== 'ready') {
      return;
    }
    const { concept } = load;
    Alert.alert('제보 삭제', '되돌릴 수 없습니다. 정말 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await deleteDoc(doc(db, concept.source, concept.id));
            finish();
          } catch (e) {
            Alert.alert('삭제 실패', e instanceof Error ? e.message : String(e));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }, [load, finish]);

  if (load.state === 'loading') {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (load.state !== 'ready') {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text variant="body" color="textSecondary" style={styles.centerText}>
          {load.state === 'missing'
            ? '제보를 찾을 수 없습니다. (이미 삭제되었을 수 있습니다)'
            : `불러오지 못했습니다.\n${load.message}`}
        </Text>
      </View>
    );
  }

  const c = load.concept;
  const r = load.review;
  const status: ReportStatus = r.status ?? 'draft';
  const images = conceptImages(c);
  const imageWidth = width - spacing.md * 2;
  const isMine = !!authUser?.uid && r.authorUid === authUser.uid;
  const canReview = isAdmin && (status === 'pending' || status === 'draft');
  const canDelete = isAdmin || isMine;
  const hasApproach = !!c.gpxUrl || (c.trackingPath?.length ?? 0) > 0;

  const statusColor =
    status === 'approved'
      ? colors.success
      : status === 'rejected'
        ? colors.error
        : status === 'pending'
          ? colors.warning
          : colors.disabled;

  // Number('')는 0이라 그냥 쓰면 좌표 없는 제보가 (0,0)에 찍힌다
  const latNum = Number(c.latitude);
  const lngNum = Number(c.longitude);
  const hasCoord =
    c.latitude !== undefined &&
    c.longitude !== undefined &&
    String(c.latitude).trim() !== '' &&
    String(c.longitude).trim() !== '' &&
    Number.isFinite(latNum) &&
    Number.isFinite(lngNum) &&
    (latNum !== 0 || lngNum !== 0);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl }}
    >
      {/* 상태 — 검토 화면이므로 맨 위에 둔다 */}
      <View
        style={[
          styles.statusBar,
          { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md },
        ]}
      >
        <Text variant="label" style={{ color: statusColor }}>
          {statusToKorean(status)}
        </Text>
        <Text variant="caption" color="textSecondary">
          {formatDate(c.timestamp)}
        </Text>
      </View>

      {status === 'rejected' ? (
        <Text variant="caption" style={{ color: colors.error, marginTop: 6 }}>
          반려 사유: {r.rejectionReason || r.rejectReason || '없음'}
        </Text>
      ) : null}

      <Text variant="headline" style={styles.title}>
        {conceptTitle(c)}
      </Text>
      {c.overview ? (
        <Text variant="body" color="textSecondary" style={styles.overview}>
          {c.overview}
        </Text>
      ) : null}

      {/* 사진 — 승인 전에 반드시 봐야 하는 부분이라 크게 띄우고 확대까지 된다 */}
      {images.length > 0 ? (
        <>
          <ScrollView
            horizontal
            pagingEnabled={images.length > 1}
            showsHorizontalScrollIndicator={false}
            style={styles.carousel}
          >
            {images.map((uri, i) => (
              <Pressable
                key={`${i}-${uri}`}
                accessibilityRole="imagebutton"
                onPress={() => setViewer({ open: true, index: i })}
                style={{
                  width: imageWidth,
                  marginRight: i === images.length - 1 ? 0 : spacing.sm,
                }}
              >
                <RemoteImage
                  uri={uri}
                  style={[
                    styles.mainImage,
                    {
                      width: imageWidth,
                      borderRadius: radius.md,
                      backgroundColor: colors.surfaceVariant,
                    },
                  ]}
                  resizeMode="cover"
                />
              </Pressable>
            ))}
          </ScrollView>
          <Text variant="caption" color="textSecondary">
            사진을 누르면 크게 볼 수 있습니다{images.length > 1 ? ` · ${images.length}장` : ''}
          </Text>
        </>
      ) : (
        <View
          style={[
            styles.noImage,
            { backgroundColor: colors.surfaceVariant, borderRadius: radius.md },
          ]}
        >
          <Text variant="body" color="disabled">
            첨부된 사진이 없습니다
          </Text>
        </View>
      )}

      {/* 기본 정보 */}
      <View style={[styles.section, { borderTopColor: colors.divider }]}>
        <Text variant="title" style={styles.sectionTitle}>
          제보 내용
        </Text>
        <InfoRow label="구분" value={c.type} />
        <InfoRow label="등반지" value={c.mountain} />
        <InfoRow label="구역" value={c.zone} />
        <InfoRow label="루트명" value={c.routeName} />
        <InfoRow label="등반 형태" value={c.climbType} />
        <InfoRow label="난이도" value={c.difficulty} />
        <InfoRow label="평균 난이도" value={c.avgDifficulty} />
        <InfoRow label="길이" value={typeof c.length === 'number' ? `${c.length}m` : undefined} />
        <InfoRow label="개척자" value={c.pioneer} />
        <InfoRow label="장비" value={c.equipment} />
        <InfoRow label="찾아가는 길" value={c.directions} />
        <InfoRow label="번호" value={c.no} />
        <InfoRow
          label="좌표"
          value={hasCoord ? `${latNum.toFixed(6)}, ${lngNum.toFixed(6)}` : '미입력'}
        />
        <InfoRow label="작성자" value={c.writer ?? c.nickname ?? r.authorUid} />
      </View>

      {/* 접근로 */}
      {hasApproach ? (
        <View style={[styles.section, { borderTopColor: colors.divider }]}>
          <Text variant="title" style={styles.sectionTitle}>
            접근로
          </Text>
          <Button
            title={c.gpxUrl ? '접근로 보기 (GPX)' : '접근로 보기 (옛 기록)'}
            variant="secondary"
            onPress={() => setApproachOpen(true)}
          />
        </View>
      ) : null}

      {/* 피치 */}
      {c.pitches && c.pitches.length > 0 ? (
        <View style={[styles.section, { borderTopColor: colors.divider }]}>
          <Text variant="title" style={styles.sectionTitle}>
            피치 ({c.pitches.length})
          </Text>
          {c.pitches.map((p, i) => {
            const thumb = p.imageUrls?.[0];
            const meta = [
              typeof p.length === 'number' || typeof p.length === 'string'
                ? `${p.length}m`
                : null,
              p.style,
              p.difficulty,
              p.gear,
            ]
              .filter(Boolean)
              .join(' · ');
            return (
              <View key={`pitch-${i}`} style={styles.pitchRow}>
                {thumb ? (
                  <Pressable
                    accessibilityRole="imagebutton"
                    onPress={() => {
                      const idx = images.indexOf(thumb);
                      setViewer({ open: true, index: idx >= 0 ? idx : 0 });
                    }}
                  >
                    <RemoteImage uri={thumb} style={[styles.pitchThumb, { borderRadius: radius.sm }]} />
                  </Pressable>
                ) : (
                  <View
                    style={[
                      styles.pitchThumb,
                      styles.pitchThumbEmpty,
                      { backgroundColor: colors.surfaceVariant, borderRadius: radius.sm },
                    ]}
                  >
                    <Text variant="caption" color="disabled">
                      없음
                    </Text>
                  </View>
                )}
                <View style={styles.pitchBody}>
                  <Text variant="body">{p.name || `${i + 1}피치`}</Text>
                  {meta ? (
                    <Text variant="caption" color="textSecondary">
                      {meta}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      {/* 검토 액션 — 내용을 다 본 다음에 누르도록 맨 아래에 둔다 */}
      {canReview || canDelete ? (
        <View style={[styles.section, { borderTopColor: colors.divider }]}>
          <Text variant="title" style={styles.sectionTitle}>
            {canReview ? '검토' : '관리'}
          </Text>
          {canReview ? (
            <>
              <Button title="승인" onPress={onApprove} disabled={busy} />
              <Button
                title="반려"
                variant="secondary"
                onPress={() => setRejectOpen(true)}
                disabled={busy}
                style={styles.actionGap}
              />
            </>
          ) : null}
          {canDelete ? (
            <Button
              title="삭제"
              variant="ghost"
              onPress={onDelete}
              disabled={busy}
              style={styles.actionGap}
            />
          ) : null}
        </View>
      ) : null}

      <ConceptImageViewer
        visible={viewer.open}
        images={images}
        initialIndex={viewer.index}
        onClose={() => setViewer((v) => ({ ...v, open: false }))}
      />

      <ApproachMapModal
        visible={approachOpen}
        gpxUrl={c.gpxUrl}
        fallbackPath={c.trackingPath}
        routeCoord={hasCoord ? { latitude: latNum, longitude: lngNum } : null}
        title={conceptTitle(c)}
        onClose={() => setApproachOpen(false)}
      />

      <PromptModal
        visible={rejectOpen}
        title="반려 사유 입력"
        message="반려 사유를 입력하세요. 제보한 사람에게 표시됩니다."
        placeholder="반려 사유를 입력하세요"
        submitLabel="반려"
        multiline
        onSubmit={onReject}
        onCancel={() => setRejectOpen(false)}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  centerText: { textAlign: 'center' },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { marginTop: 12 },
  overview: { marginTop: 4 },
  carousel: { marginTop: 12, marginBottom: 6 },
  mainImage: { height: 220 },
  noImage: {
    height: 160,
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: { marginTop: 20, paddingTop: 16, borderTopWidth: 1 },
  sectionTitle: { marginBottom: 8 },
  infoRow: { flexDirection: 'row', paddingVertical: 4 },
  infoLabel: { width: 96 },
  infoValue: { flex: 1 },
  actionGap: { marginTop: 8 },
  pitchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  pitchThumb: { width: 72, height: 56 },
  pitchThumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  pitchBody: { flex: 1, marginLeft: 12 },
});
