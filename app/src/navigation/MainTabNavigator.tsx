/**
 * 하단 탭 — v2 리뉴얼 **4탭** (2026-08-04).
 *   0 지도(첫 화면) / 1 개념도 / 2 루트제보 / 3 마이페이지
 *
 * 변경 이력:
 *  - Phase 1-3: 미사용 dead code `bottom_nav_bar.dart`(4탭) 기반 오판
 *  - Phase 2-1: v1 실제(home_screen.dart, IndexedStack 5탭)로 정정
 *  - 2026-08-04: 리뉴얼 결정 — 게시판·크루 제거하고 루트제보를 탭으로 승격.
 *    (화면 파일 BoardScreen/CrewMainScreen은 보존, 등록만 해제)
 *  - 2026-08-04(2차): **아이콘 도입.** 그전까지 `tabBarIcon`이 없어 React Navigation
 *    기본 도형이 4탭에 똑같이 그려졌다. 웹 `BottomNavBar.vue`와 **같은 SVG path**를 쓴다
 *    (`components/common/AppIcon.tsx`) → 웹·iOS·안드로이드 세 곳이 같은 모양.
 */
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from './types';
import { MapScreen } from '../screens/map/MapScreen';
import { ConceptListScreen } from '../screens/route/ConceptListScreen';
import { ReportListScreen } from '../screens/report/ReportListScreen';
import { MyPageScreen } from '../screens/profile/MyPageScreen';
import { AppIcon, type AppIconName } from '../components/common/AppIcon';
import { useTheme } from '../theme';

const Tab = createBottomTabNavigator<MainTabParamList>();

/** 탭 아이콘 크기·굵기는 웹과 동일 (23px / 비활성 1.8 · 활성 2.1) */
const ICON_SIZE = 23;

function tabIcon(name: AppIconName) {
  return ({ color, focused }: { color: string; focused: boolean }) => (
    <AppIcon name={name} size={ICON_SIZE} color={color} strokeWidth={focused ? 2.1 : 1.8} />
  );
}

export const MainTabNavigator: React.FC = () => {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      initialRouteName="MapTab"
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        // 웹 .label과 동일 (11px / 활성 700)
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500', letterSpacing: -0.2 },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.divider },
      }}
    >
      <Tab.Screen
        name="MapTab"
        component={MapScreen}
        options={{ title: '지도', tabBarIcon: tabIcon('map') }}
      />
      <Tab.Screen
        name="ConceptTab"
        component={ConceptListScreen}
        options={{ title: '개념도', tabBarIcon: tabIcon('concept') }}
      />
      <Tab.Screen
        name="ReportTab"
        component={ReportListScreen}
        options={{ title: '루트제보', tabBarIcon: tabIcon('report') }}
      />
      <Tab.Screen
        name="MyPageTab"
        component={MyPageScreen}
        options={{ title: '마이페이지', tabBarIcon: tabIcon('user') }}
      />
    </Tab.Navigator>
  );
};
