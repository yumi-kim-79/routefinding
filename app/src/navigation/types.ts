/**
 * 네비게이션 타입 정의 (타입 안전 네비게이션 — `any` 금지, CLAUDE.md)
 *
 * v2 리뉴얼 (2026-08-04): **4탭 체제로 축소**
 *   개념도 / 지도 / 루트제보 / 마이페이지
 *   제거: 게시판(BoardTab), 크루(CrewTab) 및 그 하위 push 화면들.
 *   → 화면 파일은 남겨뒀고 라우팅만 끊었다(되돌리기 쉽도록).
 */
import type { NavigatorScreenParams } from '@react-navigation/native';
import type { ConceptSource } from '../types/concept';

/** 미인증 스택 (Splash는 RootNavigator가 isInitializing 중 직접 렌더) */
export type AuthStackParamList = {
  Login: undefined;
  SignUp: undefined;
};

/**
 * 하단 탭 — v2 리뉴얼 4탭.
 * 0 지도(첫 화면) / 1 개념도 / 2 루트제보 / 3 마이페이지.
 *
 * (v1은 5탭: 게시판·개념도·루트위치·크루·마이페이지 — docs/04_WIREFRAMES.md 참조)
 */
export type MainTabParamList = {
  MapTab: undefined; // 지도       (로그인 후 첫 화면)
  ConceptTab: undefined; // 개념도
  ReportTab: undefined; // 루트제보 (작성 폼 — 웹 /report와 동일)
  MyPageTab: undefined; // 마이페이지
};

/** 인증 후 스택 (탭 + push/modal 화면). id 파라미터 = 딥링크 대비 */
export type MainStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList>;

  /**
   * 개념도 상세.
   * `source`는 어느 컬렉션에서 읽을지 힌트(목록에서 넘어올 땐 항상 채워짐).
   * 딥링크/알림처럼 모를 때는 생략 가능 — 화면이 두 컬렉션을 순서대로 시도한다.
   */
  ConceptDetail: { conceptId: string; source?: ConceptSource };

  /** 개념도 수정 (관리자 전용 — 웹 concepts/edit/:id 대응) */
  ConceptEdit: { conceptId: string; source: ConceptSource };

  /**
   * 등반일지 작성/수정.
   * `logId` 있으면 수정, 없으면 새로 작성.
   * `initial`은 전부 문자열 — 네비 param은 직렬화 가능해야 해서 Timestamp를 넘기지 않는다.
   * 개념도에서 진입하면 place/routeName/conceptId가 채워진 채 열린다.
   */
  ClimbingLogEdit: {
    logId?: string;
    initial?: {
      date?: string;      // YYYY-MM-DD
      endDate?: string;   // YYYY-MM-DD
      place?: string;
      routeName?: string;
      gear?: string;
      duration?: string;
      partners?: string;
      notes?: string;
      conceptId?: string;
      conceptSource?: string;
    };
  };

  // 루트/리포트
  RouteDetail: { reportId: string };
  ReportDetail: { reportId: string };
  PitchDetail: { reportId: string; pitchId: string };
  ReportAdmin: undefined;

  // 사용자 / 트래킹 / 기타
  UserProfile: { userId: string };
  Tracking: { reportId?: string };
  ApproachTracking: { reportId?: string };
  MapInput: undefined;
  ImageEditor: { imageUrl?: string };
  NotificationList: undefined;

  /* ── v2 리뉴얼에서 **화면 등록만 해제**한 라우트 ──────────────────
     MainNavigator에 <Stack.Screen>이 없으므로 실제로는 이동할 수 없다.
     타입을 남겨두는 이유: 보존한 화면 파일(MyPostsTab/MyCommentsTab 등)이
     여전히 이 라우트명을 참조하므로, 지우면 타입체크가 깨진다.
     게시판/크루를 되살릴 때 MainNavigator의 주석만 풀면 된다.        */
  PostDetail: { postId: string };
  CommentDetail: { postId: string; commentId: string };
  WritePost: undefined;
  EditPost: { postId: string };
  CrewDetail: { crewId: string };
  CrewChat: { crewId: string };
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
