/**
 * 하단 탭 — Flutter v1(`lib/bottom_nav_bar.dart`)과 1:1 동등 4탭.
 * 0 게시판 / 1 개념도 / 2 지도(리포트목록) / 3 마이페이지.
 * Home 탭·Crew 탭은 v1처럼 하단바에 없음(크루는 비탭 경로 진입).
 */
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from './types';
import { BoardScreen } from '../screens/board/BoardScreen';
import { ConceptListScreen } from '../screens/route/ConceptListScreen';
import { ReportListScreen } from '../screens/report/ReportListScreen';
import { MyPageScreen } from '../screens/profile/MyPageScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

export const MainTabNavigator: React.FC = () => (
  <Tab.Navigator initialRouteName="BoardTab">
    <Tab.Screen
      name="BoardTab"
      component={BoardScreen}
      options={{ title: '게시판' }}
    />
    <Tab.Screen
      name="ConceptTab"
      component={ConceptListScreen}
      options={{ title: '개념도' }}
    />
    <Tab.Screen
      name="MapTab"
      component={ReportListScreen}
      options={{ title: '지도' }}
    />
    <Tab.Screen
      name="MyPageTab"
      component={MyPageScreen}
      options={{ title: '마이페이지' }}
    />
  </Tab.Navigator>
);
