/**
 * 베타 영상 — 등반 전에 **동작을 미리 본다.** 사진으로는 안 되는 것이다.
 *
 * ⚠️ 재생은 **외부 앱**으로 넘긴다 (`Linking.openURL`).
 *    인앱 웹뷰로 유튜브를 띄우면 재생 제한(임베드 불가 영상)에 걸린다.
 * ⚠️ 유튜브 썸네일은 `img.youtube.com` 이 공짜로 준다 — 우리가 만들지 않는다.
 * ⚠️ 붙이기는 **로그인 사용자 누구나**. 루트를 올린 사람만 붙일 수 있으면 아무도 안 붙인다.
 *
 * ⚠️ **영상 찾기** (2026-09-07 요청: "내가 하나하나 해야 되는건가?")
 *    유튜브 API 키가 있으면 앱 안에서 후보를 썸네일과 함께 보여주고 한 번 탭으로 붙인다.
 *    키가 없으면 유튜브를 **검색어와 함께** 열어 준다 (constants/youtube.ts).
 *    ⚠️ 자동으로 붙이지는 않는다 — 루트명이 '노을' '감자' 처럼 흔한 단어가 많아
 *       엉뚱한 영상이 붙는 사고가 난다 (services/youtubeSearch.ts 머리말).
 *
 * ⚠️ **인스타그램은 썸네일을 못 가져온다.** 공개 oEmbed 가 토큰을 요구하도록 바뀌어서다.
 *    대신 인스타 카드로 표시하고 누르면 인스타 앱으로 넘긴다 — 재생은 정상이다.
 */
import React, { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Text } from '../../../components/common/Text';
import { Button } from '../../../components/common/Button';
import { AppIcon } from '../../../components/common/AppIcon';
import { useTheme } from '../../../theme';
import { useAuthStore } from '../../../stores/authStore';
import { useUserStore } from '../../../stores/userStore';
import { isAdminEmail } from '../../../constants/admin';
import { addBetaVideo, removeBetaVideo } from '../../../services/betaVideoService';
import {
  hasYoutubeKey,
  searchRouteVideos,
  youtubeSearchUrl,
  type VideoCandidate,
} from '../../../services/youtubeSearch';
import { videoThumbnail, type BetaVideo } from '../../../types/betaVideo';
import type { Concept } from '../../../types/concept';

interface Props {
  concept: Concept;
  onChanged: () => void;
}

export const BetaVideoSection: React.FC<Props> = ({ concept, onChanged }) => {
  const { colors, radius } = useTheme();
  const uid = useAuthStore((s) => s.user?.uid);
  const isAdmin = isAdminEmail(useAuthStore((s) => s.user?.email));
  const profile = useUserStore((s) => s.profile);

  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [candidates, setCandidates] = useState<VideoCandidate[] | null>(null);
  const [searching, setSearching] = useState(false);

  const videos = concept.betaVideos ?? [];

  /**
   * 이 루트 영상 찾기.
   * ⚠️ 키가 없으면 유튜브를 검색어와 함께 연다. 앱은 그래도 쓸 수 있어야 한다.
   */
  const findVideos = useCallback(async () => {
    if (!hasYoutubeKey()) {
      void Linking.openURL(
        youtubeSearchUrl(concept.mountain, concept.zone, concept.routeName),
      ).catch(() => Alert.alert('유튜브를 열 수 없습니다.'));
      setOpen(true); // 돌아와서 바로 붙일 수 있게 입력칸을 열어 둔다
      return;
    }
    setSearching(true);
    try {
      const list = await searchRouteVideos(concept.mountain, concept.zone, concept.routeName);
      setCandidates(list ?? []);
    } catch (e) {
      Alert.alert('검색 실패', e instanceof Error ? e.message : String(e));
    } finally {
      setSearching(false);
    }
  }, [concept]);

  const attach = useCallback(
    async (c: VideoCandidate) => {
      if (!uid) {
        Alert.alert('로그인이 필요합니다.');
        return;
      }
      if (!profile) {
        // ⚠️ 로그인은 돼 있는데 프로필만 아직인 상태다. '로그인 필요'라고 하면 안 된다
        Alert.alert('잠시만요', '프로필을 불러오는 중입니다. 잠시 후 다시 눌러 주세요.');
        return;
      }
      setBusy(true);
      try {
        await addBetaVideo(concept, c.url, c.title, { uid, nickname: profile.nickname });
        setCandidates((prev) => (prev ?? []).filter((x) => x.videoId !== c.videoId));
        onChanged();
      } catch (e) {
        Alert.alert('붙이기 실패', e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [uid, profile, concept, onChanged],
  );

  const add = useCallback(async () => {
    if (!uid) {
      Alert.alert('로그인이 필요합니다.');
      return;
    }
    if (!profile) {
      // ⚠️ 로그인은 돼 있는데 프로필만 아직인 상태다. '로그인 필요'라고 하면 안 된다
      Alert.alert('잠시만요', '프로필을 불러오는 중입니다. 잠시 후 다시 눌러 주세요.');
      return;
    }
    setBusy(true);
    try {
      await addBetaVideo(concept, url, title, { uid, nickname: profile.nickname });
      setUrl('');
      setTitle('');
      setOpen(false);
      onChanged();
    } catch (e) {
      Alert.alert('붙이기 실패', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [uid, profile, concept, url, title, onChanged]);

  const remove = useCallback(
    (v: BetaVideo) => {
      Alert.alert('영상 빼기', '이 영상을 목록에서 뺄까요?', [
        { text: '취소', style: 'cancel' },
        {
          text: '빼기',
          style: 'destructive',
          onPress: () => {
            void removeBetaVideo(concept, v)
              .then(onChanged)
              .catch((e: unknown) =>
                Alert.alert('실패', e instanceof Error ? e.message : String(e)),
              );
          },
        },
      ]);
    },
    [concept, onChanged],
  );

  return (
    <View style={[styles.wrap, { borderTopColor: colors.divider }]}>
      <View style={styles.head}>
        <Text variant="title">베타 영상 {videos.length > 0 ? videos.length : ''}</Text>
        {uid ? (
          <View style={styles.headBtns}>
            <Pressable onPress={() => void findVideos()} hitSlop={6}>
              <Text variant="label" color="primary">
                {searching ? '찾는 중…' : '영상 찾기'}
              </Text>
            </Pressable>
            <Pressable onPress={() => setOpen((v) => !v)} hitSlop={6}>
              <Text variant="label" color="textSecondary">
                {open ? '닫기' : '링크 붙이기'}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {/* 검색 후보 — 눌러서 바로 붙인다 */}
      {candidates !== null ? (
        candidates.length === 0 ? (
          <Text variant="caption" color="disabled" style={styles.pad}>
            검색 결과가 없습니다. 링크를 직접 붙여 주세요.
          </Text>
        ) : (
          <>
            <Text variant="caption" color="textSecondary" style={styles.pad}>
              눌러서 붙이기 — ⚠️ 이 루트 영상이 맞는지 먼저 확인하세요
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.strip}>
              {candidates.map((c) => (
                <Pressable
                  key={c.videoId}
                  disabled={busy}
                  onPress={() => void attach(c)}
                  style={styles.item}
                >
                  <Image
                    source={{ uri: c.thumbnail }}
                    style={[styles.thumb, { borderRadius: radius.sm }]}
                    resizeMode="cover"
                  />
                  <Text variant="caption" numberOfLines={2} style={styles.itemTitle}>
                    {c.title}
                  </Text>
                  <Text variant="caption" color="disabled" numberOfLines={1}>
                    {c.channel}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )
      ) : null}

      {open ? (
        <View style={styles.form}>
          <TextInput
            value={url}
            onChangeText={setUrl}
            placeholder="유튜브 · 인스타그램 링크 붙여넣기"
            placeholderTextColor={colors.disabled}
            autoCapitalize="none"
            keyboardType="url"
            style={[
              styles.input,
              { borderColor: colors.divider, borderRadius: radius.sm, color: colors.textPrimary },
            ]}
          />
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="설명 (선택) — 예) 크럭스 무브"
            placeholderTextColor={colors.disabled}
            maxLength={40}
            style={[
              styles.input,
              { borderColor: colors.divider, borderRadius: radius.sm, color: colors.textPrimary },
            ]}
          />
          <Button title="붙이기" onPress={() => void add()} loading={busy} />
          <Text variant="caption" color="disabled">
            ⚠️ 영상은 원래 올린 곳(유튜브·인스타)에서 재생됩니다. 링크만 저장됩니다.
            {'\n'}인스타는 미리보기 이미지를 제공하지 않아 아이콘으로만 보입니다.
          </Text>
        </View>
      ) : null}

      {videos.length === 0 ? (
        <Text variant="caption" color="disabled" style={styles.pad}>
          아직 영상이 없습니다. 등반 영상을 붙이면 다음 사람이 동작을 미리 볼 수 있습니다.
        </Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.strip}>
          {videos.map((v) => {
            const thumb = videoThumbnail(v);
            const mine = !!uid && v.addedByUid === uid;
            return (
              <View key={v.url} style={styles.item}>
                <Pressable
                  onPress={() => {
                    // 위 머리말: 인앱 웹뷰가 아니라 외부 앱으로
                    void Linking.openURL(v.url).catch(() =>
                      Alert.alert('열 수 없습니다', v.url),
                    );
                  }}
                  style={[styles.thumb, { backgroundColor: colors.surfaceVariant, borderRadius: radius.sm }]}
                >
                  {thumb ? (
                    <Image source={{ uri: thumb }} style={styles.thumbImg} resizeMode="cover" />
                  ) : (
                    <View style={styles.center}>
                      <AppIcon name="line" size={22} color={colors.textSecondary} />
                      <Text variant="caption" color="textSecondary">
                        {v.platform === 'instagram' ? '인스타' : '링크'}
                      </Text>
                    </View>
                  )}
                </Pressable>
                <Text variant="caption" numberOfLines={1} style={styles.itemTitle}>
                  {v.title || v.addedBy}
                </Text>
                {mine || isAdmin ? (
                  <Pressable onPress={() => remove(v)} hitSlop={8} style={styles.del}>
                    <AppIcon name="x" size={12} color={colors.textPrimary} />
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginTop: 20, paddingTop: 16, borderTopWidth: 1, rowGap: 10 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  headBtns: { flexDirection: 'row', columnGap: 14 },
  form: { paddingHorizontal: 16, rowGap: 8 },
  input: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  pad: { paddingHorizontal: 16 },
  strip: { paddingHorizontal: 12 },
  item: { width: 150, marginHorizontal: 4 },
  thumb: { width: 150, height: 84, overflow: 'hidden' },
  thumbImg: { width: '100%', height: '100%' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', rowGap: 2 },
  itemTitle: { marginTop: 4 },
  del: { position: 'absolute', top: 4, right: 4, backgroundColor: '#fff9', borderRadius: 10, padding: 3 },
});
