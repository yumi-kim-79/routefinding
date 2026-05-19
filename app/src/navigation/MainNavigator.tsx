/**
 * 인증 후 스택: 하단 4탭(MainTabs) + push/modal 화면들.
 * push/modal 화면은 Phase 1-3에서 골격 검증용 플레이스홀더.
 * 실제 화면은 Phase 2 스프린트에서 교체(docs/04_WIREFRAMES.md 라우트표).
 */
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { MainStackParamList } from './types';
import { MainTabNavigator } from './MainTabNavigator';
import { PlaceholderScreen } from '../components/common/PlaceholderScreen';

const Stack = createNativeStackNavigator<MainStackParamList>();

/** 라우트명을 그대로 보여주는 플레이스홀더 (Phase 2에서 교체) */
const makePlaceholder =
  (title: string): React.FC =>
  () =>
    <PlaceholderScreen title={title} note="Phase 2 마이그레이션 대상" />;

export const MainNavigator: React.FC = () => (
  <Stack.Navigator initialRouteName="MainTabs">
    <Stack.Screen
      name="MainTabs"
      component={MainTabNavigator}
      options={{ headerShown: false }}
    />

    {/* 루트/리포트 */}
    <Stack.Screen name="RouteDetail" component={makePlaceholder('루트 상세')} />
    <Stack.Screen name="ReportDetail" component={makePlaceholder('리포트 상세')} />
    <Stack.Screen name="PitchDetail" component={makePlaceholder('피치 상세')} />
    <Stack.Screen name="ReportAdmin" component={makePlaceholder('리포트 승인(관리자)')} />

    {/* 게시판 */}
    <Stack.Screen name="PostDetail" component={makePlaceholder('게시글 상세')} />
    <Stack.Screen name="CommentDetail" component={makePlaceholder('댓글 상세')} />
    <Stack.Screen name="WritePost" component={makePlaceholder('글쓰기')} />
    <Stack.Screen name="EditPost" component={makePlaceholder('글 수정')} />

    {/* 크루 (v1처럼 비탭 경로 진입) */}
    <Stack.Screen name="CrewMain" component={makePlaceholder('크루')} />
    <Stack.Screen name="CrewDetail" component={makePlaceholder('크루 상세')} />
    <Stack.Screen name="CrewChat" component={makePlaceholder('크루 채팅')} />

    {/* 사용자 / 트래킹 / 기타 */}
    <Stack.Screen name="UserProfile" component={makePlaceholder('사용자 프로필')} />
    <Stack.Screen name="Tracking" component={makePlaceholder('등반 트래킹')} />
    <Stack.Screen name="ApproachTracking" component={makePlaceholder('접근로 트래킹')} />
    <Stack.Screen name="MapInput" component={makePlaceholder('지도 입력/편집')} />
    <Stack.Screen name="ImageEditor" component={makePlaceholder('이미지 에디터')} />
    <Stack.Screen name="NotificationList" component={makePlaceholder('알림')} />
  </Stack.Navigator>
);
