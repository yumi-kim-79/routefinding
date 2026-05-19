/**
 * 마이페이지 프로필 헤더 (v1 mypage_screen.dart 상단 영역 1:1).
 * users/{uid} → ProfileWithCrown(profile) + 닉네임 + 로그아웃.
 * 알림 아이콘(v1 notifications StreamBuilder)은 Phase 3.
 */
import React from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { ProfileWithCrown } from '../../../components/common/ProfileWithCrown';
import { Text } from '../../../components/common/Text';
import { Button } from '../../../components/common/Button';
import { useTheme } from '../../../theme';
import { useAuthStore } from '../../../stores/authStore';
import type { UserProfile } from '../../../types/user';

interface ProfileHeaderProps {
  profile: UserProfile | null;
  isLoading: boolean;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  profile,
  isLoading,
}) => {
  const { colors, spacing } = useTheme();
  const signOut = useAuthStore((s) => s.signOut);

  const onLogout = () => {
    Alert.alert('로그아웃', '로그아웃 하시겠어요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: () => {
          signOut().catch(() => {
            /* authStore.error 반영 */
          });
        },
      },
    ]);
  };

  return (
    <View
      style={[
        styles.wrap,
        { padding: spacing.md, borderBottomColor: colors.divider },
      ]}
    >
      <View style={styles.row}>
        <ProfileWithCrown
          photoUrl={profile?.photoUrl}
          level={profile?.level}
          nickname={profile?.nickname}
          displayType="profile"
          radius={32}
        />
        <View style={styles.info}>
          <Text variant="title">
            {isLoading ? '불러오는 중…' : profile?.nickname ?? '(닉네임 없음)'}
          </Text>
          {profile?.intro ? (
            <Text variant="caption" color="textSecondary">
              {profile.intro}
            </Text>
          ) : null}
        </View>
      </View>
      <Button title="로그아웃" variant="ghost" size="sm" onPress={onLogout} />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { borderBottomWidth: 1, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center' },
  info: { marginLeft: 12, flexShrink: 1 },
});
