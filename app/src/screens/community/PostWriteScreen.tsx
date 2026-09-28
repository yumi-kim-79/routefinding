/**
 * 글쓰기 — 사진 여러 장 + 본문. 게시판 종류에 따라 입력이 달라진다.
 *
 *  free   : 사진 + 본문
 *  place  : + 등반지(필수) · 구역
 *  market : + 가격 · 거래방식 · 지역  (⚠️ 안전 안내 필수 — 아래 MARKET_NOTICE)
 *  log    : 여기로 못 온다 (일지 공개로만 생성)
 *
 * ⚠️ 사진은 `post_images/{postId}/` 에 올라간다.
 *    `functions/index.js` 의 `generateThumbnail` prefix 에 **`post_images/` 를 추가**해야
 *    목록에서 40KB 축소본을 쓴다. 안 하면 원본(1~3MB)을 그대로 받는다.
 */
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { launchImageLibrary } from 'react-native-image-picker';
import { Text } from '../../components/common/Text';
import { Button } from '../../components/common/Button';
import { AppIcon } from '../../components/common/AppIcon';
import { KeyboardAwareScroll } from '../../components/common/KeyboardAwareScroll';
import { useTheme } from '../../theme';
import { useAuthStore } from '../../stores/authStore';
import { useUserStore } from '../../stores/userStore';
import { useEnsureProfile } from '../../hooks/useEnsureProfile';
import { libraryOptions } from '../../constants/image';
import { createPost, MAX_POST_IMAGES } from '../../services/communityService';
import { checkText } from '../../utils/profanity';
import type { MainStackParamList } from '../../navigation/types';
import type { TradeType } from '../../types/communityPost';

type Nav = NativeStackNavigationProp<MainStackParamList, 'PostWrite'>;
type Rt = RouteProp<MainStackParamList, 'PostWrite'>;

/**
 * ⚠️ 중고거래 안내는 **지우지 말 것.**
 *    두 번째 줄은 등반 앱이 반드시 넣어야 할 안전 경고다 — 추락 하중을 받는 장비의
 *    이력을 모르는 중고 거래는 생명과 직결된다.
 */
const MARKET_NOTICE =
  '· 직거래를 권장합니다. 선입금을 요구하는 상대를 조심하세요.\n' +
  '· ⚠️ 로프·하네스·헬멧처럼 추락 하중을 받는 장비는 이력을 알 수 없는 중고 거래를 권하지 않습니다.';

const TRADE_TYPES: ReadonlyArray<{ key: TradeType; label: string }> = [
  { key: 'sell', label: '판매' },
  { key: 'exchange', label: '교환' },
  { key: 'give', label: '나눔' },
];

export const PostWriteScreen: React.FC = () => {
  const { colors, radius, spacing } = useTheme();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const { boardId, boardType, prefill } = params;

  const uid = useAuthStore((s) => s.user?.uid);
  const profile = useUserStore((s) => s.profile);
  // 프로필이 없으면 닉네임을 못 넣어 등록이 막힌다 (hooks/useEnsureProfile.ts 머리말)
  useEnsureProfile();

  const [images, setImages] = useState<string[]>([]);
  const [body, setBody] = useState('');
  const [mountain, setMountain] = useState(prefill?.mountain ?? '');
  const [zone, setZone] = useState(prefill?.zone ?? '');
  const [price, setPrice] = useState('');
  const [tradeType, setTradeType] = useState<TradeType>('sell');
  const [region, setRegion] = useState('');
  /* 파티 모집 — v2.2.0 */
  const [climbDate, setClimbDate] = useState('');
  const [capacity, setCapacity] = useState('');
  const [busy, setBusy] = useState(false);

  const pick = useCallback(async () => {
    const room = MAX_POST_IMAGES - images.length;
    if (room <= 0) {
      Alert.alert('사진은 최대 5장까지 올릴 수 있습니다.');
      return;
    }
    const res = await launchImageLibrary(libraryOptions(room));
    const picked = (res.assets ?? []).map((a) => a.uri).filter((u): u is string => !!u);
    if (picked.length > 0) {
      setImages((prev) => [...prev, ...picked].slice(0, MAX_POST_IMAGES));
    }
  }, [images.length]);

  const submit = useCallback(async () => {
    if (!uid) {
      Alert.alert('로그인이 필요합니다.');
      return;
    }
    if (!profile) {
      Alert.alert('잠시만요', '프로필을 불러오는 중입니다. 잠시 후 다시 눌러 주세요.');
      return;
    }
    if (!body.trim() && images.length === 0) {
      Alert.alert('사진이나 내용을 하나는 넣어 주세요.');
      return;
    }
    if (boardType === 'place' && !mountain.trim()) {
      Alert.alert('등반지를 입력해 주세요.');
      return;
    }
    /*
     * ⚠️ 파티 모집은 **날짜가 필수**다. 날짜가 없으면 지난 모집인지 알 수 없어
     *    목록이 금방 쓸모없어진다.
     */
    if (boardType === 'party' && !/^\d{4}-\d{1,2}-\d{1,2}$/.test(climbDate.trim())) {
      Alert.alert('등반 날짜를 YYYY-MM-DD 형식으로 입력해 주세요.');
      return;
    }
    /*
     * 금칙어 — 올리기 **전에** 막는다 (utils/profanity.ts).
     * ⚠️ 중고거래에서만 strict 를 켠다. 연락처·계좌를 본문에 적는 것이 선입금 사기의 첫 단계라
     *    거래 게시판에서는 막고, 자유게시판에서는 막을 이유가 없다.
     */
    /*
     * ⚠️ 파티 모집도 중고거래와 같이 strict 로 본다.
     *    "카톡 아이디 남겨주세요" 식으로 개인 연락처가 공개 글에 남으면 안 된다.
     */
    const clean = checkText(body, boardType === 'market' || boardType === 'party');
    if (!clean.ok) {
      Alert.alert('등록할 수 없습니다', clean.message);
      return;
    }
    setBusy(true);
    try {
      await createPost(
        {
          boardId,
          boardType,
          body: body.trim(),
          images,
          ...(boardType === 'place'
            ? { mountain: mountain.trim(), zone: zone.trim() || undefined }
            : {}),
          ...(prefill?.conceptId
            ? { conceptId: prefill.conceptId, conceptSource: prefill.conceptSource }
            : {}),
          ...(boardType === 'party'
            ? {
                climbAt: new Date(climbDate.trim()),
                capacity: capacity.trim() ? Number(capacity) : undefined,
                mountain: mountain.trim() || undefined,
              }
            : {}),
          ...(boardType === 'market'
            ? {
                price: tradeType === 'give' ? 0 : Number(price.replace(/[^0-9]/g, '')) || 0,
                tradeType,
                region: region.trim() || undefined,
              }
            : {}),
        },
        { uid, nickname: profile.nickname, photoUrl: profile.photoUrl },
      );
      navigation.goBack();
    } catch (e) {
      Alert.alert('등록 실패', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [
    uid, profile, body, images, boardId, boardType,
    mountain, zone, price, tradeType, region, climbDate, capacity, prefill, navigation,
  ]);

  const input = {
    borderColor: colors.divider,
    borderRadius: radius.sm,
    color: colors.textPrimary,
  };

  return (
    // ⚠️ 그냥 ScrollView 를 쓰면 안 된다. edge-to-edge 라 키보드가 떠도 창이 안 줄어서
    //    본문 입력칸이 키보드 뒤로 숨는다 (KeyboardAwareScroll.tsx 머리말).
    <KeyboardAwareScroll
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.md }}
    >
      {boardType === 'market' ? (
        <View
          style={[
            styles.notice,
            { backgroundColor: colors.surfaceVariant, borderRadius: radius.md },
          ]}
        >
          <Text variant="caption" color="textSecondary">
            {MARKET_NOTICE}
          </Text>
        </View>
      ) : null}

      {/* 사진 */}
      <View style={styles.photoRow}>
        {images.map((uri, i) => (
          <View key={`${i}-${uri}`}>
            <Image source={{ uri }} style={[styles.thumb, { borderRadius: radius.sm }]} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`사진 ${i + 1} 빼기`}
              onPress={() => setImages((prev) => prev.filter((_, n) => n !== i))}
              hitSlop={8}
              style={[styles.remove, { backgroundColor: colors.surface, borderRadius: radius.full }]}
            >
              <AppIcon name="x" size={13} color={colors.textPrimary} />
            </Pressable>
          </View>
        ))}
        {images.length < MAX_POST_IMAGES ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="사진 추가"
            onPress={() => void pick()}
            style={[
              styles.thumb,
              styles.addBtn,
              { borderColor: colors.divider, borderRadius: radius.sm },
            ]}
          >
            <AppIcon name="plus" size={22} color={colors.textSecondary} />
            <Text variant="caption" color="textSecondary">
              {images.length}/{MAX_POST_IMAGES}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {/* 본문 */}
      <TextInput
        value={body}
        onChangeText={setBody}
        placeholder="내용을 입력하세요"
        placeholderTextColor={colors.disabled}
        multiline
        maxLength={2000}
        style={[styles.body, input]}
      />

      {/* 등반지별 게시판 */}
      {boardType === 'place' ? (
        <>
          <Text variant="label" style={styles.label}>
            등반지 *
          </Text>
          <TextInput
            value={mountain}
            onChangeText={setMountain}
            placeholder="예: 북한산"
            placeholderTextColor={colors.disabled}
            style={[styles.line, input]}
          />
          <Text variant="label" style={styles.label}>
            구역
          </Text>
          <TextInput
            value={zone}
            onChangeText={setZone}
            placeholder="예: 인수봉"
            placeholderTextColor={colors.disabled}
            style={[styles.line, input]}
          />
        </>
      ) : null}

      {/* 파티 모집 게시판 */}
      {boardType === 'party' ? (
        <>
          <Text variant="label" style={styles.label}>
            등반 날짜 *
          </Text>
          <TextInput
            value={climbDate}
            onChangeText={setClimbDate}
            placeholder="2026-09-20"
            placeholderTextColor={colors.disabled}
            keyboardType="numbers-and-punctuation"
            style={[styles.line, input]}
          />
          <Text variant="label" style={styles.label}>
            등반지
          </Text>
          <TextInput
            value={mountain}
            onChangeText={setMountain}
            placeholder="예: 북한산 인수봉"
            placeholderTextColor={colors.disabled}
            style={[styles.line, input]}
          />
          <Text variant="label" style={styles.label}>
            모집 인원
          </Text>
          <TextInput
            value={capacity}
            onChangeText={setCapacity}
            placeholder="예: 2"
            placeholderTextColor={colors.disabled}
            keyboardType="number-pad"
            style={[styles.line, input]}
          />
          <Text variant="caption" color="textSecondary" style={styles.label}>
            ⚠️ 연락처는 본문에 적지 마세요. 댓글로 이야기하세요.
          </Text>
        </>
      ) : null}

      {/* 중고거래 게시판 */}
      {boardType === 'market' ? (
        <>
          <Text variant="label" style={styles.label}>
            거래 방식
          </Text>
          <View style={styles.chipRow}>
            {TRADE_TYPES.map((t) => {
              const on = tradeType === t.key;
              return (
                <Pressable
                  key={t.key}
                  onPress={() => setTradeType(t.key)}
                  style={[
                    styles.chip,
                    {
                      borderColor: on ? colors.primary : colors.divider,
                      borderRadius: radius.full,
                    },
                  ]}
                >
                  <Text variant="label" color={on ? 'primary' : 'textSecondary'}>
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {tradeType !== 'give' ? (
            <>
              <Text variant="label" style={styles.label}>
                가격
              </Text>
              <TextInput
                value={price}
                onChangeText={setPrice}
                placeholder="숫자만 (예: 50000)"
                placeholderTextColor={colors.disabled}
                keyboardType="number-pad"
                style={[styles.line, input]}
              />
            </>
          ) : null}

          <Text variant="label" style={styles.label}>
            지역
          </Text>
          <TextInput
            value={region}
            onChangeText={setRegion}
            placeholder="시/군/구까지만 (예: 서울 노원구)"
            placeholderTextColor={colors.disabled}
            maxLength={20}
            style={[styles.line, input]}
          />
          <Text variant="caption" color="disabled" style={styles.hint}>
            ⚠️ 상세 주소는 적지 마세요. 만나는 장소는 대화로 정하세요.
          </Text>
        </>
      ) : null}

      <Button
        title={busy ? '올리는 중…' : '올리기'}
        onPress={() => void submit()}
        disabled={busy}
        style={styles.submit}
      />
      {busy ? <ActivityIndicator style={styles.spinner} /> : null}
    </KeyboardAwareScroll>
  );
};

const styles = StyleSheet.create({
  notice: { padding: 12, marginBottom: 14 },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  thumb: { width: 84, height: 84 },
  addBtn: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, rowGap: 2 },
  remove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { minHeight: 140, borderWidth: 1, padding: 12, fontSize: 15, textAlignVertical: 'top' },
  label: { marginTop: 16, marginBottom: 6 },
  line: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  chipRow: { flexDirection: 'row', columnGap: 8 },
  chip: { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  hint: { marginTop: 6 },
  submit: { marginTop: 24 },
  spinner: { marginTop: 12 },
});
