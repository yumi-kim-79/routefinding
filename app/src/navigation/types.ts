/**
 * 네비게이션 타입 정의 (타입 안전 네비게이션 — `any` 금지, CLAUDE.md)
 *
 * v2 리뉴얼 (2026-08-04): **4탭 체제로 축소**
 *   개념도 / 지도 / 루트제보 / 마이페이지
 *   제거: 게시판(BoardTab), 크루(CrewTab) 및 그 하위 push 화면들.
 *   → 화면 파일은 남겨뒀고 라우팅만 끊었다(되돌리기 쉽도록).
 */
import type { NavigatorScreenParams } from '@react-navigation/native';
import type { ConceptPitch, ConceptSource } from '../types/concept';
import type { BoardType } from '../types/board';
import type { ReportCollection } from '../types/report';
import type { ReportPrefill } from '../types/routeReport';

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
  /**
   * 커뮤니티 — 게시판 + 피드 (2026-09-07).
   * ⚠️ 이 자리는 원래 `ReportTab`(루트제보 작성 폼)이었다.
   *    루트제보는 마이페이지 ▸ 내 제보 관리와 개념도 상세에서 들어간다.
   */
  CommunityTab: undefined;
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
      /** v2.1.0 — 수정 화면에서 스위치·썸네일을 원래 상태로 되돌리려면 함께 넘겨야 한다 */
      isPublic?: boolean;
      photoUrls?: string[];
      conceptId?: string;
      conceptSource?: string;
    };
  };

  /**
   * 암장 정보 (접근·주차·대중교통) — v2.2.0.
   * ⚠️ `crags/{mountain}__{zone}` 문서를 본다. 좌표는 그 구역 루트에서 넘겨준다
   *    (문서가 없을 때도 지도 열기가 되게).
   */
  CragDetail: {
    mountain: string;
    zone?: string;
    latitude?: number;
    longitude?: number;
  };

  /**
   * 제보 상세 (관리자 제보관리 / 내 제보에서 진입).
   * `collection`은 어느 컬렉션의 문서인지 힌트 — 목록에서 넘어올 땐 항상 채워진다.
   * 없으면 화면이 두 컬렉션을 순서대로 시도한다(딥링크 대비).
   */
  /**
   * 루트제보 작성 (스택). 탭의 작성 폼과 **같은 화면**이지만
   * 개념도에서 열면 등반지·구역·좌표가 채워진 채로 열린다.
   */
  ReportWrite: { prefill?: ReportPrefill } | undefined;

  RouteDetail: { reportId: string; collection?: ReportCollection };
  ReportDetail: { reportId: string; collection?: ReportCollection };
  /**
   * 피치 상세.
   *
   * ⚠️ 피치는 부모 문서(route_reports/bouldering_reports)의 `pitches` **배열 원소**다.
   *    따로 읽을 문서가 없다(서브컬렉션 route_reports/{id}/pitches는 v1에서도 쓰지 않았다 —
   *    docs/02_DATA_MODEL.md §6). 그래서 id가 아니라 **값을 그대로** 넘긴다.
   *    재조회가 없으니 화면이 즉시 뜨고, 목록에서 본 것과 항상 같은 내용이 나온다.
   *    (옛 정의 `{ reportId, pitchId }`는 실제로 이동하는 곳이 한 군데도 없던 미구현 흔적 —
   *     2026-08-29 실화면 구현하면서 교체)
   */
  PitchDetail: {
    /** 1부터 시작하는 피치 번호 (헤더 제목 · 이름이 없을 때 표시용) */
    pitchNumber: number;
    /** 목록에서 이미 읽어둔 피치 값 */
    pitch: ConceptPitch;
    /** "북한산 · 인수봉 · 취나드B" — 어느 루트의 피치인지 */
    routeTitle?: string;
  };
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
  /**
   * 커뮤니티 글 상세 (2026-09-07 — v1 게시판 자리를 그대로 쓴다).
   * 글은 `community_posts` 한 컬렉션에 있고 게시판 구분은 문서의 `boardId` 다.
   */
  PostDetail: { postId: string };
  /**
   * 글쓰기 / 수정.
   * `boardType` 을 같이 넘기는 이유: 게시판 종류에 따라 **폼에 뜨는 입력이 다르다**
   * (place → 등반지 필수, market → 가격·거래방식). 화면에서 boards 를 다시 읽지 않으려고 비정규화한다.
   * `postId` 가 있으면 수정 모드.
   */
  PostWrite: {
    boardId: string;
    boardType: BoardType;
    postId?: string;
    /** 개념도 상세에서 '이 루트 이야기' 로 들어온 경우 미리 채운다 */
    prefill?: { mountain?: string; zone?: string; conceptId?: string; conceptSource?: string };
  };
  CommentDetail: { postId: string; commentId: string };
  /** @deprecated 2026-09-07 — `PostWrite` 로 대체. 라우트는 남겨 두되 새 코드는 쓰지 말 것 */
  WritePost: undefined;
  /** @deprecated 2026-09-07 — `PostWrite` 에 postId 를 넘길 것 */
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
