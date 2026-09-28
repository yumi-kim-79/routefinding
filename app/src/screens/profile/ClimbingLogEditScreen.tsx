/**
 * 등반일지 작성/수정 화면 — v2 신규 (2026-08-04).
 *
 * 입력 항목은 사용자의 기존 스프레드시트와 1:1:
 *   날짜 / 장소 / 루트명 / 소요장비 / 등반 소요시간 / 참석자 / 등반내용 및 특이사항
 *
 * 설계 메모:
 *  · 날짜는 텍스트(YYYY-MM-DD) 입력이다. 네이티브 date picker를 쓰려면 의존성이
 *    하나 더 늘어나는데(@react-native-community/datetimepicker), 오늘 이미
 *    image-picker를 추가했으므로 여기서는 새 의존성 없이 간다. [TBD] 필요 시 교체.
 *  · 종료일은 "2018.05.05~06"처럼 1박 이상 기록이 실제로 있어 별도 필드로 둔다.
 *  · 소요시간은 "9시~16시" 같은 기존 표기를 살리려고 자유 문자열.
 *
 * v2.1.0 (2026-09-07): **사진 첨부**와 **공개 스위치** 추가.
 *  · 공개로 바꾸면 커뮤니티 '등반일지' 게시판에 글이 생긴다 —
 *    글을 만드는 것은 앱이 아니라 Cloud Function `syncPublicLog` 이다
 *    (services/climbingLogService.ts 머리말: 두 곳에 직접 쓰면 어긋난다).
 *  · **기본은 비공개**다. 기존 일지 수백 건이 갑자기 공개되면 안 된다.
 *
 * v2.2.0 (2026-09-07): **오른 루트**(완등 기록) 연결 추가.
 *  · 위치는 **날짜 바로 아래**다. 일지의 나머지 항목(장소·루트명)을
 *    이 선택으로 **자동으로 채우기** 때문에 먼저 나와야 한다.
 *  · 루트를 매번 검색하게 하지 않는다 — **내가 전에 완등한 루트**를 먼저 보여준다.
 *    같은 바위를 여러 번 가는 것이 실제 등반 패턴이다 (types/climbingLog.ts 머리말:
 *    "같은 루트를 여러 번 가는 경우가 실제로 많아").
 *  ⚠️ 완등은 일지 필드가 아니라 `sends` 컬렉션의 **별도 문서**다.
 *     하루에 5개를 오르면 일지는 1건인데 완등은 5건이라, 일지에 욱여넣으면
 *     "이 루트 완등 N명"을 영원히 못 만든다 (types/send.ts 머리말).
 *  ⚠️ 기존 자유 텍스트 `routeName` 은 **그대로 둔다.** 옛 일지 수백 건이 그 필드에 있다.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen } from '../../components/common/Screen';
import { Text } from '../../components/common/Text';
import { Input } from '../../components/common/Input';
import { KeyboardAwareScroll } from '../../components/common/KeyboardAwareScroll';
import { Button } from '../../components/common/Button';
import { AppIcon } from '../../components/common/AppIcon';
import { useTheme } from '../../theme';
import { libraryOptions } from '../../constants/image';
import { MAX_LOG_PHOTOS } from '../../types/climbingLog';
import { ConceptPicker } from '../../components/common/ConceptPicker';
import { addSend, subscribeMySends } from '../../services/sendService';
import { useUserStore } from '../../stores/userStore';
import { conceptDifficulty, conceptTitle, type Concept } from '../../types/concept';
import { STYLE_LABEL, SEND_STYLES, type Send, type SendStyle } from '../../types/send';
import { useAuthStore } from '../../stores/authStore';
import {
  createClimbingLog,
  updateClimbingLog,
} from '../../services/climbingLogService';
import type { ConceptSource } from '../../types/concept';
import type { MainStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList, 'ClimbingLogEdit'>;
type Rt = RouteProp<MainStackParamList, 'ClimbingLogEdit'>;

/** 'YYYY-MM-DD' → Date (로컬 자정). 형식이 틀리면 null. */
function parseDate(v: string): Date | null {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(v.trim());
  if (!m) {
    return null;
  }
  const [, y, mo, d] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d));
  // 2026-02-31 같은 값 걸러내기
  if (
    date.getFullYear() !== Number(y) ||
    date.getMonth() !== Number(mo) - 1 ||
    date.getDate() !== Number(d)
  ) {
    return null;
  }
  return date;
}

function todayInput(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const ClimbingLogEditScreen: React.FC = () => {
  const { colors, radius, spacing } = useTheme();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const uid = useAuthStore((s) => s.user?.uid);

  const initial = params?.initial;
  const isEdit = !!params?.logId;

  const [date, setDate] = useState(initial?.date || todayInput());
  const [endDate, setEndDate] = useState(initial?.endDate ?? '');
  const [place, setPlace] = useState(initial?.place ?? '');
  const [routeName, setRouteName] = useState(initial?.routeName ?? '');
  const [gear, setGear] = useState(initial?.gear ?? '');
  const [duration, setDuration] = useState(initial?.duration ?? '');
  const [partners, setPartners] = useState(initial?.partners ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [photos, setPhotos] = useState<string[]>(initial?.photoUrls ?? []);
  /*
   * ⚠️ **새 일지는 기본 공개**다 (2026-09-07 사용자 결정).
   *    기존 일지가 저절로 공개되는 사고는 여전히 없다 — 수정할 때는
   *    저장돼 있던 값을 그대로 쓰기 때문이다(아래 isEdit 분기).
   */
  const [isPublic, setIsPublic] = useState(isEdit ? initial?.isPublic === true : true);

  const pickPhoto = async () => {
    const room = MAX_LOG_PHOTOS - photos.length;
    if (room <= 0) {
      return;
    }
    const res = await launchImageLibrary(libraryOptions(room));
    const picked = (res.assets ?? []).map((a) => a.uri).filter((u): u is string => !!u);
    if (picked.length > 0) {
      setPhotos((prev) => [...prev, ...picked].slice(0, MAX_LOG_PHOTOS));
    }
  };

  /*
   * 오른 루트 — 저장할 때 `sends` 문서로 같이 만들어진다.
   * ⚠️ 수정 모드에서는 넣지 않는다. 이미 만든 완등을 또 만들면 중복이 된다 —
   *    기존 완등은 개념도 상세에서 지우거나 고친다.
   */
  const [picked, setPicked] = useState<{ concept: Concept; style: SendStyle }[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const profile = useUserStore((st) => st.profile);

  /**
   * 내가 전에 완등한 루트 — 매번 검색하지 않아도 되게 바로 고르게 한다.
   * ⚠️ 같은 루트를 여러 번 완등할 수 있으므로 **루트 단위로 중복을 없앤다.**
   */
  const [mySends, setMySends] = useState<Send[]>([]);
  useEffect(() => {
    if (!uid) {
      return;
    }
    return subscribeMySends(uid, setMySends);
  }, [uid]);

  const recentRoutes = useMemo(() => {
    const seen = new Map<string, Send>();
    mySends.forEach((sd) => {
      if (!seen.has(sd.conceptId)) {
        seen.set(sd.conceptId, sd);
      }
    });
    return [...seen.values()].slice(0, 12);
  }, [mySends]);

  /**
   * 루트를 담으면 **일지의 빈 칸을 대신 채운다.**
   * ⚠️ 이미 사용자가 적어 둔 값은 절대 덮어쓰지 않는다 —
   *    두 번째 루트를 담았다고 첫 루트로 적어 둔 내용이 사라지면 안 된다.
   */
  const addRoute = useCallback((c: Concept) => {
    setPicked((prev) =>
      prev.some((x) => x.concept.id === c.id)
        ? prev
        : [...prev, { concept: c, style: 'redpoint' as SendStyle }],
    );

    const where = [c.mountain, c.zone].filter(Boolean).join(' ');
    setPlace((v) => (v.trim() ? v : where));

    const grade = conceptDifficulty(c);
    const label = [c.routeName, grade].filter(Boolean).join(' ');
    setRouteName((v) => (v.trim() ? v : label));

    if (c.equipment?.trim()) {
      setGear((v) => (v.trim() ? v : c.equipment ?? ''));
    }
  }, []);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSave = async () => {
    setError(null);

    const climbedAt = parseDate(date);
    if (!climbedAt) {
      setError('날짜를 YYYY-MM-DD 형식으로 입력해 주세요. (예: 2026-08-04)');
      return;
    }
    if (endDate.trim() && !parseDate(endDate)) {
      setError('종료일 형식이 올바르지 않습니다. (예: 2026-08-05)');
      return;
    }
    if (!place.trim()) {
      setError('장소를 입력해 주세요.');
      return;
    }
    if (!uid) {
      setError('로그인이 필요합니다.');
      return;
    }

    const input = {
      climbedAt,
      endedAt: endDate.trim() ? parseDate(endDate) : null,
      place,
      routeName,
      gear,
      duration,
      partners,
      notes,
      isPublic,
      photos,
      conceptId: initial?.conceptId,
      conceptSource: initial?.conceptSource as ConceptSource | '' | undefined,
    };

    setSaving(true);
    try {
      if (isEdit && params?.logId) {
        await updateClimbingLog(uid, params.logId, input);
      } else {
        await createClimbingLog(uid, input);
      }

      /*
       * 오른 루트를 완등 기록으로 남긴다.
       * ⚠️ 하나가 실패해도 **일지 저장은 이미 끝났다.** 전부 되돌리지 않고
       *    실패한 것만 알려준다 — 여기서 예외를 던지면 일지까지 실패한 것처럼 보인다.
       */
      /*
       * ⚠️ 예전엔 `picked.length > 0 && profile` 이라, 프로필이 아직이면
       *    담아 둔 루트가 **조용히 사라졌다.** 사용자는 완등이 남은 줄 안다.
       *    이제는 알려 주고, 개념도에서 다시 남길 수 있게 한다.
       */
      if (picked.length > 0 && !profile) {
        Alert.alert(
          '완등 기록만 못 남겼습니다',
          '프로필을 아직 못 불러왔습니다. 일지는 저장됐으니 개념도에서 완등을 남겨 주세요.',
        );
      }
      if (picked.length > 0 && profile) {
        const failed: string[] = [];
        for (const p of picked) {
          try {
            await addSend(
              p.concept,
              { style: p.style, climbedAt, isPublic: true },
              { uid, nickname: profile.nickname, photoUrl: profile.photoUrl },
            );
          } catch {
            failed.push(p.concept.routeName ?? '이름 없음');
          }
        }
        if (failed.length > 0) {
          Alert.alert('일부 완등 기록 실패', `${failed.join(', ')}\n개념도에서 다시 남겨 주세요.`);
        }
      }

      navigation.goBack();
    } catch (e) {
      setError(
        `저장 실패: ${e instanceof Error ? e.message : e}\n(firestore.rules 배포가 필요할 수 있습니다)`,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen padded={false}>
      <KeyboardAwareScroll contentContainerStyle={{ padding: spacing.md }}>
          <Text variant="headline" style={styles.heading}>
            {isEdit ? '등반일지 수정' : '등반일지 작성'}
          </Text>

          <Input
            label="날짜 *"
            value={date}
            onChangeText={setDate}
            placeholder="2026-08-04"
            keyboardType="numbers-and-punctuation"
          />
          <Input
            label="종료일 (여러 날이면)"
            value={endDate}
            onChangeText={setEndDate}
            placeholder="2026-08-05"
            keyboardType="numbers-and-punctuation"
          />
          {/*
            오른 루트 — 수정 모드에서는 숨긴다 (위 머리말: 중복 생성 방지)
          */}
          {!isEdit ? (
            <>
              <Text variant="label" color="textSecondary" style={styles.photoLabel}>
                오른 루트 (완등 기록)
              </Text>
              {picked.map((p, i) => (
                <View
                  key={`${p.concept.id}-${i}`}
                  style={[styles.sendRow, { borderColor: colors.divider, borderRadius: radius.md }]}
                >
                  <View style={styles.sendBody}>
                    <Text variant="body" numberOfLines={1}>
                      {conceptTitle(p.concept)}
                      {conceptDifficulty(p.concept) ? ` · ${conceptDifficulty(p.concept)}` : ''}
                    </Text>
                    <View style={styles.styleRow}>
                      {SEND_STYLES.map((st) => (
                        <Pressable
                          key={st}
                          onPress={() =>
                            setPicked((prev) =>
                              prev.map((x, n) => (n === i ? { ...x, style: st } : x)),
                            )
                          }
                          style={[
                            styles.styleChip,
                            {
                              borderRadius: radius.full,
                              borderColor: p.style === st ? colors.primary : colors.border,
                            },
                          ]}
                        >
                          <Text
                            variant="caption"
                            color={p.style === st ? 'primary' : 'textSecondary'}
                          >
                            {STYLE_LABEL[st]}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                  <Pressable
                    onPress={() => setPicked((prev) => prev.filter((_, n) => n !== i))}
                    hitSlop={8}
                  >
                    <AppIcon name="x" size={15} color={colors.textSecondary} />
                  </Pressable>
                </View>
              ))}
              {/*
                내가 전에 완등한 루트 — 매번 검색하지 않게 바로 고르게 한다.
                ⚠️ 이미 담은 것은 흐리게 두되 목록에서 빼지 않는다.
                   갑자기 사라지면 "방금 그거 어디 갔지?" 가 된다.
              */}
              {recentRoutes.length > 0 ? (
                <>
                  <Text variant="caption" color="disabled">
                    전에 완등한 루트에서 고르기
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.recentRow}
                  >
                    {recentRoutes.map((sd) => {
                      const already = picked.some((p) => p.concept.id === sd.conceptId);
                      return (
                        <Pressable
                          key={sd.conceptId}
                          disabled={already}
                          onPress={() =>
                            addRoute({
                              // Send 에 담긴 값만으로 완등을 다시 남기기에 충분하다
                              id: sd.conceptId,
                              source: sd.conceptSource,
                              type: sd.conceptSource === 'bouldering_reports' ? '볼더링' : '리드',
                              mountain: sd.mountain,
                              zone: sd.zone,
                              routeName: sd.routeName,
                              difficulty: sd.difficulty,
                            })
                          }
                          style={[
                            styles.styleChip,
                            {
                              borderRadius: radius.full,
                              borderColor: colors.border,
                              opacity: already ? 0.4 : 1,
                              marginRight: 8,
                            },
                          ]}
                        >
                          <Text variant="caption">
                            {sd.routeName || '이름 없음'}
                            {sd.difficulty ? ` ${sd.difficulty}` : ''}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </>
              ) : null}

              <Button
                title="+ 다른 루트 찾기"
                size="sm"
                variant="secondary"
                onPress={() => setPickerOpen(true)}
                style={styles.addRoute}
              />
              <Text variant="caption" color="disabled" style={styles.hint}>
                루트를 담으면 장소·루트명이 자동으로 채워지고, 완등 기록으로도 남습니다.
              </Text>
            </>
          ) : null}

          <Input
            label="장소 *"
            value={place}
            onChangeText={setPlace}
            placeholder="예) 북한산 노적봉"
          />
          <Input
            label="루트명"
            value={routeName}
            onChangeText={setRouteName}
            placeholder="예) 불장난길 4피치 / 부활의 꿈길 2피치"
            multiline
          />
          <Input
            label="소요장비"
            value={gear}
            onChangeText={setGear}
            placeholder="예) 퀵드로 12개, 캠1셋트"
          />
          <Input
            label="등반 소요시간"
            value={duration}
            onChangeText={setDuration}
            placeholder="예) 9시~16시"
          />
          <Input
            label="참석자"
            value={partners}
            onChangeText={setPartners}
            placeholder="함께 등반한 사람"
          />
          <Input
            label="등반내용 및 특이사항"
            value={notes}
            onChangeText={setNotes}
            placeholder="예) 첫 멀티등반 정상등반 완료"
            multiline
          />

          {/* 사진 */}
          <Text variant="label" color="textSecondary" style={styles.photoLabel}>
            사진 (최대 {MAX_LOG_PHOTOS}장)
          </Text>
          <View style={styles.photoRow}>
            {photos.map((uri, i) => (
              <View key={`${i}-${uri}`}>
                <Image source={{ uri }} style={[styles.thumb, { borderRadius: radius.sm }]} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`사진 ${i + 1} 빼기`}
                  onPress={() => setPhotos((prev) => prev.filter((_, n) => n !== i))}
                  hitSlop={8}
                  style={[
                    styles.remove,
                    { backgroundColor: colors.surface, borderRadius: radius.full },
                  ]}
                >
                  <AppIcon name="x" size={13} color={colors.textPrimary} />
                </Pressable>
              </View>
            ))}
            {photos.length < MAX_LOG_PHOTOS ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="사진 추가"
                onPress={() => void pickPhoto()}
                style={[
                  styles.thumb,
                  styles.addBtn,
                  { borderColor: colors.divider, borderRadius: radius.sm },
                ]}
              >
                <AppIcon name="plus" size={22} color={colors.textSecondary} />
                <Text variant="caption" color="textSecondary">
                  {photos.length}/{MAX_LOG_PHOTOS}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {/*
            공개 스위치.
            ⚠️ 기본은 비공개다. 켜야만 커뮤니티에 올라간다 —
               기존 일지가 저절로 공개되는 일은 없다.
          */}
          <View
            style={[
              styles.publicRow,
              { borderColor: colors.divider, borderRadius: radius.md },
            ]}
          >
            <View style={styles.publicText}>
              <Text variant="label">커뮤니티에 공개</Text>
              <Text variant="caption" color="textSecondary">
                {isPublic
                  ? '커뮤니티 ▸ 등반일지 게시판에 올라갑니다. 언제든 끌 수 있습니다.'
                  : '나만 봅니다. 켜면 커뮤니티 등반일지 게시판에 올라갑니다.'}
              </Text>
            </View>
            <Switch value={isPublic} onValueChange={setIsPublic} />
          </View>

          {error ? (
            <Text variant="caption" color="error" style={styles.error}>
              {error}
            </Text>
          ) : null}

          <View style={styles.actions}>
            <Button
              title="취소"
              variant="ghost"
              onPress={() => navigation.goBack()}
              disabled={saving}
              style={styles.action}
            />
            <Button
              title="저장"
              onPress={onSave}
              loading={saving}
              style={styles.action}
            />
          </View>
      </KeyboardAwareScroll>

      <ConceptPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(c) => {
          addRoute(c);
          setPickerOpen(false);
        }}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  heading: { marginBottom: 16 },
  photoLabel: { marginTop: 4, marginBottom: 6 },
  sendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 10,
    borderWidth: 1,
    padding: 10,
    marginBottom: 8,
  },
  sendBody: { flex: 1, rowGap: 6 },
  styleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  styleChip: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  addRoute: { alignSelf: 'flex-start' },
  recentRow: { marginBottom: 8 },
  hint: { marginTop: 6, marginBottom: 10 },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  thumb: { width: 78, height: 78 },
  addBtn: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, rowGap: 2 },
  remove: { position: 'absolute', top: -6, right: -6, padding: 3 },
  publicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 14,
  },
  publicText: { flex: 1, rowGap: 2 },
  error: { marginBottom: 12 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  action: { flex: 1 },
});
