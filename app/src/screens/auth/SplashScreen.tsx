/**
 * 스플래시 (v1 lib/splash_screen.dart).
 * RootNavigator가 isInitializing(세션 복원 대기) 동안 표시.
 * v2.0은 정적(로고 텍스트 + 앱 이름 + 인디케이터). 영상 스플래시는 v2.1+ 검토.
 * 자동로그인 체크는 authStore.initialize()(onAuthStateChanged)가 담당.
 */
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Screen } from '../../components/common/Screen';
import { Text } from '../../components/common/Text';
import { useTheme } from '../../theme';

export const SplashScreen: React.FC = () => {
  const theme = useTheme();
  return (
    <Screen>
      <View style={styles.center}>
        <Text variant="display" color="primary">
          RouteFinding
        </Text>
        <Text variant="label" color="textSecondary" style={styles.tagline}>
          클라이밍 루트 & 커뮤니티
        </Text>
        <ActivityIndicator
          color={theme.colors.primary}
          style={styles.spinner}
        />
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tagline: { marginTop: 8 },
  spinner: { marginTop: 32 },
});
