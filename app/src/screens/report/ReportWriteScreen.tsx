/**
 * 루트제보 작성 — 웹 `views/ReportView.vue` 1:1 이식.
 *
 * 웹의 `/report`는 목록이 아니라 **작성 폼**이다. 앱도 탭을 누르면 바로 폼이 열린다.
 * (이전에는 `ReportListScreen` 플레이스홀더였다 — 파일은 보존, 탭 등록만 교체)
 *
 * 저장되는 필드·Storage 경로는 `services/reportService.ts`에서 웹과 1:1로 맞춘다.
 * 스키마 변경 없음(docs/02_DATA_MODEL.md).
 *
 * ── 웹과 다른 점 · 이유 ──────────────────────────────────────────────────
 *  - 등반지/구역: `<select>` 대신 공용 `PickerModal` + '직접 입력' (RN엔 select 없음,
 *    Picker 라이브러리는 iOS/안드로이드 UI가 완전히 달라 통일이 안 된다)
 *  - 사진 순서: 드래그 대신 좌/우 이동 버튼 (드래그는 네이티브 의존성 2개가 더 필요)
 *  - 좌표: '지도에서 선택'은 화면 중앙 십자선 방식 (손가락에 가리지 않는다)
 *  - **임시저장 / 임시저장 불러오기 버튼은 만들지 않았다.** 웹에도 버튼만 있고
 *    `saveDraft` / `showDraftList` 구현이 없다(눌러도 아무 일도 일어나지 않는 상태).
 *    [QUESTION] 실제로 필요한 기능인지 확인 후 양쪽에 같이 넣는 게 맞다.
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '../../components/common/Text';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { AppIcon } from '../../components/common/AppIcon';
import { PickerModal } from '../../components/common/PickerModal';
import { KeyboardAwareScroll } from '../../components/common/KeyboardAwareScroll';
import { useTheme } from '../../theme';
import { MAX_ROOT_IMAGES } from '../../types/routeReport';
import type { ConceptType } from '../../types/concept';
import { useReportForm, type ReportFormEditTarget } from './hooks/useReportForm';
import { ImageStrip } from './components/ImageStrip';
import { PitchEditor } from './components/PitchEditor';
import { CoordPickerModal } from './components/CoordPickerModal';
import { StoredImagePicker } from './components/StoredImagePicker';
import { useAuthStore } from '../../stores/authStore';
import { isAdminEmail } from '../../constants/admin';

const TYPES: readonly ConceptType[] = ['리드', '볼더링'];

interface ReportWriteScreenProps {
  /** 있으면 **수정 모드** (관리자 개념도 수정). 없으면 새 제보 */
  edit?: ReportFormEditTarget;
  /** 수정 저장 후 호출 (화면 닫기) */
  onSaved?: () => void;
}

export const ReportWriteScreen: React.FC<ReportWriteScreenProps> = ({ edit, onSaved }) => {
  const { colors, radius, spacing } = useTheme();
  const f = useReportForm(edit);
  const { form } = f;

  const [picker, setPicker] = useState<'mountain' | 'zone' | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [customMountain, setCustomMountain] = useState(false);
  const [customZone, setCustomZone] = useState(false);
  /** 기존 Storage 사진 붙이기 (관리자 복구용) */
  const [showStored, setShowStored] = useState(false);
  const isAdmin = isAdminEmail(useAuthStore((st) => st.user?.email));

  // 저장 성공 안내 (웹 alert('제보 저장 완료!') 대응)
  useEffect(() => {
    if (!f.savedAt) {
      return;
    }
    if (edit) {
      Alert.alert('수정 완료', '개념도가 수정되었습니다.');
      onSaved?.();
    } else {
      Alert.alert('제보 저장 완료', '관리자 승인 후 개념도와 지도에 표시됩니다.');
    }
  }, [edit, f.savedAt, onSaved]);

  const hasCoord = !!form.latitude && !!form.longitude;

  /**
   * 직접 입력한 좌표 검증.
   * 잘못된 값이 그대로 저장되면 지도에서 엉뚱한 곳(또는 아프리카 앞바다 0,0)에 찍힌다.
   */
  const coordError = (raw: string, max: number, label: string): string | null => {
    if (!raw.trim()) {
      return null;
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      return `${label}는 숫자로 입력해 주세요.`;
    }
    if (Math.abs(n) > max) {
      return `${label} 범위를 벗어났습니다 (-${max} ~ ${max}).`;
    }
    return null;
  };
  /**
   * 좌표 입력 정리 — 숫자·마이너스·점만, **소수점 이하 6자리까지**.
   * 6자리면 약 11cm 해상도라 암장 좌표엔 차고 넘친다.
   * 그 아래는 GPS 오차 범위라 의미가 없고, 자릿수만 늘면 클러스터링에서
   * 같은 바위가 다른 좌표로 갈라진다.
   */
  const sanitizeCoord = (raw: string): string => {
    let v = raw.replace(/[^0-9.-]/g, '');
    // 마이너스는 맨 앞에만
    v = (v.startsWith('-') ? '-' : '') + v.replace(/-/g, '');
    // 점은 하나만
    const firstDot = v.indexOf('.');
    if (firstDot >= 0) {
      v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, '');
      const [head, tail = ''] = v.split('.');
      v = tail.length > 6 ? `${head}.${tail.slice(0, 6)}` : v;
    }
    return v;
  };

  const latError = coordError(form.latitude, 90, '위도');
  const lngError = coordError(form.longitude, 180, '경도');
  const isLead = form.typeRoot === '리드';

  const selectRow = [
    styles.select,
    { borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  ];

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <KeyboardAwareScroll contentContainerStyle={{ padding: spacing.md }}>
        {/* 1. 타입 */}
        <View style={styles.typeRow}>
          {TYPES.map((t) => {
            const active = form.typeRoot === t;
            return (
              <Pressable
                key={t}
                accessibilityRole="button"
                onPress={() => f.selectType(t)}
                style={[
                  styles.typeBtn,
                  {
                    borderRadius: radius.md,
                    backgroundColor: active ? colors.primary : colors.surfaceVariant,
                  },
                ]}
              >
                <Text variant="title" color={active ? 'onPrimary' : 'textSecondary'}>
                  {t}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* 2. 등반지 */}
        <Text variant="label" color="textSecondary" style={styles.label}>
          등반지 *
        </Text>
        {customMountain ? (
          <Input
            placeholder="등반지 직접 입력"
            value={form.mountain}
            onChangeText={(v) => f.setMountain(v)}
            autoCorrect={false}
          />
        ) : (
          <Pressable accessibilityRole="button" onPress={() => setPicker('mountain')} style={selectRow}>
            <Text color={form.mountain ? 'textPrimary' : 'textSecondary'}>
              {form.mountain || (f.loadingLists ? '목록 불러오는 중…' : '등반지 선택')}
            </Text>
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          onPress={() => setCustomMountain((v) => !v)}
          hitSlop={6}
          style={styles.toggle}
        >
          <Text variant="caption" color="primary">
            {customMountain ? '목록에서 선택' : '직접 입력'}
          </Text>
        </Pressable>

        {/* 구역 */}
        <Text variant="label" color="textSecondary" style={styles.label}>
          구역
        </Text>
        {customZone || f.zones.length === 0 ? (
          <Input
            placeholder="구역 직접 입력"
            value={form.zone}
            onChangeText={(v) => f.setField('zone', v)}
            autoCorrect={false}
          />
        ) : (
          <Pressable accessibilityRole="button" onPress={() => setPicker('zone')} style={selectRow}>
            <Text color={form.zone ? 'textPrimary' : 'textSecondary'}>
              {form.zone || '구역 선택'}
            </Text>
          </Pressable>
        )}
        {f.zones.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setCustomZone((v) => !v)}
            hitSlop={6}
            style={styles.toggle}
          >
            <Text variant="caption" color="primary">
              {customZone ? '목록에서 선택' : '직접 입력'}
            </Text>
          </Pressable>
        ) : null}

        {/* 3. 대표 이미지 */}
        <Text variant="label" color="textSecondary" style={styles.label}>
          대표 사진 (최대 {MAX_ROOT_IMAGES}장)
        </Text>
        <ImageStrip
          images={form.images}
          max={MAX_ROOT_IMAGES}
          onAdd={f.addImages}
          onRemove={f.removeImage}
          onMove={f.moveImage}
        />

        {/*
          개념도를 지워도 Storage의 사진 파일은 남는다.
          루트를 다시 만들 때 다시 올리지 않고 그대로 붙일 수 있게 한다 (관리자 전용).
        */}
        {isAdmin && form.mountain.trim() && form.routeName.trim() ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowStored(true)}
            style={[styles.coordBtn, { borderColor: colors.border, borderRadius: radius.md }]}
          >
            <AppIcon name="download" size={17} color={colors.textSecondary} />
            <Text color="textSecondary">이 루트에 올라가 있던 기존 사진 불러오기</Text>
          </Pressable>
        ) : null}

        {/* 4. 좌표 */}
        <Text variant="label" color="textSecondary" style={styles.label}>
          위도 / 경도 *
        </Text>
        <View style={styles.coordRow}>
          <Pressable
            accessibilityRole="button"
            disabled={f.locating}
            onPress={f.useCurrentLocation}
            style={[
              styles.coordBtn,
              { borderColor: colors.primary, borderRadius: radius.md, opacity: f.locating ? 0.55 : 1 },
            ]}
          >
            <AppIcon name="locate" size={17} color={colors.primary} />
            <Text color="primary">{f.locating ? '위치 확인 중…' : '현재위치'}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowMap(true)}
            style={[styles.coordBtn, { borderColor: colors.primary, borderRadius: radius.md }]}
          >
            <AppIcon name="map" size={17} color={colors.primary} />
            <Text color="primary">지도에서 선택</Text>
          </Pressable>
        </View>

        {/*
          좌표 **직접 입력**도 허용한다 (2026-08-05 사용자 요청).
          웹 수정 화면(ConceptEditView)도 위도/경도를 직접 치게 돼 있다.
          현장에서 GPS가 안 잡히거나, 삭제된 루트를 예전 좌표로 되살릴 때 필요하다.
        */}
        <View style={styles.coordRow}>
          <View style={styles.flex}>
            <Input
              label="위도"
              placeholder="37.123456"
              value={form.latitude}
              onChangeText={(v) => f.setField('latitude', sanitizeCoord(v))}
              keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
              autoCorrect={false}
              error={latError}
            />
          </View>
          <View style={styles.flex}>
            <Input
              label="경도"
              placeholder="127.123456"
              value={form.longitude}
              onChangeText={(v) => f.setField('longitude', sanitizeCoord(v))}
              keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
              autoCorrect={false}
              error={lngError}
            />
          </View>
        </View>

        {f.locError ? (
          <Text variant="caption" color="error">
            {f.locError}
          </Text>
        ) : latError || lngError ? null : hasCoord ? (
          <Text variant="caption" color="success">
            좌표 지정됨 ({Number(form.latitude).toFixed(6)}, {Number(form.longitude).toFixed(6)})
          </Text>
        ) : (
          <Text variant="caption" color="error">
            * 직접 입력하거나 [현재위치] · [지도에서 선택]으로 지정해 주세요.
          </Text>
        )}

        {/* 5. GPX */}
        <Text variant="label" color="textSecondary" style={styles.label}>
          GPX 파일 (선택)
        </Text>
        <View style={styles.coordRow}>
          <Pressable
            accessibilityRole="button"
            onPress={f.pickGpx}
            style={[styles.coordBtn, { borderColor: colors.border, borderRadius: radius.md }]}
          >
            <AppIcon name="upload" size={17} color={colors.textSecondary} />
            <Text color="textSecondary">{form.gpxName ? '다른 파일 선택' : 'GPX 파일 선택'}</Text>
          </Pressable>
          {form.gpxName ? (
            <Pressable
              accessibilityRole="button"
              onPress={f.clearGpx}
              style={[styles.coordBtn, { borderColor: colors.border, borderRadius: radius.md, flex: 0, paddingHorizontal: 14 }]}
            >
              <AppIcon name="x" size={16} color={colors.error} />
            </Pressable>
          ) : null}
        </View>
        {form.gpxName ? (
          <Text variant="caption" color="textSecondary">
            선택된 파일: {form.gpxName}
          </Text>
        ) : null}

        {/* 6. 루트 이름 */}
        <View style={{ marginTop: spacing.md }}>
          <Input
            label="루트 이름 *"
            placeholder="루트 이름"
            value={form.routeName}
            onChangeText={(v) => f.setField('routeName', v)}
            autoCorrect={false}
          />
        </View>

        {/* 7. 타입별 상세 */}
        {isLead ? (
          <>
            <Input
              label="등반 개요"
              placeholder="등반 개요"
              value={form.overview}
              onChangeText={(v) => f.setField('overview', v)}
              multiline
            />
            <Input
              label="등반 형태"
              placeholder="등반 형태"
              value={form.type}
              onChangeText={(v) => f.setField('type', v)}
            />
            <Input
              label="등반 장비"
              placeholder="등반 장비"
              value={form.equipment}
              onChangeText={(v) => f.setField('equipment', v)}
            />
            <Input
              label="평균 난이도"
              placeholder="평균 난이도"
              value={form.avgDifficulty}
              onChangeText={(v) => f.setField('avgDifficulty', v)}
            />
            <Input
              label="기타 내용"
              placeholder="[기타내용]"
              value={form.pioneer}
              onChangeText={(v) => f.setField('pioneer', v)}
            />
            <PitchEditor
              pitches={form.pitches}
              onAdd={f.addPitch}
              onRemove={f.removePitch}
              onUpdate={f.updatePitch}
              onAddImages={f.addPitchImages}
              onRemoveImage={f.removePitchImage}
              onMoveImage={f.movePitchImage}
            />
          </>
        ) : (
          <>
            <Input
              label="바위 소개"
              placeholder="바위 소개"
              value={form.overview}
              onChangeText={(v) => f.setField('overview', v)}
              multiline
            />
            <Input
              label="찾아가는 길"
              placeholder="찾아가는 길"
              value={form.directions}
              onChangeText={(v) => f.setField('directions', v)}
              multiline
            />
            <Input
              label="번호"
              placeholder="번호"
              value={form.no}
              onChangeText={(v) => f.setField('no', v)}
            />
            <Input
              label="난이도"
              placeholder="난이도"
              value={form.difficulty}
              onChangeText={(v) => f.setField('difficulty', v)}
            />
          </>
        )}

        <Button
          title={f.saving ? '저장 중…' : edit ? '수정 저장' : '루트 제보 저장'}
          onPress={f.submit}
          loading={f.saving}
          disabled={f.saving || !!latError || !!lngError}
          size="lg"
          style={{ marginTop: spacing.lg }}
        />
        {f.saving ? (
          <View style={styles.savingRow}>
            <ActivityIndicator color={colors.primary} />
            <Text variant="caption" color="textSecondary">
              사진을 업로드하는 중입니다. 화면을 벗어나지 마세요.
            </Text>
          </View>
        ) : null}
      </KeyboardAwareScroll>

      <PickerModal
        visible={picker === 'mountain'}
        title="등반지 선택"
        options={f.mountains}
        value={form.mountain}
        allLabel="선택 안 함"
        onSelect={f.setMountain}
        onClose={() => setPicker(null)}
      />
      <PickerModal
        visible={picker === 'zone'}
        title="구역 선택"
        options={f.zones}
        value={form.zone}
        allLabel="선택 안 함"
        onSelect={(v) => f.setField('zone', v)}
        onClose={() => setPicker(null)}
      />
      <StoredImagePicker
        visible={showStored}
        mountain={form.mountain}
        zone={form.zone}
        routeName={form.routeName}
        existingUrls={form.images.map((i) => i.remoteUrl ?? i.uri)}
        onAdd={(imgs) =>
          f.setField('images', [...form.images, ...imgs].slice(0, MAX_ROOT_IMAGES))
        }
        onClose={() => setShowStored(false)}
      />

      <CoordPickerModal
        visible={showMap}
        initial={
          hasCoord
            ? { latitude: Number(form.latitude), longitude: Number(form.longitude) }
            : null
        }
        onPick={(c) => {
          f.setField('latitude', String(c.latitude));
          f.setField('longitude', String(c.longitude));
          setShowMap(false);
        }}
        onClose={() => setShowMap(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeBtn: { flex: 1, paddingVertical: 16, alignItems: 'center' },
  label: { marginTop: 18, marginBottom: 6 },
  select: { paddingHorizontal: 14, paddingVertical: 14, borderWidth: 1 },
  toggle: { alignSelf: 'flex-end', paddingVertical: 4 },
  coordRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  coordBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 6,
    paddingVertical: 11,
    borderWidth: 1,
  },
  savingRow: { flexDirection: 'row', alignItems: 'center', columnGap: 8, marginTop: 8 },
});
