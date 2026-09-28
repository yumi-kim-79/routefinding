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
import { Modal, StatusBar, useColorScheme } from 'react-native';
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
        업데이트 안내 — **강제와 권장을 다르게 다룬다** (2026-08-31 '무한 루프' 신고 대응).

        · required(강제) — 네비게이터를 **대체**한다. 뒤에 앱이 살아 있으면 안 되는 화면이다.
        · optional(권장) — 앱을 **정상적으로 띄우고 그 위에 얹는다.**
          예전에는 권장도 네비게이터를 대체해서, 스토어에 아직 새 버전이 없으면
          ('열기'로만 보이는 단계적 출시·심사 대기 구간) 스토어를 다녀와도
          **같은 벽을 다시 만나** 빠져나갈 길이 없어 보였다.
          이제는 닫으면 바로 뒤에 앱이 있고, 스토어에 다녀오면 자동으로 닫힌다.
        ⚠️ 권장 안내를 다시 네비게이터 대체로 되돌리지 말 것.
      */}
      {update.visible && update.info && update.info.level === 'required' ? (
        <UpdateGate
          info={update.info}
          onDismiss={update.dismiss}
          onSentToStore={update.markSentToStore}
        />
      ) : (
        <>
          <NavigationContainer theme={isDarkMode ? DarkTheme : DefaultTheme}>
            <RootNavigator />
          </NavigationContainer>

          {update.visible && update.info ? (
            <Modal
              visible
              animationType="fade"
              /* 안드로이드 하드웨어 뒤로가기로도 닫힌다 — 갇히지 않게 하는 또 하나의 출구 */
              onRequestClose={update.dismiss}
            >
              <UpdateGate
                info={update.info}
                onDismiss={update.dismiss}
                onSentToStore={update.markSentToStore}
              />
            </Modal>
          ) : null}
        </>
      )}
    </SafeAreaProvider>
  );
}

export default App;
