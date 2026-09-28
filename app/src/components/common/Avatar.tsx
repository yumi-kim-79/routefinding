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
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Text } from './Text';
import { RemoteImage } from './RemoteImage';
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
        /*
         * ⚠️ 2026-08-28 — `<Image source={{ uri: photoUrl }} />` 였다.
         *    v2 는 업로드 후 `getDownloadURL()` 결과를 저장하지만,
         *    **v1(Flutter) 시절 가입자는 `storage.googleapis.com` 원본 주소**가
         *    users/{uid}.photoUrl 에 그대로 남아 있다 → 그 계정은 프로필 사진이 403 이었다.
         *    RemoteImage 가 두 형식을 모두 흡수한다.
         *
         * ⚠️ variant="thumb" 는 쓰지 않는다. 프로필 사진은 route_images 밖(profile_photos)이라
         *    썸네일 생성 함수의 대상이 아니다 — 헛조회만 늘어난다.
         */
        <RemoteImage
          uri={photoUrl}
          style={styles.image}
          resizeMode="cover"
          emptyLabel=""
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
