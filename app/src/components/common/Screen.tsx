/**
 * 화면 래퍼 — SafeArea + 테마 배경. 화면 컴포넌트의 기본 컨테이너.
 */
import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';

interface ScreenProps {
  children: React.ReactNode;
  /** 콘텐츠 패딩 적용 (기본 true) */
  padded?: boolean;
  edges?: readonly Edge[];
  style?: ViewStyle;
}

export const Screen: React.FC<ScreenProps> = ({
  children,
  padded = true,
  edges = ['top', 'bottom'],
  style,
}) => {
  const theme = useTheme();
  return (
    <SafeAreaView
      edges={edges}
      style={[styles.safe, { backgroundColor: theme.colors.background }]}
    >
      <View
        style={[
          styles.body,
          padded && { padding: theme.spacing.md },
          style,
        ]}
      >
        {children}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { flex: 1 },
});
