/**
 * 개념도 상세 — 사진(캐러셀 → 탭하면 전체화면) + 기본 정보 + 피치 목록.
 *
 * v1 웹 ConceptDetailView.vue 대비 리뉴얼 시 제외한 것 (단순화 결정, 2026-08-03):
 *   - 고도 프로필 / GPX 붙여넣기·공유
 *   - 어프로치 **실시간 기록(GPS 따라가기)** — 배터리·정확도 문제로 v2에서 제거
 * 다만 첨부된 **GPX는 여기서 지도로 볼 수 있다** (2026-08-05).
 *   첨부만 되고 볼 수 없으면 첨부의 의미가 없어서다 → `components/ApproachMapModal.tsx`.
 * 라인(선) 그리기·개념도 추가는 다음 단계(P1) — 이 화면이 그 뷰어 기반이 된다.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { doc, getDoc } from '@react-native-firebase/firestore';
import { db } from '../../services/firebase';
import { Text } from '../../components/common/Text';
import { RemoteImage } from '../../components/common/RemoteImage';
import { Button } from '../../components/common/Button';
import { AdBanner } from '../../components/common/AdBanner';
import { ConceptPhotoStrip } from './components/ConceptPhotoStrip';
import { useFavorites } from './hooks/useFavorites';
import { useTheme } from '../../theme';
import { formatDate } from '../../utils/date';
import {
  conceptImages,
  conceptTitle,
  type Concept,
  type ConceptSource,
  type ConceptType,
} from '../../types/concept';
import type { MainStackParamList } from '../../navigation/types';
import { ConceptImageViewer } from './components/ConceptImageViewer';
import { ApproachMapModal } from './components/ApproachMapModal';

type Nav = NativeStackNavigationProp<MainStackParamList, 'ConceptDetail'>;
type Rt = RouteProp<MainStackParamList, 'ConceptDetail'>;

type LoadState =
  | { state: 'loading' }
  | { state: 'ready'; concept: Concept }
  | { state: 'missing' }
  | { state: 'error'; message: string };

/** 라벨 : 값 한 줄 */
const InfoRow: React.FC<{ label: string; value?: string | number }> = ({
  label,
  value,
}) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return (
    <View style={styles.infoRow}>
      <Text variant="label" color="textSecondary" style={styles.infoLabel}>
        {label}
      </Text>
      <Text variant="body" style={styles.infoValue}>
        {String(value)}
      </Text>
    </View>
  );
};

export const ConceptDetailScreen: React.FC = () => {
  const { colors, radius, spacing } = useTheme();
  const { width } = useWindowDimensions();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();

  const [load, setLoad] = useState<LoadState>({ state: 'loading' });
  const [viewer, setViewer] = useState<{ open: boolean; index: number }>({
    open: false,
    index: 0,
  });
  const [approachOpen, setApproachOpen] = useState(false);
  const favorites = useFavorites();
  /**
   * 수정 화면에서 돌아오면 다시 읽는다.
   * (Firestore 오프라인 캐시 때문에 화면이 그대로 남아 **수정 전 사진이 보이던 문제**, 2026-08-05)
   */
  const [reloadKey, setReloadKey] = useState(0);
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      setReloadKey((k) => k + 1);
    }, []),
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // source가 넘어오면 그 컬렉션만, 없으면 두 곳을 순서대로 시도(딥링크 대비)
      const candidates: ConceptSource[] = params.source
        ? [params.source]
        : ['route_reports', 'bouldering_reports'];

      let lastError: string | null = null;
      for (const source of candidates) {
        try {
          const snap = await getDoc(doc(db, source, params.conceptId));
          if (cancelled) {
            return;
          }
          if (snap.exists()) {
            const data = (snap.data() ?? {}) as Record<string, unknown>;
            const typeRoot = data.typeRoot;
            const type: ConceptType =
              typeRoot === '리드' || typeRoot === '볼더링'
                ? typeRoot
                : source === 'route_reports'
                  ? '리드'
                  : '볼더링';
            setLoad({
              state: 'ready',
              concept: {
                ...(data as Omit<Concept, 'id' | 'source' | 'type'>),
                id: snap.id,
                source,
                type,
              },
            });
            return;
          }
        } catch (e) {
          lastError = e instanceof Error ? e.message : String(e);
        }
      }
      if (!cancelled) {
        setLoad(
          lastError
            ? { state: 'error', message: lastError }
            : { state: 'missing' },
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.conceptId, params.source, reloadKey]);

  // 헤더 타이틀을 루트명으로 (로딩 중엔 '개념도')
  useEffect(() => {
    navigation.setOptions({
      title: load.state === 'ready' ? conceptTitle(load.concept) : '개념도',
    });
  }, [navigation, load]);

  if (load.state === 'loading') {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (load.state !== 'ready') {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text variant="body" color="textSecondary" style={styles.centerText}>
          {load.state === 'missing'
            ? '개념도를 찾을 수 없습니다. (삭제되었거나 승인 대기 중)'
            : `불러오지 못했습니다.\n${load.message}`}
        </Text>
      </View>
    );
  }

  const c = load.concept;
  const images = conceptImages(c);
  const imageWidth = width - spacing.md * 2;
  const author = c.writer ?? c.nickname ?? c.userId;
  /** 첨부 GPX가 있거나, 옛 문서에 실시간 기록 배열이 남아 있으면 접근로를 볼 수 있다 */
  const hasApproach = !!c.gpxUrl || (c.trackingPath?.length ?? 0) > 0;
  // ⚠️ Number('')는 0이라 그냥 변환하면 좌표 없는 루트가 (0,0) 아프리카 앞바다에 찍힌다
  const latNum = Number(c.latitude);
  const lngNum = Number(c.longitude);
  const routeCoord =
    c.latitude !== undefined &&
    c.longitude !== undefined &&
    String(c.latitude).trim() !== '' &&
    String(c.longitude).trim() !== '' &&
    Number.isFinite(latNum) &&
    Number.isFinite(lngNum) &&
    (latNum !== 0 || lngNum !== 0)
      ? { latitude: latNum, longitude: lngNum }
      : null;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl }}
    >
      <Text variant="headline">{conceptTitle(c)}</Text>
      {c.overview ? (
        <Text variant="body" color="textSecondary" style={styles.overview}>
          {c.overview}
        </Text>
      ) : null}

      {/* 이 루트로 등반일지 작성 (장소·루트명 자동 입력) */}
      <Button
        title="등반일지 쓰기"
        onPress={() =>
          navigation.navigate('ClimbingLogEdit', {
            initial: {
              place: [c.mountain, c.zone].filter(Boolean).join(' '),
              routeName: c.routeName ?? '',
              conceptId: c.id,
              conceptSource: c.source,
            },
          })
        }
        style={styles.logBtn}
      />

      {/*
        ⚠️ '사진 등록 · 라인 그리기' 버튼을 **여기서 뺐다** (2026-08-05 요청).
           아래 '이 구역에 루트 제보'와 나란히 있으니 무엇을 눌러야 할지 헷갈렸다.
           사진에 라인을 그리는 일은 **루트제보 폼의 사진 첨부 자리**로 옮겼다
           (`ReportWriteScreen` — 사진과 라인은 원래 한 작업이다).
           기존 개념도에 사진만 더하는 흐름은 **개념도 목록 카드의 카메라 버튼**에 남아 있다.
      */}

      {/* 등록된 사진 + 라인 오버레이 (승인 대기는 본인·관리자만 보인다) */}
      <ConceptPhotoStrip
        conceptId={c.id}
        onPreview={(url) => {
          const idx = images.indexOf(url);
          setViewer({ open: true, index: idx >= 0 ? idx : 0 });
        }}
      />

      {/* 즐겨찾기 (웹 목록 카드의 별과 같은 my_routes) */}
      <Button
        title={favorites.isFavorite(c.id) ? '즐겨찾기 해제' : '즐겨찾기에 추가'}
        variant="ghost"
        onPress={() => favorites.toggle(c)}
        style={styles.logBtn}
      />

      {/*
        ⚠️ 관리자 수정/삭제 버튼을 **여기서 뺐다** (2026-08-05).
           개념도를 보다가 실수로 삭제하는 사고가 실제로 났다. Firestore 문서 삭제는 되돌릴 수 없다.
           수정·삭제는 **개념도 목록 카드**에서만 한다(그쪽은 대상이 카드로 명확히 구분된다).
      */}

      {/* 사진 (개념도 본체) */}
      {images.length > 0 ? (
        <>
          <ScrollView
            horizontal
            pagingEnabled={images.length > 1}
            showsHorizontalScrollIndicator={false}
            style={styles.carousel}
          >
            {images.map((uri, i) => (
              <Pressable
                key={`${i}-${uri}`}
                accessibilityRole="imagebutton"
                onPress={() => setViewer({ open: true, index: i })}
                style={{ width: imageWidth, marginRight: i === images.length - 1 ? 0 : spacing.sm }}
              >
                <RemoteImage
                  uri={uri}
                  style={[
                    styles.mainImage,
                    {
                      width: imageWidth,
                      borderRadius: radius.md,
                      backgroundColor: colors.surfaceVariant,
                    },
                  ]}
                  resizeMode="cover"
                />
              </Pressable>
            ))}
          </ScrollView>
          <Text variant="caption" color="textSecondary">
            사진을 누르면 크게 볼 수 있습니다{images.length > 1 ? ` · ${images.length}장` : ''}
          </Text>
        </>
      ) : (
        <View
          style={[
            styles.noImage,
            { backgroundColor: colors.surfaceVariant, borderRadius: radius.md },
          ]}
        >
          <Text variant="body" color="disabled">
            등록된 사진이 없습니다
          </Text>
        </View>
      )}

      {/* 기본 정보 */}
      <View style={[styles.section, { borderTopColor: colors.divider }]}>
        <Text variant="title" style={styles.sectionTitle}>
          기본 정보
        </Text>
        <InfoRow label="타입" value={c.type} />
        <InfoRow label="난이도" value={c.difficulty} />
        <InfoRow label="평균 난이도" value={c.avgDifficulty} />
        <InfoRow label="길이" value={typeof c.length === 'number' ? `${c.length}m` : undefined} />
        <InfoRow label="개척자" value={c.pioneer} />
        <InfoRow label="장비" value={c.equipment} />
        <InfoRow label="찾아가는 길" value={c.directions} />
        <InfoRow label="번호" value={c.no} />
        <InfoRow label="작성자" value={author} />
        <InfoRow label="작성일" value={formatDate(c.timestamp)} />
      </View>

      {/*
        이 개념도와 **같은 등반지·구역**에 루트를 하나 더 제보한다.
        예전엔 홈으로 나가 루트제보 탭을 열고 등반지·구역·좌표를 처음부터 다시 골라야 했다
        (2026-08-05 요청). 보던 화면에서 열면 그 값들이 이미 채워져 있다.
      */}
      <View style={[styles.section, { borderTopColor: colors.divider }]}>
        <Button
          title="이 구역에 루트 제보"
          variant="secondary"
          onPress={() =>
            navigation.navigate('ReportWrite', {
              prefill: {
                typeRoot: c.type,
                mountain: c.mountain,
                zone: c.zone,
                // 같은 바위면 좌표도 대개 같다 — 다르면 폼에서 고치면 된다
                latitude: routeCoord ? String(routeCoord.latitude) : undefined,
                longitude: routeCoord ? String(routeCoord.longitude) : undefined,
              },
            })
          }
        />
        <Text variant="caption" color="textSecondary" style={styles.hint}>
          등반지 · 구역 · 좌표가 자동으로 채워집니다
        </Text>
      </View>

      {/*
        접근로 — 첨부된 GPX(없으면 옛 trackingPath)를 지도로 본다.
        예전처럼 '등록됨' 글자만 띄우면 첨부한 파일을 확인할 방법이 없다.
      */}
      {hasApproach ? (
        <View style={[styles.section, { borderTopColor: colors.divider }]}>
          <Text variant="title" style={styles.sectionTitle}>
            접근로
          </Text>
          <Button
            title={c.gpxUrl ? '접근로 보기 (GPX)' : '접근로 보기 (옛 기록)'}
            variant="secondary"
            onPress={() => setApproachOpen(true)}
          />
        </View>
      ) : null}

      {/* 피치 목록 (리드) */}
      {c.type === '리드' && c.pitches && c.pitches.length > 0 ? (
        <View style={[styles.section, { borderTopColor: colors.divider }]}>
          <Text variant="title" style={styles.sectionTitle}>
            피치 ({c.pitches.length})
          </Text>
          {c.pitches.map((p, i) => {
            const thumb = p.imageUrls?.[0];
            const meta = [
              typeof p.length === 'number' ? `${p.length}m` : null,
              p.style,
              p.difficulty,
            ]
              .filter(Boolean)
              .join(' · ');
            return (
              <View key={`pitch-${i}`} style={styles.pitchRow}>
                {thumb ? (
                  <Pressable
                    accessibilityRole="imagebutton"
                    onPress={() => {
                      const idx = images.indexOf(thumb);
                      setViewer({ open: true, index: idx >= 0 ? idx : 0 });
                    }}
                  >
                    <RemoteImage
                      uri={thumb}
                      style={[styles.pitchThumb, { borderRadius: radius.sm }]}
                    />
                  </Pressable>
                ) : (
                  <View
                    style={[
                      styles.pitchThumb,
                      styles.pitchThumbEmpty,
                      {
                        backgroundColor: colors.surfaceVariant,
                        borderRadius: radius.sm,
                      },
                    ]}
                  >
                    <Text variant="caption" color="disabled">
                      없음
                    </Text>
                  </View>
                )}
                <View style={styles.pitchBody}>
                  <Text variant="body">{i + 1}피치</Text>
                  {meta ? (
                    <Text variant="caption" color="textSecondary">
                      {meta}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      {/* 내용 끝 배너 — 스크롤을 다 내린 자리라 읽는 것을 방해하지 않는다 */}
      <View style={styles.adSlot}>
        <AdBanner />
      </View>

      <ConceptImageViewer
        visible={viewer.open}
        images={images}
        initialIndex={viewer.index}
        onClose={() => setViewer((v) => ({ ...v, open: false }))}
      />

      <ApproachMapModal
        visible={approachOpen}
        gpxUrl={c.gpxUrl}
        fallbackPath={c.trackingPath}
        routeCoord={routeCoord}
        title={conceptTitle(c)}
        onClose={() => setApproachOpen(false)}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  adminRow: { flexDirection: 'row', columnGap: 8, marginTop: 8 },
  adminBtn: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  centerText: { textAlign: 'center' },
  overview: { marginTop: 4 },
  logBtn: { marginTop: 12 },
  carousel: { marginTop: 12, marginBottom: 6 },
  mainImage: { height: 220 },
  noImage: {
    height: 160,
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: { marginTop: 20, paddingTop: 16, borderTopWidth: 1 },
  sectionTitle: { marginBottom: 8 },
  hint: { marginTop: 6 },
  adSlot: { marginTop: 20 },
  infoRow: { flexDirection: 'row', paddingVertical: 4 },
  infoLabel: { width: 96 },
  infoValue: { flex: 1 },
  pitchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  pitchThumb: { width: 72, height: 56 },
  pitchThumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  pitchBody: { flex: 1, marginLeft: 12 },
});
