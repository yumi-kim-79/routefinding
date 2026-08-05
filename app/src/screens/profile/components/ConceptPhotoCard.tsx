/**
 * 개념도 사진 검토 카드 (제보 관리 상단) — 웹 MyPageView의 사진 승인 UI 대응.
 *
 * 관리자: 승인 / 반려 / 삭제 — **버튼은 이 셋뿐이다** (사용자 결정 2026-08-05).
 * 본인  : 승인 전 취소(삭제)
 *
 * ⚠️ 예전엔 '승인·추가'와 '승인·교체' 두 개였다. 교체는 **개념도의 기존 사진을 전부 지우고**
 *    이 사진 하나만 남기는 동작이라, 버튼 두 개가 나란히 있으면 잘못 누르기 쉬웠다.
 *    승인은 항상 **추가**(`'add'`)로 동작한다 — 되돌릴 수 있는 쪽이다.
 *    사진을 정리해야 하면 개념도 수정 화면에서 지운다.
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

  const confirmApprove = () => {
    Alert.alert(
      '사진 승인',
      '개념도에 이 사진을 추가합니다. 계속할까요?',
      [
        { text: '취소', style: 'cancel' },
        // 'add' 고정 — 기존 사진을 지우는 'replace'는 실수 위험이 커서 버튼에서 뺐다
        { text: '승인', onPress: () => onApprove(photo, 'add') },
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

          {rejected ? (
            <Text variant="caption" color="error" numberOfLines={3}>
              반려 사유: {photo.rejectionReason || '없음'}
            </Text>
          ) : null}
        </View>
      </Pressable>

      <View style={styles.actions}>
        {isAdmin ? (
          <>
            <Pressable
              accessibilityRole="button"
              onPress={confirmApprove}
              style={[styles.btn, { borderColor: colors.primary, borderRadius: radius.sm }]}
            >
              <AppIcon name="check" size={14} color={colors.primary} />
              <Text variant="caption" color="primary">
                승인
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

        {/* 관리자는 승인·반려와 별개로 삭제할 수 있어야 한다 (스팸·중복 정리) */}
        {isMine || isAdmin ? (
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              Alert.alert(isMine ? '등록 취소' : '사진 삭제', '이 사진 등록을 삭제할까요?', [
                { text: '아니요', style: 'cancel' },
                { text: '취소하기', style: 'destructive', onPress: () => onDelete(photo) },
              ])
            }
            style={[styles.btn, { borderColor: colors.border, borderRadius: radius.sm }]}
          >
            <AppIcon name="trash" size={14} color={colors.textSecondary} />
            <Text variant="caption" color="textSecondary">
              {isMine ? '등록 취소' : '삭제'}
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
