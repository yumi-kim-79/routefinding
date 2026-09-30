/**
 * 마이페이지 프로필 헤더 (v1 mypage_screen.dart 상단 영역 1:1).
 * users/{uid} → Avatar(profile) + 닉네임 + 로그아웃.
 * v2 리뉴얼(2026-08-04): 등급 왕관/테두리 제거 → 단순 원형 아바타.
 * 알림 아이콘(v1 notifications StreamBuilder)은 Phase 3.
 */
import React from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { APP_VERSION } from '../../../constants/version';
import { Avatar } from '../../../components/common/Avatar';
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
        <Avatar
          photoUrl={profile?.photoUrl}
          nickname={profile?.nickname}
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
          {/*
            설치된 버전 (2026-09-02 요청 → 2026-09-30 여기로 이동).
            문의가 들어왔을 때 "어느 버전 쓰세요?" 를 물어볼 필요가 없게 한다.

            ⚠️ 전에는 화면 **맨 아래 별도 줄**이었는데, 그 줄 높이만큼 광고 배너가
               위로 올라와 탭 내용을 가렸다. 헤더의 기존 텍스트 블록에 얹으면
               세로 공간이 늘지 않으면서 '항상 보이는 자리' 라는 조건도 그대로다.
            ⚠️ 값은 `package.json` 의 version — 업데이트 안내가 쓰는 `APP_VERSION` 과 같다.
               화면에 보이는 값과 판단 기준이 어긋나지 않는다.
          */}
          <Text variant="caption" color="disabled">
            v{APP_VERSION}
          </Text>
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
