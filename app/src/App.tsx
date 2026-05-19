/**
 * RouteFinding v2 — 앱 진입점
 *
 * - NavigationContainer + RootNavigator (인증 분기, v1 동등 4탭)
 * - 부팅 시 Firebase App Check 1회 활성화
 *
 * @format
 */
import React, { useEffect } from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from '@react-navigation/native';
import { RootNavigator } from './navigation/RootNavigator';
import { initAppCheck } from './services/firebase';
import { useAuthStore } from './stores/authStore';

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';

  // Firebase App Check 부팅 시 1회 활성화
  useEffect(() => {
    initAppCheck();
  }, []);

  // 인증 상태 구독 시작 (앱 전역 1회 — Splash는 인증 시 마운트되지 않으므로
  // 여기서 호출해야 자동 로그인/세션 복원이 동작한다). 언마운트 시 해제.
  useEffect(() => {
    const unsub = useAuthStore.getState().initialize();
    return unsub;
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <NavigationContainer theme={isDarkMode ? DarkTheme : DefaultTheme}>
        <RootNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

export default App;
