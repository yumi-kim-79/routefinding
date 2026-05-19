/**
 * 네비게이션 타입 정의 (타입 안전 네비게이션 — `any` 금지, CLAUDE.md)
 *
 * 구조 근거:
 * - 하단 4탭은 Flutter v1(`lib/bottom_nav_bar.dart`)과 1:1 동등:
 *   게시판 / 개념도 / 지도(=리포트 목록) / 마이페이지
 * - 상세 화면 param에는 식별자(id)를 명시해 **딥링크 대비**(구조만).
 *   실제 linking config·FCM 연동은 Phase 3에서 추가
 *   (cf. docs/02_DATA_MODEL.md notifications.target*).
 */
import type { NavigatorScreenParams } from '@react-navigation/native';

/** 미인증 스택 */
export type AuthStackParamList = {
  Splash: undefined;
  Login: undefined;
  SignUp: undefined;
};

/** 하단 탭 (v1 4탭 동등) */
export type MainTabParamList = {
  BoardTab: undefined; // 게시판  (v1 /board)
  ConceptTab: undefined; // 개념도  (v1 /)
  MapTab: undefined; // 지도    (v1 /reports = 리포트 목록)
  MyPageTab: undefined; // 마이페이지 (v1 /mypage)
};

/** 인증 후 스택 (탭 + push/modal 화면). id 파라미터 = 딥링크 대비 */
export type MainStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList>;

  // 루트/리포트
  RouteDetail: { reportId: string };
  ReportDetail: { reportId: string };
  PitchDetail: { reportId: string; pitchId: string };
  ReportAdmin: undefined;

  // 게시판
  PostDetail: { postId: string };
  CommentDetail: { postId: string; commentId: string };
  WritePost: undefined;
  EditPost: { postId: string };

  // 크루 (v1처럼 비탭 경로 진입)
  CrewMain: undefined;
  CrewDetail: { crewId: string };
  CrewChat: { crewId: string };

  // 사용자 / 트래킹 / 기타
  UserProfile: { userId: string };
  Tracking: { reportId?: string };
  ApproachTracking: { reportId?: string };
  MapInput: undefined;
  ImageEditor: { imageUrl?: string };
  NotificationList: undefined;
};

/** 최상위: 인증 여부로 분기 */
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainStackParamList>;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
