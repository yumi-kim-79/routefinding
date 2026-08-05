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
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Screen } from '../../components/common/Screen';
import { Text } from '../../components/common/Text';
import { useTheme } from '../../theme';
import { useMyPage } from './hooks/useMyPage';
import { ProfileHeader } from './components/ProfileHeader';
import { MyReportsTab } from './components/MyReportsTab';
import { ClimbingLogTab } from './components/ClimbingLogTab';
import { MyProfileTab } from './components/MyProfileTab';
import { AdBanner } from '../../components/common/AdBanner';

// v2 리뉴얼 3탭
const TABS = [
  { key: 'reports', label: '내 제보 관리', Comp: MyReportsTab },
  { key: 'logs', label: '등반일지', Comp: ClimbingLogTab },
  { key: 'profile', label: '마이프로필', Comp: MyProfileTab },
] as const;

/* ── 제거된 탭 (게시판 삭제로 갈 곳 없음) ────────────────
  { key: 'posts', label: '내글', Comp: MyPostsTab },
  { key: 'comments', label: '내댓글', Comp: MyCommentsTab },
──────────────────────────────────────────────────────── */

export const MyPageScreen: React.FC = () => {
  const { colors } = useTheme();
  const { profile, isLoading } = useMyPage();
  const [index, setIndex] = useState(0);

  const Active = TABS[index].Comp;

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
          {TABS.map((t, i) => {
            const active = i === index;
            return (
              <Pressable
                key={t.key}
                onPress={() => setIndex(i)}
                style={[
                  styles.tab,
                  active && { borderBottomColor: colors.primary },
                ]}
              >
                <Text
                  variant="label"
                  color={active ? 'primary' : 'textSecondary'}
                >
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.body}>
        <Active />
      </View>

      <AdBanner />
    </Screen>
  );
};

const styles = StyleSheet.create({
  tabBarWrap: { borderBottomWidth: 1 },
  tabBar: { paddingHorizontal: 8 },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  body: { flex: 1 },
});
