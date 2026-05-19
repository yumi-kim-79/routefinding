/**
 * 최상위 네비게이터: 인증 여부로 Auth/Main 분기.
 * NavigationContainer는 App.tsx에서 제공한다.
 */
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import { AuthNavigator } from './AuthNavigator';
import { MainNavigator } from './MainNavigator';
import { useAuthGate } from './useAuthGate';
import { SplashScreen } from '../screens/auth/SplashScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  const { isLoading, isAuthenticated } = useAuthGate();

  // 첫 onAuthStateChanged 수신 전 = 세션 복원 중 → 스플래시 유지
  if (isLoading) {
    return <SplashScreen />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <Stack.Screen name="Main" component={MainNavigator} />
      ) : (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      )}
    </Stack.Navigator>
  );
};
