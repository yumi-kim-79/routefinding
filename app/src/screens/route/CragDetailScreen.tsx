/**
 * 암장 정보 화면 — 접근·주차·대중교통·현장 시설.
 *
 * ⚠️ 이 정보는 **개념도보다 먼저 찾는다.** 어디에 대고 어떻게 올라가는지를 모르면
 *    개념도가 있어도 못 간다 (경쟁 분석 2순위).
 * ⚠️ 값이 없는 항목은 **아예 그리지 않는다.** '주차: -' 가 줄줄이 있으면
 *    "정보가 없는 앱"으로 읽힌다.
 * ⚠️ 편집은 **로그인한 사용자면 누구나** 할 수 있다 (2026-09-07 정책).
 *    제보를 승인 없이 바로 올리기로 한 결정과 같은 방향이다 —
 *    관리자 혼자 967개 구역을 채울 수는 없다.
 *    누가 무엇을 바꿨는지는 `crags/{id}/edits` 에 남는다 (services/cragService.ts).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, TextInput, View } from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen } from '../../components/common/Screen';
import { Text } from '../../components/common/Text';
import { Button } from '../../components/common/Button';
import { KeyboardAwareScroll } from '../../components/common/KeyboardAwareScroll';
import { useTheme } from '../../theme';
import { useAuthStore } from '../../stores/authStore';
import { useUserStore } from '../../stores/userStore';
import { saveCrag, subscribeCrag } from '../../services/cragService';
import { ClosureBanner } from './components/ClosureNotice';
import { effectiveClosure } from '../../types/closure';
import {
  APPROACH_LEVELS,
  SEASONS,
  cragDisplayName,
  type ApproachLevel,
  type Crag,
} from '../../types/crag';
import type { MainStackParamList } from '../../navigation/types';

type Rt = RouteProp<MainStackParamList, 'CragDetail'>;
type Nav = NativeStackNavigationProp<MainStackParamList>;

const Row: React.FC<{ label: string; value?: string }> = ({ label, value }) => {
  const { colors } = useTheme();
  if (!value?.trim()) {
    return null; // 위 머리말: 빈 항목은 그리지 않는다
  }
  return (
    <View style={[styles.row, { borderBottomColor: colors.divider }]}>
      <Text variant="label" color="textSecondary" style={styles.rowLabel}>
        {label}
      </Text>
      <Text variant="body" style={styles.rowValue}>
        {value}
      </Text>
    </View>
  );
};

export const CragDetailScreen: React.FC = () => {
  const { colors, radius, spacing } = useTheme();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const { mountain, zone, latitude, longitude } = params;

  const uid = useAuthStore((s) => s.user?.uid);
  const profile = useUserStore((s) => s.profile);

  const [crag, setCrag] = useState<Crag | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // 편집 상태
  const [form, setForm] = useState<Partial<Crag>>({});

  useEffect(
    () =>
      subscribeCrag(mountain, zone, (c) => {
        setCrag(c);
        setForm(c ?? {});
      }),
    [mountain, zone],
  );

  const openMap = useCallback(() => {
    const lat = crag?.latitude ?? latitude;
    const lng = crag?.longitude ?? longitude;
    if (lat === undefined || lng === undefined) {
      Alert.alert('좌표가 없습니다.');
      return;
    }
    // ⚠️ 카카오맵이 없는 기기가 있다 — 실패하면 구글 지도로 넘어간다
    const kakao = `kakaomap://look?p=${lat},${lng}`;
    void Linking.openURL(kakao).catch(() =>
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`),
    );
  }, [crag, latitude, longitude]);

  const save = useCallback(async () => {
    if (!uid) {
      return;
    }
    setSaving(true);
    try {
      await saveCrag(
        mountain,
        zone ?? '',
        {
          description: form.description,
          approachLevel: form.approachLevel,
          approachText: form.approachText,
          approachMin: form.approachMin,
          parking: form.parking,
          transit: form.transit,
          sun: form.sun,
          seasons: form.seasons,
          toilet: form.toilet === true,
          water: form.water === true,
          notice: form.notice,
        },
        { uid, nickname: profile?.nickname ?? '' },
        latitude !== undefined && longitude !== undefined ? { latitude, longitude } : undefined,
      );
      setEditing(false);
    } catch (e) {
      Alert.alert('저장 실패', e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [uid, mountain, zone, form, profile, latitude, longitude]);

  const input = {
    borderColor: colors.divider,
    borderRadius: radius.sm,
    color: colors.textPrimary,
  };

  const title = cragDisplayName(mountain, zone);

  const cragClosure = effectiveClosure(null, crag?.closure, { cragName: title });

  return (
    <Screen padded={false}>
      <KeyboardAwareScroll contentContainerStyle={{ padding: spacing.md }}>
        <Text variant="headline">{title}</Text>

        {/*
          ⛔ 구역 폐쇄 — 경고(notice)보다도 위. 여기는 **가기 전에 접근 정보를 보는 화면**이라
             닫혀 있다는 사실을 가장 먼저 알아야 한다.
        */}
        {cragClosure ? <ClosureBanner closure={cragClosure} /> : null}

        {/* ⚠️ 경고는 무조건 맨 위. 등반 금지·낙석은 늦게 보면 의미가 없다 */}
        {crag?.notice ? (
          <View
            style={[
              styles.notice,
              { backgroundColor: colors.error, borderRadius: radius.md, padding: spacing.sm },
            ]}
          >
            <Text variant="label" color="onPrimary">
              ⚠️ {crag.notice}
            </Text>
          </View>
        ) : null}

        {!editing ? (
          <>
            {crag?.description ? (
              <Text variant="body" style={styles.desc}>
                {crag.description}
              </Text>
            ) : null}

            <Button title="지도에서 보기" variant="secondary" onPress={openMap} style={styles.mapBtn} />

            {crag ? (
              <View style={styles.table}>
                <Row label="접근 난이도" value={crag.approachLevel} />
                <Row
                  label="접근 시간"
                  value={crag.approachMin ? `약 ${crag.approachMin}분` : undefined}
                />
                <Row label="접근 방법" value={crag.approachText} />
                <Row label="주차" value={crag.parking} />
                <Row label="대중교통" value={crag.transit} />
                <Row label="일조" value={crag.sun} />
                <Row label="추천 시즌" value={crag.seasons?.join(', ')} />
                <Row label="화장실" value={crag.toilet ? '있음' : undefined} />
                <Row label="식수" value={crag.water ? '있음' : undefined} />
                <Row label="정보 기여" value={crag.contributors?.join(', ') ?? crag.updatedBy} />
              </View>
            ) : (
              <Text variant="body" color="textSecondary" style={styles.empty}>
                아직 이 암장의 접근 정보가 없습니다.
                {uid ? '\n아래 버튼으로 채워 주세요.' : ''}
              </Text>
            )}

            {uid ? (
              <Button
                title={crag ? '정보 수정' : '정보 입력'}
                onPress={() => setEditing(true)}
                style={styles.mapBtn}
              />
            ) : null}
            <Text variant="caption" color="disabled" style={styles.openHint}>
              {uid
                ? '클라이머라면 누구나 이 정보를 채울 수 있습니다. 바꾼 내용은 기록에 남습니다.'
                : '로그인하면 이 정보를 채울 수 있습니다.'}
            </Text>
          </>
        ) : (
          <View style={styles.form}>
            <Text variant="label">바위 소개</Text>
            <TextInput
              value={form.description ?? ''}
              onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
              multiline
              placeholder="어떤 바위인지 한두 문장"
              placeholderTextColor={colors.disabled}
              style={[styles.input, styles.multiline, input]}
            />

            <Text variant="label">접근 난이도</Text>
            <View style={styles.chips}>
              {APPROACH_LEVELS.map((lv) => (
                <Pressable
                  key={lv}
                  onPress={() =>
                    setForm((f) => ({
                      ...f,
                      approachLevel: f.approachLevel === lv ? undefined : (lv as ApproachLevel),
                    }))
                  }
                  style={[
                    styles.chip,
                    {
                      borderRadius: radius.full,
                      borderColor: form.approachLevel === lv ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    variant="caption"
                    color={form.approachLevel === lv ? 'primary' : 'textSecondary'}
                  >
                    {lv}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text variant="label">접근 소요 (분)</Text>
            <TextInput
              value={form.approachMin ? String(form.approachMin) : ''}
              onChangeText={(v) =>
                setForm((f) => ({ ...f, approachMin: v.trim() ? Number(v) : undefined }))
              }
              keyboardType="number-pad"
              placeholder="예) 25"
              placeholderTextColor={colors.disabled}
              style={[styles.input, input]}
            />

            <Text variant="label">접근 방법</Text>
            <TextInput
              value={form.approachText ?? ''}
              onChangeText={(v) => setForm((f) => ({ ...f, approachText: v }))}
              multiline
              placeholder="주차장 → 등산로 → …"
              placeholderTextColor={colors.disabled}
              style={[styles.input, styles.multiline, input]}
            />

            <Text variant="label">주차</Text>
            <TextInput
              value={form.parking ?? ''}
              onChangeText={(v) => setForm((f) => ({ ...f, parking: v }))}
              placeholder="예) 군포중앙도서관 주차장"
              placeholderTextColor={colors.disabled}
              style={[styles.input, input]}
            />

            <Text variant="label">대중교통</Text>
            <TextInput
              value={form.transit ?? ''}
              onChangeText={(v) => setForm((f) => ({ ...f, transit: v }))}
              multiline
              placeholder="예) 금정역 6번 출구 → 2번 버스"
              placeholderTextColor={colors.disabled}
              style={[styles.input, styles.multiline, input]}
            />

            <Text variant="label">일조</Text>
            <TextInput
              value={form.sun ?? ''}
              onChangeText={(v) => setForm((f) => ({ ...f, sun: v }))}
              placeholder="예) 부분 일조 (오후 그늘)"
              placeholderTextColor={colors.disabled}
              style={[styles.input, input]}
            />

            <Text variant="label">추천 시즌</Text>
            <View style={styles.chips}>
              {SEASONS.map((sea) => {
                const on = form.seasons?.includes(sea) === true;
                return (
                  <Pressable
                    key={sea}
                    onPress={() =>
                      setForm((f) => ({
                        ...f,
                        seasons: on
                          ? (f.seasons ?? []).filter((x) => x !== sea)
                          : [...(f.seasons ?? []), sea],
                      }))
                    }
                    style={[
                      styles.chip,
                      { borderRadius: radius.full, borderColor: on ? colors.primary : colors.border },
                    ]}
                  >
                    <Text variant="caption" color={on ? 'primary' : 'textSecondary'}>
                      {sea}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.chips}>
              {(
                [
                  ['toilet', '화장실 있음'],
                  ['water', '식수 있음'],
                ] as const
              ).map(([key, label]) => (
                <Pressable
                  key={key}
                  onPress={() => setForm((f) => ({ ...f, [key]: f[key] !== true }))}
                  style={[
                    styles.chip,
                    {
                      borderRadius: radius.full,
                      borderColor: form[key] === true ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text variant="caption" color={form[key] === true ? 'primary' : 'textSecondary'}>
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text variant="label">⚠️ 경고 (등반 금지·낙석 등)</Text>
            <TextInput
              value={form.notice ?? ''}
              onChangeText={(v) => setForm((f) => ({ ...f, notice: v }))}
              placeholder="비워 두면 표시되지 않습니다"
              placeholderTextColor={colors.disabled}
              style={[styles.input, input]}
            />

            <View style={styles.actions}>
              <Button
                title="취소"
                variant="ghost"
                onPress={() => {
                  setForm(crag ?? {});
                  setEditing(false);
                }}
                style={styles.action}
              />
              <Button title="저장" onPress={() => void save()} loading={saving} style={styles.action} />
            </View>
          </View>
        )}

        <Button
          title="이 암장의 루트 보기"
          variant="ghost"
          onPress={() => navigation.goBack()}
          style={styles.mapBtn}
        />
      </KeyboardAwareScroll>
    </Screen>
  );
};

const styles = StyleSheet.create({
  notice: { marginTop: 12 },
  desc: { marginTop: 12, lineHeight: 22 },
  mapBtn: { marginTop: 14 },
  table: { marginTop: 14 },
  row: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  rowLabel: { width: 96 },
  rowValue: { flex: 1 },
  empty: { marginTop: 20 },
  openHint: { marginTop: 8 },
  form: { marginTop: 14, rowGap: 6 },
  input: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  multiline: { minHeight: 66, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  chip: { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 7 },
  actions: { flexDirection: 'row', columnGap: 8, marginTop: 16 },
  action: { flex: 1 },
});
