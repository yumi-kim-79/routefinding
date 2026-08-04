/**
 * 프로필 아바타 — 단순 원형 이미지.
 *
 * v2 리뉴얼(2026-08-04): 등급/포인트 체계를 걷어내면서 `ProfileWithCrown`
 * (왕관 + 등급별 테두리색)을 이 컴포넌트로 대체한다.
 * 사진이 없으면 닉네임 첫 글자를 보여준다.
 *
 * ⚠️ `ProfileWithCrown.tsx` 파일 자체는 남겨뒀다 —
 *    라우팅만 해제한 게시판/크루 화면들이 아직 참조하고 있어서다.
 *
 * 구현 메모: 컨테이너는 View, 사진은 그 안을 채우는 Image로 둔다.
 * (스타일 prop을 Image에 직접 넘기면 ViewStyle ↔ ImageStyle 타입이 충돌한다)
 */
import React from 'react';
import { Image, StyleSheet, View, type ViewStyle } from 'react-native';
import { Text } from './Text';
import { useTheme } from '../../theme';

interface AvatarProps {
  photoUrl?: string | null;
  nickname?: string | null;
  /** 반지름 (지름 = radius * 2). 기본 32 */
  radius?: number;
  style?: ViewStyle;
}

export const Avatar: React.FC<AvatarProps> = ({
  photoUrl,
  nickname,
  radius = 32,
  style,
}) => {
  const { colors } = useTheme();
  const size = radius * 2;
  const initial = (nickname ?? '').trim().charAt(0) || '?';

  return (
    <View
      style={[
        styles.box,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: colors.surfaceVariant,
        },
        style,
      ]}
    >
      {photoUrl ? (
        <Image
          source={{ uri: photoUrl }}
          style={styles.image}
          resizeMode="cover"
        />
      ) : (
        <Text
          variant="title"
          color="textSecondary"
          style={{ fontSize: Math.max(12, radius * 0.8) }}
        >
          {initial}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
});
