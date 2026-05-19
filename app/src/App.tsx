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

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';

  // Firebase App Check 부팅 시 1회 활성화
  useEffect(() => {
    initAppCheck();
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
