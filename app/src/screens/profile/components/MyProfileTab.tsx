/**
 * 마이프로필 탭 — v1 `widgets/my_profile_tab.dart` 1:1.
 *
 * v1 실측 편집 가능 필드:
 *   - 한 줄 소개(intro): TextInput + "소개글 저장" → users/{uid}.update({intro})
 *   - 프로필 사진: image-picker + Storage 업로드 → [F]에서 추가 (현재는 read-only avatar)
 *
 * 읽기 전용:
 *   - 닉네임 / 이메일 / 등급(+다음 등급까지 남은 점수, getRemainToNextLevel) / 포인트
 *
 * 닉네임·등급 변경은 v1에 없음 → v2.1+(MVP 제외, CLAUDE.md 1:1 보존).
 */
import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '../../../components/common/Text';
import { Input } from '../../../components/common/Input';
import { Button } from '../../../components/common/Button';
import { ProfileWithCrown } from '../../../components/common/ProfileWithCrown';
import { useTheme } from '../../../theme';
import { useAuthStore } from '../../../stores/authStore';
import { useUserStore } from '../../../stores/userStore';
import { useMyPage } from '../hooks/useMyPage';
import {
  getNextLevel,
  getRemainToNextLevel,
} from '../../../utils/levelCalculator';

export const MyProfileTab: React.FC = () => {
  const { colors, spacing, radius } = useTheme();
  const email = useAuthStore((s) => s.user?.email);
  const { uid, profile, isLoading } = useMyPage();
  const updateProfile = useUserStore((s) => s.updateProfile);

  const [intro, setIntro] = useState('');
  const [saving, setSaving] = useState(false);

  // v1: 프로필 스트림 도착 시 intro 컨트롤러 동기화 (사용자 수정 중에도 외부 변경 반영)
  // 우리는 1-shot fetch라 profile 변경 시점에 한 번 반영.
  useEffect(() => {
    if (profile?.intro !== undefined) {
      setIntro(profile.intro);
    } else if (profile && profile.intro === undefined) {
      setIntro('');
    }
  }, [profile]);

  const onSaveIntro = async () => {
    if (!uid) {
      return;
    }
    const trimmed = intro.trim();
    setSaving(true);
    try {
      await updateProfile(uid, { intro: trimmed });
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

  const level = profile?.level ?? '5.6';
  const point = profile?.point ?? 0;
  const nextLevel = getNextLevel(level);
  const remain = getRemainToNextLevel(level, point);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}
        keyboardShouldPersistTaps="handled"
      >
        {/* 아바타 (편집 버튼은 [F] image-picker 도입 시 추가) */}
        <View style={styles.avatarWrap}>
          <ProfileWithCrown
            photoUrl={profile?.photoUrl}
            level={profile?.level}
            nickname={profile?.nickname}
            displayType="profile"
            radius={44}
          />
        </View>

        {/* 읽기 전용 필드 */}
        <ReadOnlyField label="닉네임" value={profile?.nickname ?? ''} />
        <ReadOnlyField label="이메일" value={email ?? ''} />

        {/* 등급 + 다음 등급까지 안내 (v1 _buildLevelField) */}
        <View style={styles.fieldWrap}>
          <Text variant="label" color="textSecondary" style={styles.label}>
            등급(Level)
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
            <Text variant="body">{level}</Text>
            <Text variant="caption" color="textSecondary" style={styles.hint}>
              {nextLevel
                ? `다음 등급(${nextLevel})까지 ${remain ?? 0}점`
                : '(최고 등급!)'}
            </Text>
          </View>
        </View>

        <ReadOnlyField label="포인트(Point)" value={String(point)} />

        {/* 한 줄 소개 — 편집 가능 (v1 TextField + 저장 버튼) */}
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  avatarWrap: { alignItems: 'center', marginVertical: 12 },
  fieldWrap: { marginBottom: 16 },
  label: { marginBottom: 6 },
  fieldBox: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 44,
  },
  hint: { marginTop: 4 },
});
