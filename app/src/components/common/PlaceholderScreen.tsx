/**
 * 플레이스홀더 화면 (디자인 시스템 토큰 사용 예시).
 *
 * Phase 1-3 골격용. 실제 화면은 Phase 2에서 교체.
 * 색상/타이포/간격을 theme 토큰으로만 사용(하드코딩 금지) — 토큰 적용 레퍼런스.
 */
import React from 'react';
import { View } from 'react-native';
import { Screen } from './Screen';
import { Text } from './Text';

interface PlaceholderScreenProps {
  title: string;
  note?: string;
}

export const PlaceholderScreen: React.FC<PlaceholderScreenProps> = ({
  title,
  note,
}) => {
  return (
    <Screen>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text variant="headline">{title}</Text>
        {note ? (
          <Text variant="label" color="textSecondary" style={{ marginTop: 8 }}>
            {note}
          </Text>
        ) : null}
        <Text variant="caption" color="disabled" style={{ marginTop: 16 }}>
          Phase 2에서 실제 화면으로 교체 예정
        </Text>
      </View>
    </Screen>
  );
};
