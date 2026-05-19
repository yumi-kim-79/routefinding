/**
 * 하단 탭 — Flutter v1 `home_screen.dart`(실제 탭 컨테이너)와 1:1 **5탭**.
 * 0 게시판 / 1 개념도 / 2 루트 위치 / 3 크루 / 4 마이페이지.
 *
 * 정정 이력: Phase 1-3에서 미사용 dead code `bottom_nav_bar.dart`(4탭) 기반
 *   오판 → Phase 2-1에서 v1 실제(home_screen.dart, IndexedStack 5탭)로 정정.
 *
 * TODO(Phase 2-1): v1 _tabHistory 백처리, initialIndex(라우트 param) 보존.
 * 아이콘은 [TBD] 아이콘 라이브러리 결정 후 (현재 라벨만).
 */
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from './types';
import { BoardScreen } from '../screens/board/BoardScreen';
import { ConceptListScreen } from '../screens/route/ConceptListScreen';
import { MapScreen } from '../screens/map/MapScreen';
import { CrewMainScreen } from '../screens/crew/CrewMainScreen';
import { MyPageScreen } from '../screens/profile/MyPageScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

export const MainTabNavigator: React.FC = () => (
  <Tab.Navigator initialRouteName="BoardTab">
    <Tab.Screen name="BoardTab" component={BoardScreen} options={{ title: '게시판' }} />
    <Tab.Screen
      name="ConceptTab"
      component={ConceptListScreen}
      options={{ title: '개념도' }}
    />
    <Tab.Screen name="MapTab" component={MapScreen} options={{ title: '루트 위치' }} />
    <Tab.Screen
      name="CrewTab"
      component={CrewMainScreen}
      options={{ title: '크루' }}
    />
    <Tab.Screen
      name="MyPageTab"
      component={MyPageScreen}
      options={{ title: '마이페이지' }}
    />
  </Tab.Navigator>
);
