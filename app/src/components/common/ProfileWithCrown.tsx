/**
 * ProfileWithCrown — v1 `lib/common/profile_with_crown.dart` 1:1 이식.
 *
 * 아바타 + 등급 테두리색 + 등급 뱃지 + (상위 3등급) 왕관.
 * 등급 색상은 v1 `_levelBorderColor`와 동일(`theme.colors.grade`).
 *
 * TODO(v2.1+): 크라운 이미지 에셋 최적화 후 교체
 *   - 원본 v1 assets/crown_full|min|low.png 합계 ~4.2MB(비최적화) → 200KB 이내 압축
 *   - 5.15: crown_full, 5.14: crown_min, 5.13: crown_low
 *   - 현재는 이모지 👑로 placeholder (상위 3등급만 표시 — v1 _crownAsset과 동일 조건)
 * TODO: 사진 없을 때 fallback — 아이콘 라이브러리([TBD]) 결정 후 person 아이콘으로.
 */
import React from 'react';
import { Image, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme';

type DisplayType = 'profile' | 'comment' | 'reply' | 'default';

interface ProfileWithCrownProps {
  photoUrl?: string | null;
  /** 등반등급 문자열 ("5.15"~"5.7" 등). undefined면 뱃지 미표시 */
  level?: string | null;
  nickname?: string | null;
  /** true면 아바타 옆 닉네임 표시 (Row) */
  showNickname?: boolean;
  displayType?: DisplayType;
  /** radius 직접 지정 (없으면 displayType 프리셋) */
  radius?: number;
}

// v1 displayType별 프리셋 (radius, crown, levelFont, 위치 비율)
const PRESET: Record<DisplayType, { radius: number }> = {
  profile: { radius: 44 },
  comment: { radius: 14 },
  reply: { radius: 12 },
  default: { radius: 44 },
};

/** v1 _crownAsset: 상위 3등급만 왕관 */
const CROWN_LEVELS = new Set(['5.15', '5.14', '5.13']);

export const ProfileWithCrown: React.FC<ProfileWithCrownProps> = ({
  photoUrl,
  level,
  nickname,
  showNickname = false,
  displayType = 'profile',
  radius: radiusProp,
}) => {
  const { colors } = useTheme();

  const radius = radiusProp ?? PRESET[displayType].radius;
  const borderColor =
    (level && colors.grade[level]) || colors.gradeDefault;
  const hasCrown = !!level && CROWN_LEVELS.has(level);
  const levelFont = Math.max(8, radius * 0.2);
  const crownSize = radius * 0.9;

  const avatar = (
    <View style={[styles.stack, { width: (radius + 2) * 2 }]}>
      {/* 등급 테두리 링 */}
      <View
        style={{
          width: (radius + 2) * 2,
          height: (radius + 2) * 2,
          borderRadius: radius + 2,
          backgroundColor: borderColor,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {photoUrl ? (
          <Image
            source={{ uri: photoUrl }}
            style={{
              width: radius * 2,
              height: radius * 2,
              borderRadius: radius,
            }}
          />
        ) : (
          <View
            style={{
              width: radius * 2,
              height: radius * 2,
              borderRadius: radius,
              backgroundColor: colors.surfaceVariant,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: radius }}>👤</Text>
          </View>
        )}
      </View>

      {/* 왕관 (상위 3등급, placeholder 👑) */}
      {hasCrown ? (
        <Text
          style={[
            styles.crown,
            { fontSize: crownSize, top: -radius * 0.75 },
          ]}
        >
          👑
        </Text>
      ) : null}

      {/* 등급 뱃지 */}
      {level ? (
        <View
          style={[
            styles.badge,
            {
              backgroundColor: borderColor,
              borderColor: colors.onPrimary,
              bottom: -radius * 0.4,
              borderRadius: radius * 0.7,
            },
          ]}
        >
          <Text
            style={{
              color: colors.onPrimary,
              fontWeight: '700',
              fontSize: levelFont,
              // v1의 검정 stroke 효과 근사 (RN은 stroke 미지원 → textShadow)
              textShadowColor: colors.textPrimary,
              textShadowRadius: 2,
            }}
          >
            {level}
          </Text>
        </View>
      ) : null}
    </View>
  );

  if (!showNickname) {
    return avatar;
  }
  return (
    <View style={styles.row}>
      {avatar}
      <Text
        numberOfLines={1}
        style={[styles.nickname, { color: colors.textPrimary }]}
      >
        {nickname ?? '(닉네임 없음)'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  stack: { alignItems: 'center', justifyContent: 'center' },
  crown: { position: 'absolute', zIndex: 2 },
  badge: {
    position: 'absolute',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    zIndex: 3,
  },
  row: { flexDirection: 'row', alignItems: 'center' } as ViewStyle,
  nickname: { marginLeft: 6, fontSize: 14, flexShrink: 1 },
});
