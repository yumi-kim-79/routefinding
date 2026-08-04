/**
 * 마이프로필 탭 — v2 리뉴얼 (2026-08-04).
 *
 * 변경(사용자 결정):
 *   - **등급(level)·포인트(point)·왕관 표시 전부 제거.** 관련 계산(levelCalculator)도 미사용.
 *   - **프로필 사진 변경 추가** (react-native-image-picker → Storage → users/{uid}.photoUrl)
 *   - 한 줄 소개(intro) 편집은 유지
 *   - 닉네임 / 이메일은 읽기 전용 (v1과 동일, 변경 기능 없음)
 *
 * 사진 경로는 웹과 동일: `profile_photos/{uid}.jpg` (services/profilePhoto.ts)
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { Text } from '../../../components/common/Text';
import { Input } from '../../../components/common/Input';
import { Button } from '../../../components/common/Button';
import { Avatar } from '../../../components/common/Avatar';
import { useTheme } from '../../../theme';
import { useAuthStore } from '../../../stores/authStore';
import { useUserStore } from '../../../stores/userStore';
import { useMyPage } from '../hooks/useMyPage';
import { uploadProfilePhoto } from '../../../services/profilePhoto';

export const MyProfileTab: React.FC = () => {
  const { colors, spacing } = useTheme();
  const email = useAuthStore((s) => s.user?.email);
  const { uid, profile, isLoading } = useMyPage();
  const updateProfile = useUserStore((s) => s.updateProfile);

  const [intro, setIntro] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setIntro(profile?.intro ?? '');
  }, [profile]);

  /** 갤러리에서 사진 선택 → Storage 업로드 → users/{uid}.photoUrl 갱신 */
  const onChangePhoto = async () => {
    if (!uid) {
      return;
    }
    const res = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
      // 원본 그대로 올리면 대역폭 낭비가 크다 (2026-08-03 Storage 한도 초과 경험)
      maxWidth: 512,
      maxHeight: 512,
      quality: 0.8,
    });

    if (res.didCancel) {
      return;
    }
    if (res.errorCode) {
      Alert.alert('오류', res.errorMessage ?? '사진을 불러오지 못했습니다.');
      return;
    }
    const localUri = res.assets?.[0]?.uri;
    if (!localUri) {
      return;
    }

    setUploading(true);
    try {
      const url = await uploadProfilePhoto(uid, localUri);
      await updateProfile(uid, { photoUrl: url });
    } catch (e) {
      Alert.alert(
        '오류',
        `사진 업로드 실패: ${e instanceof Error ? e.message : e}`,
      );
    } finally {
      setUploading(false);
    }
  };

  const onSaveIntro = async () => {
    if (!uid) {
      return;
    }
    setSaving(true);
    try {
      await updateProfile(uid, { intro: intro.trim() });
      Alert.alert('알림', '소개글이 저장되었습니다.');
    } catch (e) {
      Alert.alert(
        '오류',
        `소개글 저장 실패: ${e instanceof Error ? e.message : e}`,
      );
    } finally {
      setSaving(false);
    }
  };

  if (isLoading && !profile) {
    return (
      <View style={styles.center}>
        <Text variant="body" color="textSecondary">
          불러오는 중…
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}
    >
      <ScrollView
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}
        keyboardShouldPersistTaps="handled"
      >
        {/* 아바타 + 사진 변경 */}
        <View style={styles.avatarWrap}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="프로필 사진 변경"
            onPress={onChangePhoto}
            disabled={uploading}
          >
            <Avatar
              photoUrl={profile?.photoUrl}
              nickname={profile?.nickname}
              radius={44}
            />
            {uploading ? (
              <View style={[styles.avatarOverlay, { borderRadius: 44 }]}>
                <ActivityIndicator color={colors.onPrimary} />
              </View>
            ) : null}
          </Pressable>

          <Button
            title={uploading ? '업로드 중…' : '사진 변경'}
            variant="ghost"
            size="sm"
            onPress={onChangePhoto}
            loading={uploading}
            disabled={!uid}
            style={styles.photoBtn}
          />
        </View>

        {/* 읽기 전용 */}
        <ReadOnlyField label="닉네임" value={profile?.nickname ?? ''} />
        <ReadOnlyField label="이메일" value={email ?? ''} />

        {/* 한 줄 소개 — 편집 가능 */}
        <View style={styles.fieldWrap}>
          <Text variant="label" color="textSecondary" style={styles.label}>
            한 줄 소개
          </Text>
          <Input
            value={intro}
            onChangeText={setIntro}
            placeholder="나를 간단히 소개해 보세요."
            multiline
          />
          <Button
            title="소개글 저장"
            onPress={onSaveIntro}
            loading={saving}
            disabled={!uid}
          />
        </View>

        <View style={{ height: spacing.md }} />
        <Text variant="caption" color="textSecondary" style={styles.centerText}>
          닉네임·이메일은 변경할 수 없습니다.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const ReadOnlyField: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => {
  const { colors, radius } = useTheme();
  return (
    <View style={styles.fieldWrap}>
      <Text variant="label" color="textSecondary" style={styles.label}>
        {label}
      </Text>
      <View
        style={[
          styles.fieldBox,
          {
            borderColor: colors.border,
            backgroundColor: colors.surfaceVariant,
            borderRadius: radius.md,
          },
        ]}
      >
        <Text variant="body">{value || '-'}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  centerText: { textAlign: 'center' },
  avatarWrap: { alignItems: 'center', marginVertical: 12 },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  photoBtn: { marginTop: 8 },
  fieldWrap: { marginBottom: 16 },
  label: { marginBottom: 6 },
  fieldBox: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 44,
  },
});
