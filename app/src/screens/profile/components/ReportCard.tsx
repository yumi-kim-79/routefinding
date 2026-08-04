/**
 * 제보 카드 — v1 _buildReportCard 1:1 (현 탭은 본인 제보 전용이라 작성자=나).
 *
 * UI: 썸네일(imageUrls[0]) + '산 · 루트명' + 본인 프로필 + 상태 뱃지(+반려사유) + 액션 버튼.
 * 작성자 N+1 제거 가능: 이 탭은 authorUid==uid 필터라 항상 본인 → ProfileHeader의
 *   currentUserProfile 재사용. (v1도 same-uid 분기에선 currentUserProfile 사용)
 * onTap → RouteDetail({ reportId }) push (Phase 2-3까지 placeholder).
 */
import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Text } from '../../../components/common/Text';
import { Avatar } from '../../../components/common/Avatar';
import { useTheme } from '../../../theme';
import { formatDate } from '../../../utils/date';
import { type Report, statusToKorean } from '../../../types/report';
import type { UserProfile } from '../../../types/user';
import type { MainStackParamList } from '../../../navigation/types';
import { ReportActions } from './ReportActions';

type Nav = NativeStackNavigationProp<MainStackParamList>;

interface ReportCardProps {
  report: Report;
  profile: UserProfile | null;
  isMine: boolean;
  isAdmin: boolean;
  onRequestReject: (report: Report) => void;
}

export const ReportCard: React.FC<ReportCardProps> = ({
  report,
  profile,
  isMine,
  isAdmin,
  onRequestReject,
}) => {
  const navigation = useNavigation<Nav>();
  const { colors, spacing, radius } = useTheme();

  const status = report.status ?? 'draft';
  const statusColor = STATUS_COLOR(status, colors);
  const imageUrl = report.imageUrls?.[0];
  const title = `${report.mountain ?? '등반지 없음'} · ${
    report.routeName ?? '이름 없음'
  }`;

  return (
    <Pressable
      onPress={() =>
        navigation.navigate('RouteDetail', { reportId: report.reportId })
      }
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
              { backgroundColor: colors.surfaceVariant, borderRadius: radius.sm },
            ]}
          >
            <Text variant="caption" color="disabled">
              사진 없음
            </Text>
          </View>
        )}

        <View style={styles.body}>
          <Text variant="title" numberOfLines={1}>
            {title}
          </Text>

          <View style={styles.metaRow}>
            <Avatar
              photoUrl={profile?.photoUrl}
              nickname={profile?.nickname}
              radius={12}
            />
            <Text
              variant="caption"
              color="textSecondary"
              style={{ marginLeft: 6 }}
            >
              {(profile?.nickname ?? '') + ' · ' + formatDate(report.timestamp)}
            </Text>
          </View>

          <Text
            variant="label"
            style={{ color: statusColor, marginTop: 6 }}
          >
            상태: {statusToKorean(status)}
          </Text>

          {/*
            반려면 사유 줄을 **항상** 띄운다 (웹 `반려사유: {{ r.rejectionReason || '없음' }}`와 동일).
            예전엔 사유가 있을 때만 그려서, 저장이 안 된 건지 표시가 안 되는 건지 구분할 수 없었다.
          */}
          {status === 'rejected' ? (
            <Text
              variant="caption"
              style={{ color: colors.error, marginTop: 4 }}
              numberOfLines={4}
            >
              반려 사유: {report.rejectionReason || report.rejectReason || '없음'}
            </Text>
          ) : null}
        </View>
      </View>

      <ReportActions
        report={report}
        isMine={isMine}
        isAdmin={isAdmin}
        onRequestReject={onRequestReject}
      />
    </Pressable>
  );
};

/** v1 _statusColor 1:1 → 우리 테마 의미 슬롯 매핑 */
function STATUS_COLOR(
  status: string,
  colors: ReturnType<typeof useTheme>['colors'],
): string {
  switch (status) {
    case 'draft':
      return colors.disabled;
    case 'pending':
      return colors.warning;
    case 'approved':
      return colors.success;
    case 'rejected':
      return colors.error;
    default:
      return colors.textSecondary;
  }
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    marginBottom: 12,
  },
  row: { flexDirection: 'row' },
  thumb: { width: 72, height: 72 },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, marginLeft: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
});
