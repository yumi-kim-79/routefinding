/**
 * 실시간 접속 대시보드 — 관리자 전용 (2026-09-30).
 *
 * ⚠️ 그림 원칙 (dataviz)
 *   · 두 그래프 모두 **한 계열**이다 → 범례를 두지 않는다. 제목이 계열 이름이다.
 *   · 색으로 크기를 말하지 않는다. **막대 길이가 크기다** — 색은 한 가지(primary)만 쓴다.
 *     값에 따라 색을 바꾸면 같은 정보를 두 번 그리는 셈이고, 색각 이상에서 먼저 무너진다.
 *   · 숫자를 **모든 막대에 달지 않는다.** 7일은 행 끝에 값을 붙여 표처럼 읽히게 하고,
 *     24시간은 **가장 많은 시간대 하나만** 표시한다.
 *   · 글자는 언제나 텍스트 토큰이다. 계열 색을 글자에 쓰지 않는다.
 *   · 축·눈금은 뒤로 물린다.
 *
 * ⚠️ '지금 접속 중'은 그래프가 아니라 **숫자 한 개**가 맞다. 추이가 아니라 현재값이다.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { Text } from '../../../components/common/Text';
import { Button } from '../../../components/common/Button';
import { RemoteImage } from '../../../components/common/RemoteImage';
import { useTheme } from '../../../theme';
import {
  subscribePresence,
  type PresenceUser,
} from '../../../services/presenceService';
import {
  fetchMemberCount,
  fetchMembers,
  seoulToday,
  subscribeRecentStats,
  type DailyStat,
  type Member,
} from '../../../services/adminStatsService';

/** 접속 후 얼마나 됐는지 — '방금', '12분', '1시간 20분' */
function elapsed(since?: number): string {
  if (!since) {
    return '';
  }
  const m = Math.max(0, Math.floor((Date.now() - since) / 60000));
  if (m < 1) {
    return '방금';
  }
  if (m < 60) {
    return `${m}분`;
  }
  return `${Math.floor(m / 60)}시간 ${m % 60}분`;
}

/** 'YYYY-MM-DD' → '9/30 (화)' */
function shortDate(d: string): string {
  const [, mm, dd] = d.split('-');
  const day = ['일', '월', '화', '수', '목', '금', '토'][
    new Date(`${d}T00:00:00+09:00`).getDay()
  ];
  return `${Number(mm)}/${Number(dd)} (${day})`;
}

const HERO: React.FC<{ label: string; value: string; hint?: string }> = ({
  label,
  value,
  hint,
}) => {
  const { colors, radius, spacing } = useTheme();
  return (
    <View
      style={[
        styles.hero,
        { backgroundColor: colors.surfaceVariant, borderRadius: radius.md, padding: spacing.sm },
      ]}
    >
      <Text variant="caption" color="textSecondary">
        {label}
      </Text>
      <Text variant="headline" style={styles.heroValue}>
        {value}
      </Text>
      {hint ? (
        <Text variant="caption" color="disabled">
          {hint}
        </Text>
      ) : null}
    </View>
  );
};

export const LiveStatsTab: React.FC = () => {
  const { colors, radius, spacing } = useTheme();
  const [online, setOnline] = useState<PresenceUser[] | null>(null);
  /** 전체 회원 수 — 집계 쿼리라 읽기 1건이다 */
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [cursor, setCursor] = useState<Awaited<ReturnType<typeof fetchMembers>>['cursor']>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [firstPageDone, setFirstPageDone] = useState(false);
  const [stats, setStats] = useState<DailyStat[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** 접속 경과 시간을 1분마다 다시 그린다 */
  const [, tick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(
    () =>
      subscribePresence(setOnline, (m) => {
        setOnline([]);
        setError(
          `접속 현황을 읽지 못했습니다. Realtime Database 가 만들어졌는지 확인해 주세요. (${m})`,
        );
      }),
    [],
  );

  /** 회원 수 + 첫 페이지 */
  useEffect(() => {
    let cancelled = false;
    void fetchMemberCount()
      .then((n) => !cancelled && setMemberCount(n))
      .catch(() => !cancelled && setMemberCount(null));
    void fetchMembers()
      .then((p) => {
        if (cancelled) {
          return;
        }
        setMembers(p.items);
        setCursor(p.cursor);
        setFirstPageDone(true);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setFirstPageDone(true);
          setError((prev) => prev ?? `회원 목록을 읽지 못했습니다. (${String(e)})`);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadMore = () => {
    if (!cursor || loadingMore) {
      return;
    }
    setLoadingMore(true);
    void fetchMembers(cursor)
      .then((p) => {
        setMembers((prev) => [...prev, ...p.items]);
        setCursor(p.cursor);
      })
      .finally(() => setLoadingMore(false));
  };

  useEffect(
    () =>
      subscribeRecentStats(7, setStats, (m) => {
        setStats([]);
        setError((prev) => prev ?? `통계를 읽지 못했습니다. (${m})`);
      }),
    [],
  );

  /** 목록에서 '지금 접속 중'을 빠르게 판별하려고 */
  const onlineUids = useMemo(
    () => new Set((online ?? []).map((u) => u.uid)),
    [online],
  );

  const today = seoulToday();
  const byDate = useMemo(
    () => new Map((stats ?? []).map((s) => [s.date, s])),
    [stats],
  );
  const todayStat = byDate.get(today);
  const yesterday = useMemo(() => {
    const d = new Date(`${today}T00:00:00+09:00`);
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }, [today]);
  const ydayStat = byDate.get(yesterday);

  /** 최근 7일 — 오래된 날이 위로 (시간이 아래로 흐른다) */
  const week = useMemo(() => [...(stats ?? [])].reverse(), [stats]);
  const weekMax = Math.max(1, ...week.map((s) => s.users));

  const hours = todayStat?.hours ?? [];
  const hourMax = Math.max(1, ...hours);
  const peakHour = hours.indexOf(hourMax);

  const diff =
    todayStat && ydayStat ? todayStat.users - ydayStat.users : undefined;

  if (online === null || stats === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      data={online}
      keyExtractor={(u) => u.uid}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl }}
      ListHeaderComponent={
        <View>
          {error ? (
            <Text variant="caption" color="error" style={styles.err}>
              {error}
            </Text>
          ) : null}

          {/* 현재값은 그래프가 아니라 숫자다 */}
          <View style={styles.heroRow}>
            <HERO label="지금 접속 중" value={`${online.length}`} />
            <HERO
              label="전체 회원"
              value={memberCount === null ? '—' : `${memberCount}`}
            />
            <HERO
              label="오늘"
              value={`${todayStat?.users ?? 0}`}
              hint={
                diff === undefined
                  ? undefined
                  : diff === 0
                    ? '어제와 같음'
                    : `어제보다 ${diff > 0 ? '+' : ''}${diff}`
              }
            />
          </View>
          <View style={[styles.heroRow, styles.heroRow2]}>
            <HERO label="어제" value={`${ydayStat?.users ?? 0}`} />
            <HERO
              label="오늘 앱 실행"
              value={`${todayStat?.opens ?? 0}`}
              hint="재접속 포함"
            />
            <HERO
              label="최근 7일 합"
              value={`${week.reduce((n, s2) => n + s2.users, 0)}`}
              hint="중복 포함"
            />
          </View>

          {/* ── 최근 7일 ─────────────────────────────── */}
          <Text variant="title" style={styles.h}>
            최근 7일 접속자 수
          </Text>
          {week.length === 0 ? (
            <Text variant="caption" color="textSecondary">
              아직 쌓인 기록이 없습니다.
            </Text>
          ) : (
            week.map((s) => (
              <View key={s.date} style={styles.barRow}>
                <Text
                  variant="caption"
                  color={s.date === today ? 'textPrimary' : 'textSecondary'}
                  style={styles.barLabel}
                  numberOfLines={1}
                >
                  {shortDate(s.date)}
                </Text>
                <View
                  style={[
                    styles.track,
                    { backgroundColor: colors.surfaceVariant, borderRadius: radius.sm },
                  ]}
                >
                  <View
                    style={[
                      styles.fill,
                      {
                        backgroundColor: colors.primary,
                        borderRadius: radius.sm,
                        width: `${Math.max(2, (s.users / weekMax) * 100)}%`,
                      },
                    ]}
                  />
                </View>
                <Text variant="caption" color="textSecondary" style={styles.barValue}>
                  {s.users}
                </Text>
              </View>
            ))
          )}

          {/* ── 시간대별 ──────────────────────────────── */}
          <Text variant="title" style={styles.h}>
            오늘 시간대별 접속
          </Text>
          {hourMax <= 1 && hours.every((n) => n === 0) ? (
            <Text variant="caption" color="textSecondary">
              오늘 기록이 아직 없습니다.
            </Text>
          ) : (
            <>
              <View style={styles.hourChart}>
                {hours.map((n, h) => (
                  <View key={h} style={styles.hourCol}>
                    <View
                      style={[
                        styles.hourBar,
                        {
                          backgroundColor:
                            n > 0 ? colors.primary : colors.surfaceVariant,
                          borderTopLeftRadius: 3,
                          borderTopRightRadius: 3,
                          height: Math.max(2, (n / hourMax) * 72),
                        },
                      ]}
                    />
                  </View>
                ))}
              </View>
              {/* 눈금은 뒤로 물린다 — 0·6·12·18시만 */}
              <View style={styles.hourAxis}>
                {[0, 6, 12, 18].map((h) => (
                  <Text key={h} variant="caption" color="disabled">
                    {h}시
                  </Text>
                ))}
              </View>
              <Text variant="caption" color="textSecondary" style={styles.peak}>
                가장 많은 시간대 · {peakHour}시 ({hourMax}회)
              </Text>
            </>
          )}

          {/* ── 접속 중 명단 ──────────────────────────── */}
          <Text variant="title" style={styles.h}>
            지금 접속 중 {online.length > 0 ? online.length : ''}
          </Text>
          {online.length === 0 ? (
            <Text variant="caption" color="textSecondary">
              지금 접속 중인 사용자가 없습니다.
            </Text>
          ) : null}
        </View>
      }
      ListFooterComponent={
        <View>
          <Text variant="title" style={styles.h}>
            전체 회원 {memberCount !== null ? memberCount : ''}
          </Text>

          {/*
            🚨 `orderBy('createdAt')` 는 **그 필드가 없는 문서를 통째로 제외한다.**
               v1 시절 회원 중에 가입일이 없는 사람이 있으면 목록이 총원보다 적어진다.
               조용히 적게 보여주면 "회원이 줄었나?" 로 읽히므로 차이를 밝힌다.
          */}
          {firstPageDone &&
          memberCount !== null &&
          !cursor &&
          members.length < memberCount ? (
            <Text variant="caption" color="warning" style={styles.note}>
              {memberCount - members.length}명은 가입일 정보가 없어 목록에 나오지 않습니다.
              (총원 {memberCount}명은 정확합니다)
            </Text>
          ) : null}

          {!firstPageDone ? (
            <ActivityIndicator color={colors.primary} style={styles.note} />
          ) : members.length === 0 ? (
            <Text variant="caption" color="textSecondary">
              회원이 없습니다.
            </Text>
          ) : (
            members.map((m) => {
              const isOn = onlineUids.has(m.uid);
              return (
                <View
                  key={m.uid}
                  style={[styles.person, { borderBottomColor: colors.divider }]}
                >
                  <RemoteImage
                    uri={m.photoUrl}
                    variant="thumb"
                    emptyLabel=""
                    style={[
                      styles.avatar,
                      { borderRadius: radius.full, backgroundColor: colors.surfaceVariant },
                    ]}
                  />
                  <View style={styles.personText}>
                    <View style={styles.nameRow}>
                      {/* 접속 중은 점 하나로. 글자를 계열색으로 물들이지 않는다 */}
                      {isOn ? (
                        <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                      ) : null}
                      <Text variant="body" numberOfLines={1} style={styles.flex}>
                        {m.nickname}
                      </Text>
                    </View>
                    <Text variant="caption" color="textSecondary" numberOfLines={1}>
                      {m.emailMasked ?? '이메일 없음'}
                      {m.joinedAt
                        ? ` · 가입 ${m.joinedAt.toISOString().slice(0, 10)}`
                        : ''}
                    </Text>
                    <Text variant="caption" color="disabled">
                      {isOn
                        ? '지금 접속 중'
                        : m.lastSeenDate
                          ? `마지막 접속 ${m.lastSeenDate}`
                          : '접속 기록 없음'}
                    </Text>
                  </View>
                </View>
              );
            })
          )}

          {cursor ? (
            <Button
              title={loadingMore ? '불러오는 중…' : '더 보기'}
              variant="secondary"
              onPress={loadMore}
              loading={loadingMore}
              disabled={loadingMore}
              style={{ marginTop: spacing.md }}
            />
          ) : null}
        </View>
      }
      renderItem={({ item }) => (
        <View style={[styles.person, { borderBottomColor: colors.divider }]}>
          <RemoteImage
            uri={item.photoUrl}
            variant="thumb"
            emptyLabel=""
            style={[
              styles.avatar,
              { borderRadius: radius.full, backgroundColor: colors.surfaceVariant },
            ]}
          />
          <View style={styles.personText}>
            <Text variant="body" numberOfLines={1}>
              {item.nickname}
            </Text>
            <Text variant="caption" color="textSecondary">
              {item.platform === 'ios' ? 'iPhone' : 'Android'}
              {item.since ? ` · ${elapsed(item.since)} 접속 중` : ''}
            </Text>
          </View>
        </View>
      )}
    />
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  err: { marginBottom: 12, lineHeight: 18 },
  heroRow: { flexDirection: 'row', columnGap: 8 },
  heroRow2: { marginTop: 8 },
  hero: { flex: 1 },
  heroValue: { marginVertical: 2 },
  h: { marginTop: 28, marginBottom: 10 },

  // 7일 — 가로 막대. 세로로 세우면 좁은 화면에서 날짜 라벨이 겹친다
  barRow: { flexDirection: 'row', alignItems: 'center', columnGap: 8, marginBottom: 6 },
  barLabel: { width: 74 },
  track: { flex: 1, height: 14, overflow: 'hidden' },
  fill: { height: '100%' },
  barValue: { width: 28, textAlign: 'right' },

  // 24시간 — 막대 사이 2px 틈 (dataviz: 인접 막대는 표면색으로 띄운다)
  hourChart: { flexDirection: 'row', alignItems: 'flex-end', height: 72, columnGap: 2 },
  hourCol: { flex: 1, justifyContent: 'flex-end' },
  hourBar: { width: '100%' },
  hourAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  peak: { marginTop: 6 },

  person: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: { width: 36, height: 36 },
  personText: { flex: 1, rowGap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', columnGap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  flex: { flex: 1 },
  note: { marginBottom: 8, lineHeight: 18 },
});
