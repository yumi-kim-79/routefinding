/**
 * 인증 후 스택: 하단 4탭(MainTabs) + push/modal 화면들.
 * push/modal 화면은 아직 골격 검증용 플레이스홀더(실화면은 스프린트별 교체).
 *
 * 실화면 교체 이력:
 *   - ConceptDetail (개념도 상세) — 2026-08-03 리뉴얼 1단계에서 실구현으로 교체.
 *   - RouteDetail / ReportDetail (제보 상세) — 2026-08-05 교체.
 *     플레이스홀더로 남아 있어서 **제보관리에서 카드를 눌러도 빈 화면**이었다
 *     (= 관리자가 내용을 못 보고 승인하던 상태).
 *
 * v2 리뉴얼 (2026-08-04): 게시판·크루 계열 라우트 등록 해제.
 *   화면 파일(BoardScreen/CrewMainScreen 등)은 보존 — 되돌리려면 아래 주석 복구.
 */
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { MainStackParamList } from './types';
import { MainTabNavigator } from './MainTabNavigator';
import { PlaceholderScreen } from '../components/common/PlaceholderScreen';
import { ConceptDetailScreen } from '../screens/route/ConceptDetailScreen';
import { ConceptEditScreen } from '../screens/route/ConceptEditScreen';
import { PitchDetailScreen } from '../screens/route/PitchDetailScreen';
import { CragDetailScreen } from '../screens/route/CragDetailScreen';
import { ClimbingLogEditScreen } from '../screens/profile/ClimbingLogEditScreen';
import { ReportDetailScreen } from '../screens/report/ReportDetailScreen';
import { ReportWriteRoute } from '../screens/report/ReportWriteRoute';
import { PostDetailScreen } from '../screens/community/PostDetailScreen';
import { PostWriteScreen } from '../screens/community/PostWriteScreen';

const Stack = createNativeStackNavigator<MainStackParamList>();

/** 라우트명을 그대로 보여주는 플레이스홀더 (후속 스프린트에서 교체) */
const makePlaceholder =
  (title: string): React.FC =>
  () =>
    <PlaceholderScreen title={title} note="후속 스프린트 구현 대상" />;

export const MainNavigator: React.FC = () => (
  <Stack.Navigator initialRouteName="MainTabs">
    <Stack.Screen
      name="MainTabs"
      component={MainTabNavigator}
      options={{ headerShown: false }}
    />

    {/* 개념도 (리뉴얼 1단계: 찾아서 보기) */}
    <Stack.Screen
      name="ConceptDetail"
      component={ConceptDetailScreen}
      options={{ title: '개념도' }}
    />
      <Stack.Screen
        name="ConceptEdit"
        component={ConceptEditScreen}
        options={{ title: '개념도 수정' }}
      />

    {/* 암장 정보 — 접근·주차·대중교통 (v2.2.0) */}
    <Stack.Screen
      name="CragDetail"
      component={CragDetailScreen}
      options={{ title: '암장 정보' }}
    />

    {/* 등반일지 작성/수정 */}
    <Stack.Screen
      name="ClimbingLogEdit"
      component={ClimbingLogEditScreen}
      options={{ title: '등반일지' }}
    />

    {/* 개념도를 보다가 그 자리에서 제보 (등반지·구역·좌표 자동 입력) */}
    <Stack.Screen
      name="ReportWrite"
      component={ReportWriteRoute}
      options={{ title: '루트 제보' }}
    />

    {/* 루트/리포트 */}
    <Stack.Screen
      name="RouteDetail"
      component={ReportDetailScreen}
      options={{ title: '제보 상세' }}
    />
    {/* 같은 화면 — 옛 라우트명으로 들어오는 경로도 살려둔다 */}
    <Stack.Screen
      name="ReportDetail"
      component={ReportDetailScreen}
      options={{ title: '제보 상세' }}
    />
    {/*
      피치 상세 — 2026-08-29 실화면으로 교체.
      플레이스홀더로 남아 있어서 **피치를 눌러도 상세가 열리지 않았고**,
      대신 눌린 썸네일이 루트 대표 사진 뷰어를 잘못된 인덱스로 열고 있었다
      (자세한 경위는 PitchDetailScreen.tsx 머리말).
    */}
    <Stack.Screen name="PitchDetail" component={PitchDetailScreen} options={{ title: '피치' }} />
    <Stack.Screen name="ReportAdmin" component={makePlaceholder('리포트 승인(관리자)')} />

    {/*
      커뮤니티 (v2.1.0) — 하단탭의 루트제보 자리를 커뮤니티가 넘겨받았다.
      두 화면 모두 CommunityScreen 에서만 열리는 push 화면이라
      **여기 등록이 빠지면 카드를 눌러도 빈 화면**이 된다 (PitchDetail 과 같은 사고).
    */}
    <Stack.Screen
      name="PostDetail"
      component={PostDetailScreen}
      options={{ title: '게시글' }}
    />
    <Stack.Screen
      name="PostWrite"
      component={PostWriteScreen}
      options={{ title: '글쓰기' }}
    />

    {/* 사용자 / 트래킹 / 기타 */}
    <Stack.Screen name="UserProfile" component={makePlaceholder('사용자 프로필')} />
    <Stack.Screen name="Tracking" component={makePlaceholder('등반 트래킹')} />
    <Stack.Screen name="ApproachTracking" component={makePlaceholder('접근로 트래킹')} />
    <Stack.Screen name="MapInput" component={makePlaceholder('지도 입력/편집')} />
    <Stack.Screen name="ImageEditor" component={makePlaceholder('이미지 에디터')} />
    <Stack.Screen name="NotificationList" component={makePlaceholder('알림')} />

    {/* ── v2에서 제거 (파일 보존, 등록만 해제) ──────────────────────
         PostDetail / WritePost 는 2026-09-07 커뮤니티 실화면으로 부활 (위쪽 참고).
    <Stack.Screen name="CommentDetail" component={makePlaceholder('댓글 상세')} />
    <Stack.Screen name="CrewDetail" component={makePlaceholder('크루 상세')} />
    <Stack.Screen name="CrewChat" component={makePlaceholder('크루 채팅')} />
    ──────────────────────────────────────────────────────────── */}
  </Stack.Navigator>
);
