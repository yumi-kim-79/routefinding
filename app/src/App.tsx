/**
 * RouteFinding v2 — 앱 진입점
 *
 * - NavigationContainer + RootNavigator (인증 분기, v1 동등 4탭)
 * - 부팅 시 Firebase App Check 1회 활성화
 * - **업데이트 안내**(Remote Config): 최소 지원 버전 미만이면 화면을 덮는다.
 *   네트워크를 기다리지 않는다 — 캐시로 즉시 판단하고 새 값은 백그라운드로 받는다.
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
import { UpdateGate } from './components/common/UpdateGate';
import { useUpdateGate } from './hooks/useUpdateGate';

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';
  const update = useUpdateGate();

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
      {/*
        업데이트 안내는 네비게이터를 **대체**한다(위에 얹지 않는다).
        강제 단계에서 뒤에 앱이 살아 있으면 안 되고, 화면 전환 애니메이션도 섞이지 않는다.
      */}
      {update.visible && update.info ? (
        <UpdateGate info={update.info} onDismiss={update.dismiss} />
      ) : (
        <NavigationContainer theme={isDarkMode ? DarkTheme : DefaultTheme}>
          <RootNavigator />
        </NavigationContainer>
      )}
    </SafeAreaProvider>
  );
}

export default App;
