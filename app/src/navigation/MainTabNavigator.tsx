/**
 * 하단 탭 — v2 리뉴얼 **4탭** (2026-08-04).
 *   0 지도(첫 화면) / 1 개념도 / 2 루트제보 / 3 마이페이지
 *
 * 변경 이력:
 *  - Phase 1-3: 미사용 dead code `bottom_nav_bar.dart`(4탭) 기반 오판
 *  - Phase 2-1: v1 실제(home_screen.dart, IndexedStack 5탭)로 정정
 *  - 2026-08-04: 리뉴얼 결정 — 게시판·크루 제거하고 루트제보를 탭으로 승격.
 *    (화면 파일 BoardScreen/CrewMainScreen은 보존, 등록만 해제)
 *  - 2026-08-04(3차): 루트제보 탭이 **작성 폼**(ReportWriteScreen)이 됐다.
 *    웹의 `/report`도 목록이 아니라 작성 폼이다. 플레이스홀더였던 ReportListScreen은
 *    파일만 보존하고 탭 등록에서 뺐다.
 *  - 2026-08-04(2차): **아이콘 도입.** 그전까지 `tabBarIcon`이 없어 React Navigation
 *    기본 도형이 4탭에 똑같이 그려졌다. 웹 `BottomNavBar.vue`와 **같은 SVG path**를 쓴다
 *    (`components/common/AppIcon.tsx`) → 웹·iOS·안드로이드 세 곳이 같은 모양.
 */
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from './types';
import { MapScreen } from '../screens/map/MapScreen';
import { ConceptListScreen } from '../screens/route/ConceptListScreen';
import { CommunityScreen } from '../screens/community/CommunityScreen';
import { MyPageScreen } from '../screens/profile/MyPageScreen';
import { AppIcon, type AppIconName } from '../components/common/AppIcon';
import { useTheme } from '../theme';
import { useEnsureProfile } from '../hooks/useEnsureProfile';

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

  /*
   * 🚨 프로필(`users/{uid}`)을 **여기서 한 번** 읽는다 (2026-09-08).
   *
   *    글·완등·영상·암장정보에는 닉네임을 같이 저장해야 해서 화면들이 `profile` 을 본다.
   *    그런데 예전에는 **마이페이지를 열 때만** 채워져서(`useMyPage`),
   *    앱을 켜고 바로 그 기능을 쓰면 로그인했는데도 **"로그인이 필요합니다"** 가 떴다.
   *    (커뮤니티 글쓰기 → 베타 영상 → … 화면을 새로 만들 때마다 같은 증상이 재발했다)
   *
   *    ⚠️ 화면마다 `useEnsureProfile()` 을 붙이는 방식은 **새 화면을 만들 때마다 빠뜨린다.**
   *       로그인 후 반드시 지나는 이 지점에서 한 번 채워 두는 것이 옳다.
   *    ⚠️ 이미 있으면 다시 읽지 않는다 (hooks/useEnsureProfile.ts).
   */
  useEnsureProfile();

  return (
    <Tab.Navigator
      initialRouteName="MapTab"
      /*
       * ⚠️ 안드로이드 하드웨어 뒤로가기 동작 (2026-08-28).
       *    기본값 'firstRoute' 는 어느 탭에 있든 **지도 탭으로 점프**한다.
       *    "뒤로가기는 바로 전 단계로 돌아가야 한다"는 요구에 맞춰 'history' 로 바꾼다 —
       *    방문한 탭 순서를 거슬러 올라간다.
       *    (iOS 에는 하드웨어 뒤로가기가 없어 영향이 없다)
       */
      backBehavior="history"
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
      {/*
        ⚠️ 여기는 원래 **루트제보** 탭이었다 (2026-09-07 B안으로 교체).
           루트제보는 자주 쓰는 기능이 아닌데 탭 하나를 차지하고 있었다.
           들어가는 길은 두 군데 남아 있다:
             · 마이페이지 ▸ 내 제보 관리 ▸ '루트 제보하기'
             · 개념도 상세 ▸ '이 구역에 루트 제보' (등반지·구역·좌표가 자동으로 채워진다)
           ⚠️ 커뮤니티를 다시 빼고 루트제보를 되돌리려면 이 블록만 바꾸면 된다.
      */}
      <Tab.Screen
        name="CommunityTab"
        component={CommunityScreen}
        options={{ title: '커뮤니티', tabBarIcon: tabIcon('users') }}
      />
      <Tab.Screen
        name="MyPageTab"
        component={MyPageScreen}
        options={{ title: '마이페이지', tabBarIcon: tabIcon('user') }}
      />
    </Tab.Navigator>
  );
};
