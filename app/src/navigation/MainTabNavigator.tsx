/**
 * 하단 탭 — v2 리뉴얼 **4탭** (2026-08-04).
 *   0 지도(첫 화면) / 1 개념도 / 2 루트제보 / 3 마이페이지
 *
 * 변경 이력:
 *  - Phase 1-3: 미사용 dead code `bottom_nav_bar.dart`(4탭) 기반 오판
 *  - Phase 2-1: v1 실제(home_screen.dart, IndexedStack 5탭)로 정정
 *  - 2026-08-04: 리뉴얼 결정 — 게시판·크루 제거하고 루트제보를 탭으로 승격.
 *    (화면 파일 BoardScreen/CrewMainScreen은 보존, 등록만 해제)
 *
 * 아이콘은 [TBD] 아이콘 라이브러리 결정 후 (현재 라벨만).
 */
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from './types';
import { MapScreen } from '../screens/map/MapScreen';
import { ConceptListScreen } from '../screens/route/ConceptListScreen';
import { ReportListScreen } from '../screens/report/ReportListScreen';
import { MyPageScreen } from '../screens/profile/MyPageScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

export const MainTabNavigator: React.FC = () => (
  <Tab.Navigator initialRouteName="MapTab">
    <Tab.Screen name="MapTab" component={MapScreen} options={{ title: '지도' }} />
    <Tab.Screen
      name="ConceptTab"
      component={ConceptListScreen}
      options={{ title: '개념도' }}
    />
    <Tab.Screen
      name="ReportTab"
      component={ReportListScreen}
      options={{ title: '루트제보' }}
    />
    <Tab.Screen
      name="MyPageTab"
      component={MyPageScreen}
      options={{ title: '마이페이지' }}
    />
  </Tab.Navigator>
);
