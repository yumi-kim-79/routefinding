/**
 * 개념도 상세에 등록된 사진 + 라인 오버레이 (웹 ConceptDetailView의 사진 목록 대응).
 *
 * · 승인된 사진은 모두, 승인 대기는 **올린 본인과 관리자만** 보인다 (규칙과 동일)
 * · 관리자는 여기서 바로 승인·추가 / 승인·교체 / 반려할 수 있다
 * · 오버레이는 저장된 0~1 정규화 좌표로 그린다 — 사진 크기와 무관하게 정확히 겹친다
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Text } from '../../../components/common/Text';
import { AppIcon } from '../../../components/common/AppIcon';
import { RemoteImage } from '../../../components/common/RemoteImage';
import { ConceptPhotoOverlay } from '../../../components/common/ConceptPhotoOverlay';
import { useTheme } from '../../../theme';
import { useAuthStore } from '../../../stores/authStore';
import { isAdminEmail } from '../../../constants/admin';
import type { ConceptPhoto } from '../../../types/conceptPhoto';
import {
  approveConceptPhoto,
  deleteConceptPhoto,
  subscribeConceptPhotosFor,
  type ApplyMode,
} from '../../../services/conceptPhotoReview';

interface ConceptPhotoStripProps {
  conceptId: string;
  /** 사진을 크게 볼 때 (전체화면 뷰어로 연결) */
  onPreview?: (url: string) => void;
}

export const ConceptPhotoStrip: React.FC<ConceptPhotoStripProps> = ({ conceptId, onPreview }) => {
  const { colors, radius, spacing } = useTheme();
  const uid = useAuthStore((s) => s.user?.uid);
  const isAdmin = isAdminEmail(useAuthStore((s) => s.user?.email));
  const [photos, setPhotos] = useState<ConceptPhoto[]>([]);
  const [box, setBox] = useState({ w: 1, h: 1 });

  useEffect(() => {
    if (!uid) {
      return;
    }
    return subscribeConceptPhotosFor(conceptId, uid, isAdmin, setPhotos, (msg) =>
      // 실패해도 상세 화면 나머지는 그대로 보여준다
      // eslint-disable-next-line no-console
      console.warn('[concept_photos] 상세 구독 실패:', msg),
    );
  }, [conceptId, isAdmin, uid]);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout;
    // 개념도 사진은 대체로 세로가 길다 — 4:3으로 잡고 오버레이도 같은 비율로 그린다
    setBox({ w: Math.max(1, width), h: Math.max(1, (width * 3) / 4) });
  }, []);

  const approve = (photo: ConceptPhoto, mode: ApplyMode) => {
    if (!uid) {
      return;
    }
    Alert.alert(
      mode === 'replace' ? '기존 사진 교체' : '기존 사진에 추가',
      mode === 'replace'
        ? '개념도의 기존 사진을 모두 지우고 이 사진 하나로 바꿉니다.'
        : '개념도의 기존 사진에 이 사진을 추가합니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '승인',
          onPress: () => {
            void approveConceptPhoto(photo, mode, uid).catch((e: unknown) =>
              Alert.alert('승인 실패', e instanceof Error ? e.message : String(e)),
            );
          },
        },
      ],
    );
  };

  if (photos.length === 0) {
    return null;
  }

  return (
    <View style={{ marginTop: spacing.md }}>
      <Text variant="title">등록된 사진 ({photos.length})</Text>

      {photos.map((p) => {
        const pending = p.status === 'pending';
        const mine = !!uid && p.authorUid === uid;
        return (
          <View key={p.id} style={{ marginTop: spacing.sm }}>
            <Pressable
              accessibilityRole="imagebutton"
              onPress={() => onPreview?.(p.flatUrl || p.imageUrl)}
              onLayout={onLayout}
              style={[styles.stage, { borderRadius: radius.md, height: box.h }]}
            >
              <RemoteImage uri={p.imageUrl} style={StyleSheet.absoluteFill} resizeMode="contain" />
              {/* 좌표로 저장된 선/글자를 원본 위에 겹쳐 그린다 (합성본이 아니라 원본 + 오버레이) */}
              <ConceptPhotoOverlay
                lines={p.lines ?? []}
                texts={p.texts ?? []}
                width={box.w}
                height={box.h}
              />
            </Pressable>

            <View style={styles.metaRow}>
              {pending ? (
                <Text variant="caption" color="warning">
                  승인 대기 {mine && !isAdmin ? '(본인에게만 보입니다)' : ''}
                </Text>
              ) : p.status === 'rejected' ? (
                <Text variant="caption" color="error">
                  반려됨 · 사유: {p.rejectionReason || '없음'}
                </Text>
              ) : (
                <Text variant="caption" color="textSecondary">
                  승인됨
                </Text>
              )}
              <Text variant="caption" color="textSecondary">
                선 {p.lines?.length ?? 0} · 글자 {p.texts?.length ?? 0}
              </Text>
            </View>

            {isAdmin && pending ? (
              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => approve(p, 'add')}
                  style={[styles.btn, { borderColor: colors.primary, borderRadius: radius.sm }]}
                >
                  <AppIcon name="plus" size={14} color={colors.primary} />
                  <Text variant="caption" color="primary">
                    승인·추가
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => approve(p, 'replace')}
                  style={[styles.btn, { borderColor: colors.primary, borderRadius: radius.sm }]}
                >
                  <AppIcon name="check" size={14} color={colors.primary} />
                  <Text variant="caption" color="primary">
                    승인·교체
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {mine && pending ? (
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  Alert.alert('등록 취소', '이 사진 등록을 취소할까요?', [
                    { text: '아니요', style: 'cancel' },
                    {
                      text: '취소하기',
                      style: 'destructive',
                      onPress: () => {
                        void deleteConceptPhoto(p).catch((e: unknown) =>
                          Alert.alert('삭제 실패', e instanceof Error ? e.message : String(e)),
                        );
                      },
                    },
                  ])
                }
                style={[styles.btn, styles.selfStart, { borderColor: colors.border, borderRadius: radius.sm }]}
              >
                <AppIcon name="trash" size={14} color={colors.textSecondary} />
                <Text variant="caption" color="textSecondary">
                  등록 취소
                </Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  stage: { width: '100%', backgroundColor: '#111', overflow: 'hidden' },
  metaRow: { flexDirection: 'row', columnGap: 10, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 6, marginTop: 6 },
  selfStart: { alignSelf: 'flex-start', marginTop: 6 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 4,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
});
