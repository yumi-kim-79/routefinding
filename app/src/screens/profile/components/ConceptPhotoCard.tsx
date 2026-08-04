/**
 * 개념도 사진 검토 카드 (제보 관리 상단) — 웹 MyPageView의 사진 승인 UI 대응.
 *
 * 관리자: 승인·추가 / 승인·교체 / 반려
 * 본인  : 승인 전 취소(삭제)
 */
import React from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../../components/common/Text';
import { AppIcon } from '../../../components/common/AppIcon';
import { RemoteImage } from '../../../components/common/RemoteImage';
import { useTheme } from '../../../theme';
import type { ConceptPhoto } from '../../../types/conceptPhoto';
import type { ApplyMode } from '../../../services/conceptPhotoReview';

interface ConceptPhotoCardProps {
  photo: ConceptPhoto;
  isAdmin: boolean;
  isMine: boolean;
  onApprove: (photo: ConceptPhoto, mode: ApplyMode) => void;
  onReject: (photo: ConceptPhoto) => void;
  onDelete: (photo: ConceptPhoto) => void;
  onPreview: (photo: ConceptPhoto) => void;
}

export const ConceptPhotoCard: React.FC<ConceptPhotoCardProps> = ({
  photo,
  isAdmin,
  isMine,
  onApprove,
  onReject,
  onDelete,
  onPreview,
}) => {
  const { colors, radius, spacing } = useTheme();
  // 라인이 구워진 합성본이 있으면 그걸 보여준다 (승인 시 실제로 들어가는 이미지)
  const thumb = photo.flatUrl || photo.imageUrl;
  const rejected = photo.status === 'rejected';

  const confirmApprove = (mode: ApplyMode) => {
    Alert.alert(
      mode === 'replace' ? '기존 사진 교체' : '기존 사진에 추가',
      mode === 'replace'
        ? '개념도의 기존 사진을 모두 지우고 이 사진 하나로 바꿉니다. 계속할까요?'
        : '개념도의 기존 사진에 이 사진을 추가합니다. 계속할까요?',
      [
        { text: '취소', style: 'cancel' },
        { text: '승인', onPress: () => onApprove(photo, mode) },
      ],
    );
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: rejected ? colors.error : colors.divider,
          borderRadius: radius.md,
          padding: spacing.sm,
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="사진 크게 보기"
        onPress={() => onPreview(photo)}
        style={styles.row}
      >
        <RemoteImage
          uri={thumb}
          style={[styles.thumb, { borderRadius: radius.sm }]}
          emptyLabel="사진 없음"
        />

        <View style={styles.body}>
          <Text variant="label" numberOfLines={2}>
            {photo.conceptTitle || '개념도'}
          </Text>
          <Text variant="caption" color="textSecondary" numberOfLines={1}>
            {photo.authorEmail || photo.authorUid}
          </Text>
          <View style={styles.metaRow}>
            <Text variant="caption" color={rejected ? 'error' : 'warning'}>
              {rejected ? '반려됨' : '승인 대기'}
            </Text>
            <Text variant="caption" color="textSecondary">
              선 {photo.lines?.length ?? 0} · 글자 {photo.texts?.length ?? 0}
            </Text>
            {photo.flatUrl ? null : (
              <Text variant="caption" color="textSecondary">
                (라인 없음 — 원본 그대로)
              </Text>
            )}
          </View>
        </View>
      </Pressable>

      <View style={styles.actions}>
        {isAdmin ? (
          <>
            <Pressable
              accessibilityRole="button"
              onPress={() => confirmApprove('add')}
              style={[styles.btn, { borderColor: colors.primary, borderRadius: radius.sm }]}
            >
              <AppIcon name="plus" size={14} color={colors.primary} />
              <Text variant="caption" color="primary">
                승인·추가
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => confirmApprove('replace')}
              style={[styles.btn, { borderColor: colors.primary, borderRadius: radius.sm }]}
            >
              <AppIcon name="check" size={14} color={colors.primary} />
              <Text variant="caption" color="primary">
                승인·교체
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => onReject(photo)}
              style={[styles.btn, { borderColor: colors.error, borderRadius: radius.sm }]}
            >
              <AppIcon name="x" size={14} color={colors.error} />
              <Text variant="caption" color="error">
                반려
              </Text>
            </Pressable>
          </>
        ) : null}

        {isMine ? (
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              Alert.alert('등록 취소', '이 사진 등록을 취소할까요?', [
                { text: '아니요', style: 'cancel' },
                { text: '취소하기', style: 'destructive', onPress: () => onDelete(photo) },
              ])
            }
            style={[styles.btn, { borderColor: colors.border, borderRadius: radius.sm }]}
          >
            <AppIcon name="trash" size={14} color={colors.textSecondary} />
            <Text variant="caption" color="textSecondary">
              등록 취소
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { borderWidth: 1, marginBottom: 10 },
  row: { flexDirection: 'row', columnGap: 10 },
  thumb: { width: 88, height: 88 },
  center: { alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, justifyContent: 'center', rowGap: 2 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, marginTop: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 4,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
});
