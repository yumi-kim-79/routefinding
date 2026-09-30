/**
 * 마이페이지 — v1 `lib/mypage_screen.dart`(1163줄 갓파일) 분해 컨테이너.
 *
 * 구조(분해): ProfileHeader + 탭 스위처. 경량 커스텀 탭(새 의존성 회피 —
 * @react-navigation/material-top-tabs 도입은 별도 결정).
 *
 * v2 리뉴얼 (2026-08-04): 게시판 제거에 따라 **'내글'·'내댓글' 탭 제거** (5탭 → 3탭).
 *   이어서 **MY ROUTE 탭 → '등반일지' 탭으로 대체**(users/{uid}/climbing_logs).
 *   즐겨찾기(★, my_routes)는 개념도에 그대로 남아 있다.
 *   글을 눌러도 갈 상세 화면이 없어지므로 탭째로 뺀다.
 *   컴포넌트 파일(MyPostsTab/MyCommentsTab)은 보존 — 되돌리려면 아래 주석 복구.
 *
 * 2026-08-17: **문의**(모두) · **사용자 메시지**(관리자 전용) 탭 추가.
 *   문자·카톡으로 받던 기능개선·수정요청을 앱 안에서 받는다(사용자 요청).
 *   ⚠️ 관리자 탭을 감추는 것은 편의일 뿐이다. 실제 차단은 firestore.rules 가 한다.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Screen } from '../../components/common/Screen';
import { Text } from '../../components/common/Text';
import { useTheme } from '../../theme';
import { useMyPage } from './hooks/useMyPage';
import { ProfileHeader } from './components/ProfileHeader';
import { MyReportsTab } from './components/MyReportsTab';
import { ClimbingLogTab } from './components/ClimbingLogTab';
import { FavoriteList } from '../../components/favorites/FavoriteList';
import { LiveStatsTab } from './components/LiveStatsTab';
import { MySendsTab } from './components/MySendsTab';
import { MyProjectsTab } from './components/MyProjectsTab';
import { MyProfileTab } from './components/MyProfileTab';
import { InquiryTab } from './components/InquiryTab';
import { UserMessagesTab } from './components/UserMessagesTab';
import { AbuseReportsTab } from './components/AbuseReportsTab';
import { BoardAdminTab } from './components/BoardAdminTab';
import { DifficultyAdminTab } from './components/DifficultyAdminTab';
import { EditSuggestionsTab } from './components/EditSuggestionsTab';
import { AdBanner } from '../../components/common/AdBanner';
import { useAuthStore } from '../../stores/authStore';
import { isAdminEmail } from '../../constants/admin';
import { APP_VERSION } from '../../constants/version';

/**
 * 탭 묶음 (2026-09-08 정리).
 *
 * ⚠️ 탭이 11개까지 늘면서 **관리자 탭이 사용자 탭 사이에 끼어** 있었다.
 *    일반 사용자에게는 볼 수도 없는 이름이 섞여 보이고, 관리자에게도 어디까지가
 *    '내 것'이고 어디부터가 '관리'인지 구분이 안 됐다.
 *    → **기록 → 내 정보 → 관리자** 순서로 묶고, 묶음 사이에 구분선을 넣는다.
 */
type TabGroup = 'mine' | 'account' | 'admin';

interface TabDef {
  key: string;
  label: string;
  Comp: React.ComponentType;
  group: TabGroup;
}

/**
 * 사용자 탭 — **자주 보는 것부터**.
 * 등반일지·내 완등·도전 중이 실제로 매번 여는 화면이고,
 * 제보 관리·문의·프로필은 가끔 들어간다.
 */
/** 마이페이지 안에서는 검색칸을 켠다 — 즐겨찾기가 수십 개씩 쌓이는 곳이다 */
const FavoriteTab: React.FC = () => <FavoriteList searchable />;

const BASE_TABS: TabDef[] = [
  { key: 'logs', label: '등반일지', Comp: ClimbingLogTab, group: 'mine' },
  // ⚠️ 등반일지(하루 단위)와 별개다. 완등은 루트 단위 — 합치면 통계를 못 만든다
  { key: 'sends', label: '내 완등', Comp: MySendsTab, group: 'mine' },
  /*
   * 즐겨찾기(★) — 2026-09-14 복구.
   * v2.2.0 에서 MY ROUTE 탭이 등반일지로 교체되면서 **모아 보는 곳이 사라졌다.**
   * 별은 계속 저장되고 있었는데 볼 방법이 없었다 (사용자 보고).
   */
  { key: 'favorites', label: '즐겨찾기', Comp: FavoriteTab, group: 'mine' },
  // ⚠️ 즐겨찾기와 다르다 — 붙었는데 아직 못 깬 루트다
  { key: 'projects', label: '도전 중', Comp: MyProjectsTab, group: 'mine' },

  { key: 'reports', label: '내 제보 관리', Comp: MyReportsTab, group: 'account' },
  { key: 'profile', label: '마이프로필', Comp: MyProfileTab, group: 'account' },
  { key: 'inquiry', label: '문의', Comp: InquiryTab, group: 'account' },
];

/**
 * 관리자 전용 — **맨 뒤로 몰고 구분선 뒤에 둔다.**
 *
 * ⚠️ '신고 관리'는 편의 기능이 아니다. Apple 심사지침 1.2 가 요구하는
 *    **24시간 내 처리 창구**다 (AbuseReportsTab 머리말). 빼면 심사에서 반려된다.
 */
const ADMIN_TABS: TabDef[] = [
  /* 실시간 접속 — 관리자 탭 맨 앞. 들어오자마자 보는 값이다 (2026-09-30) */
  { key: 'live', label: '실시간 접속', Comp: LiveStatsTab, group: 'admin' },
  { key: 'reportsAdmin', label: '신고 관리', Comp: AbuseReportsTab, group: 'admin' },
  { key: 'suggestions', label: '수정 제안', Comp: EditSuggestionsTab, group: 'admin' },
  // ⚠️ 리드 루트의 97%에 난이도가 없다 (2026-09-07 실측). 채우는 전용 화면이 필요하다
  { key: 'difficulty', label: '난이도 채우기', Comp: DifficultyAdminTab, group: 'admin' },
  { key: 'boardAdmin', label: '게시판 관리', Comp: BoardAdminTab, group: 'admin' },
  { key: 'messages', label: '사용자 메시지', Comp: UserMessagesTab, group: 'admin' },
];

/* ── 제거된 탭 (게시판 삭제로 갈 곳 없음) ────────────────
  { key: 'posts', label: '내글', Comp: MyPostsTab },
  { key: 'comments', label: '내댓글', Comp: MyCommentsTab },
──────────────────────────────────────────────────────── */

export const MyPageScreen: React.FC = () => {
  const { colors } = useTheme();
  const { profile, isLoading } = useMyPage();
  const email = useAuthStore((s) => s.user?.email);
  const [index, setIndex] = useState(0);

  const isAdmin = isAdminEmail(email);
  // ⚠️ 관리자 탭은 **맨 뒤**다. 사이에 끼우면 사용자 탭 흐름이 끊긴다 (위 머리말)
  const tabs = useMemo(
    () => (isAdmin ? [...BASE_TABS, ...ADMIN_TABS] : BASE_TABS),
    [isAdmin],
  );

  // 관리자 여부가 바뀌면 탭 수가 달라진다 — 범위를 벗어나지 않게 보정
  const safeIndex = Math.min(index, tabs.length - 1);
  const Active = tabs[safeIndex].Comp;

  return (
    <Screen padded={false}>
      <ProfileHeader profile={profile} isLoading={isLoading} />

      <View
        style={[styles.tabBarWrap, { borderBottomColor: colors.divider }]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBar}
        >
          {tabs.map((t, i) => {
            const active = i === safeIndex;
            // 묶음이 바뀌는 자리에 세로 구분선을 넣는다
            const newGroup = i > 0 && tabs[i - 1].group !== t.group;
            return (
              <React.Fragment key={t.key}>
                {newGroup ? (
                  <View style={[styles.groupDivider, { backgroundColor: colors.divider }]} />
                ) : null}
                <Pressable
                  onPress={() => setIndex(i)}
                  style={[
                    styles.tab,
                    // 관리자 탭은 배경을 살짝 깔아 '내 것'과 구분한다
                    t.group === 'admin' && { backgroundColor: colors.surfaceVariant },
                    active && { borderBottomColor: colors.primary },
                  ]}
                >
                  <Text
                    variant="label"
                    color={active ? 'primary' : t.group === 'admin' ? 'disabled' : 'textSecondary'}
                  >
                    {t.group === 'admin' ? `🔧 ${t.label}` : t.label}
                  </Text>
                </Pressable>
              </React.Fragment>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.body}>
        <Active />
      </View>

      {/*
        설치된 버전 (2026-09-02 요청).
        문의가 들어왔을 때 **"어느 버전 쓰세요?" 를 물어볼 필요가 없게** 한다 —
        업데이트 안내가 제대로 갔는지 확인할 때도 이 값이 기준이다.

        ⚠️ 탭과 무관하게 **항상 보이는 자리**에 둔다. 특정 탭 안에 넣으면
           정작 문의하는 사람이 못 찾는다.
        ⚠️ 값은 `package.json` 의 version 이다 — 업데이트 안내가 쓰는 `APP_VERSION` 과 같다
           (constants/version.ts). 화면에 보이는 값과 판단 기준이 어긋나지 않는다.
        ⚠️ 빌드 번호(versionCode / CURRENT_PROJECT_VERSION)는 JS 에서 읽을 수 없다.
           보여주려면 네이티브 의존성(react-native-device-info 등)이 필요하다 — 지금은 넣지 않는다.
      */}
      <View style={styles.versionRow}>
        <Text variant="caption" color="disabled">
          버전 {APP_VERSION}
        </Text>
      </View>

      <AdBanner />
    </Screen>
  );
};

const styles = StyleSheet.create({
  groupDivider: { width: 1, alignSelf: 'stretch', marginVertical: 8, marginHorizontal: 6 },
  tabBarWrap: { borderBottomWidth: 1 },
  tabBar: { paddingHorizontal: 8 },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  body: { flex: 1 },
  versionRow: { alignItems: 'center', paddingVertical: 8 },
});
