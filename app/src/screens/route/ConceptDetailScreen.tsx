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
  Alert,
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
import { useDirections } from '../../hooks/useDirections';
import { AdBanner } from '../../components/common/AdBanner';
import { AppIcon, type AppIconName } from '../../components/common/AppIcon';
import { ConceptPhotoStrip } from './components/ConceptPhotoStrip';
import { ConceptPhotoEditor } from './components/ConceptPhotoEditor';
import { DifficultyPrompt } from './components/DifficultyPrompt';
import { SendSection } from './components/SendSection';
import { CragCard } from './components/CragCard';
import { ClosureBanner, ClosureModal } from './components/ClosureNotice';
import { ClosureAdminSheet } from './components/ClosureAdminSheet';
import { useClosure } from '../../hooks/useClosure';
import { subscribeCrag } from '../../services/cragService';
import type { Crag } from '../../types/crag';
import { BetaVideoSection } from './components/BetaVideoSection';
import { EditSuggestSheet } from './components/EditSuggestSheet';
import { useFavorites } from './hooks/useFavorites';
import { useAuthStore } from '../../stores/authStore';
import { isAdminEmail } from '../../constants/admin';
import { deleteReport } from '../../services/reportService';
import { useTheme } from '../../theme';
import { formatDate } from '../../utils/date';
import {
  conceptDifficulty,
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

/** 상세 진입 시 곧바로 받기 시작할 사진 수. 나머지는 한 장씩 이어받는다 */
const INITIAL_PHOTOS = 2;

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

/**
 * 빠른 작업 타일 — 아이콘 + 이름 + 한 줄 설명.
 *
 * ⚠️ 아이콘만 두지 않는 이유: 별 하나, 원 안의 + 하나만 보면 무엇인지 알기 어렵다.
 *    "누르면 설명이 나오게" 대신 **처음부터 이름과 설명을 같이** 보여준다 —
 *    한 번 더 눌러야 알 수 있는 UI 는 산에서 장갑 낀 손으로 쓰기 나쁘다.
 */
const ActionTile: React.FC<{
  icon: AppIconName;
  label: string;
  caption?: string;
  onPress: () => void;
  /** 켜진 상태(즐겨찾기 담김) — 테두리·아이콘 색이 강조된다 */
  active?: boolean;
  filled?: boolean;
  disabled?: boolean;
}> = ({ icon, label, caption, onPress, active = false, filled = false, disabled = false }) => {
  const { colors, radius } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={caption ? `${label} — ${caption}` : label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionTile,
        {
          borderColor: active ? colors.primary : colors.divider,
          borderRadius: radius.md,
          backgroundColor: pressed ? colors.surfaceVariant : colors.surface,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <AppIcon name={icon} size={22} filled={filled} color={colors.primary} />
      <Text variant="label" style={styles.actionLabel} numberOfLines={1}>
        {label}
      </Text>
      {caption ? (
        <Text variant="caption" color="textSecondary" numberOfLines={1}>
          {caption}
        </Text>
      ) : null}
    </Pressable>
  );
};

export const ConceptDetailScreen: React.FC = () => {
  const { colors, radius, spacing } = useTheme();
  const { width } = useWindowDimensions();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Rt>();

  const [load, setLoad] = useState<LoadState>({ state: 'loading' });
  /**
   * 전체화면 뷰어 상태.
   *
   * ⚠️ 예전에는 `{ open, index }`만 들고, 뷰어에는 언제나 `images`(= 루트 대표 사진)를 넘겼다.
   *    그래서 **루트 대표 사진이 아닌 것**을 누르면(피치 사진, 검토 중인 사진)
   *    `images.indexOf(...)`가 `-1`이 되어 `0`으로 떨어졌고 **엉뚱한 사진**이 열렸다
   *    (2026-08-29 사용자 보고). 이제 목록 자체를 함께 담아 누른 사진이 그대로 열린다.
   */
  const [viewer, setViewer] = useState<{
    open: boolean;
    images: string[];
    index: number;
  }>({ open: false, images: [], index: 0 });
  const [approachOpen, setApproachOpen] = useState(false);
  /**
   * 🚀 캐러셀 순차 로딩 (2026-08-25 사용자 피드백).
   *
   * 예전에는 `images.map()` 으로 **N장을 한 번에** 그려서 다운로드가 동시에 시작됐다.
   * 개념도가 10장이면 원본 10장을 한꺼번에 받느라 첫 장조차 늦게 떴다.
   *
   * → 앞 `INITIAL_PHOTOS` 장만 먼저 받고, 한 장이 화면에 올라올 때마다 한 장씩 이어받는다.
   *   사용자가 실제로 보는 것은 1장이라 체감은 "바로 뜬다"가 된다.
   */
  const [loadUpTo, setLoadUpTo] = useState(INITIAL_PHOTOS);
  const { busy: dirBusy, go: goDirections } = useDirections();
  const favorites = useFavorites();
  /**
   * 수정 화면에서 돌아오면 다시 읽는다.
   * (Firestore 오프라인 캐시 때문에 화면이 그대로 남아 **수정 전 사진이 보이던 문제**, 2026-08-05)
   */
  const [reloadKey, setReloadKey] = useState(0);
  /*
   * 정보 수정 제안 — 남의 제보도 고칠 수 있어야 데이터가 정리된다.
   * ⚠️ 본인 제보면 제안이 아니라 바로 반영된다 (EditSuggestSheet).
   */
  const [suggestOpen, setSuggestOpen] = useState(false);
  /**
   * 목록 카드에 있던 버튼들이 여기로 왔다 (2026-08-29 사용자 요청:
   * "아이콘 때문에 목록이 몇 개 안 보인다. 상세 화면이 공간이 더 많다").
   */
  const [photoOpen, setPhotoOpen] = useState(false);
  const isAdmin = isAdminEmail(useAuthStore((st) => st.user?.email));
  const uid = useAuthStore((st) => st.user?.uid);
  /** 폐쇄 설정 시트 (관리자) */
  const [closureOpen, setClosureOpen] = useState(false);

  /*
   * 구역 폐쇄를 보려면 crags 문서가 필요하다.
   * ⚠️ CragCard 도 같은 문서를 구독한다. 리스너가 둘이지만 Firestore SDK 는 같은 문서에
   *    붙은 리스너를 하나의 감시로 묶으므로 서버 읽기가 두 배가 되지는 않는다.
   *    CragCard 에서 끌어올리지 않은 이유: 그 카드는 `mountain` 이 없으면 통째로
   *    렌더를 건너뛴다. 폐쇄는 그 경우에도 판정해야 한다.
   */
  const [crag, setCrag] = useState<Crag | null>(null);

  /*
   * ⚠️ 폐쇄 판정은 **early return 보다 위에서** 해야 한다.
   *    아래쪽에 `load.state` 로 빠져나가는 return 이 넷 있는데, 훅을 그 뒤에 두면
   *    렌더마다 훅 개수가 달라져 React 가 터진다.
   */
  const loaded = load.state === 'ready' ? load.concept : null;

  useEffect(
    () => subscribeCrag(loaded?.mountain, loaded?.zone, setCrag),
    [loaded?.mountain, loaded?.zone],
  );

  const { closure, modalOpen, dismissModal, openModal } = useClosure(loaded, crag);

  // 다른 개념도로 바뀌면 순차 로딩을 처음부터 다시 시작한다
  useEffect(() => {
    setLoadUpTo(INITIAL_PHOTOS);
  }, [reloadKey]);
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
      {/*
        ⛔ 폐쇄 배너 — **무조건 맨 위**. 스크롤해서 만나는 위치면 의미가 없다.
           모달을 닫아도 이건 남는다 (사용자 결정 2026-09-15).
           눌러서 큰 안내를 다시 열 수 있다.
      */}
      {closure ? <ClosureBanner closure={closure} onPress={openModal} /> : null}

      <Text variant="headline">{conceptTitle(c)}</Text>
      {c.overview ? (
        <Text variant="body" color="textSecondary" style={styles.overview}>
          {c.overview}
        </Text>
      ) : null}

      {/*
        ⚠️ 여기에 길찾기·등반일지·즐겨찾기·사진등록 버튼이 **세로로 4개** 쌓여 있었다.
           사진과 정보에 닿기도 전에 버튼이 한 화면을 채워서
           "너무 밑으로 길고 비효율적"이라는 지적이 나왔다 (2026-08-31).
           → 아래 '이 구역에 루트 제보' 밑의 **'빠른 작업' 2×2** 로 옮겼다.
           (2026-08-05 에 사진 등록 버튼을 뺐던 이유 — 루트 제보 버튼과 헷갈린다 — 도
            2×2 로 묶이면서 해소됐다. 둘은 이제 서로 다른 구역에 있다.)
      */}

      {/* 등록된 사진 + 라인 오버레이 (승인 대기는 본인·관리자만 보인다) */}
      <ConceptPhotoStrip
        conceptId={c.id}
        /* 검토 중(승인 대기·반려) 사진은 개념도 `imageUrls`에 아직 없다 → 누른 그 사진만 연다 */
        onPreview={(url) => setViewer({ open: true, images: [url], index: 0 })}
      />

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
                onPress={() => setViewer({ open: true, images, index: i })}
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
                  // 지금 보고 있는 사진이다 — 목록 썸네일보다 먼저 처리한다
                  priority="high"
                  /*
                   * 🚀 40KB 축소본을 **먼저** 띄우고 원본을 뒤이어 얹는다.
                   *    목록에서 들어왔으면 축소본은 이미 받아둔 것이라 즉시 보인다.
                   *    사진이 많은 루트에서도 기다림이 사실상 사라진다 (2026-08-28).
                   */
                  progressive
                  // 원본만 순서를 기다린다. 축소본은 언제나 바로 뜬다
                  defer={i >= loadUpTo}
                  onLoaded={() => setLoadUpTo((n) => Math.max(n, i + 2))}
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

      {/*
        암장 정보 — 접근·주차·대중교통.
        ⚠️ 개념도보다 **먼저 찾는 정보**라 기본 정보 앞에 둔다 (경쟁 분석 2순위).
      */}
      <CragCard concept={c} />

      {/*
        난이도가 비어 있으면 알려 달라고 한다.
        ⚠️ 리드 루트의 97%에 난이도가 없다 (2026-09-07 실측). 관리자 혼자 못 채운다 —
           **본 사람이 그 자리에서** 알려주는 게 유일한 방법이다.
           (components/DifficultyPrompt.tsx 머리말)
      */}
      {conceptDifficulty(c) === undefined ? (
        <DifficultyPrompt concept={c} onApplied={() => setReloadKey((k) => k + 1)} />
      ) : null}

      {/*
        완등 — 이 화면에서 **가장 중요한 행동**이라 사진 바로 아래에 둔다.
        ⚠️ 아래 '빠른 작업' 2×2 에 끼워 넣지 말 것 (components/SendSection.tsx 머리말).
      */}
      <SendSection concept={c} onChanged={() => setReloadKey((k) => k + 1)} />

      {/* 등반 전에 동작을 미리 본다 — 사진으로는 안 되는 것 */}
      <BetaVideoSection concept={c} onChanged={() => setReloadKey((k) => k + 1)} />

      <EditSuggestSheet
        visible={suggestOpen}
        concept={c}
        onClose={() => setSuggestOpen(false)}
        onApplied={() => setReloadKey((k) => k + 1)}
      />

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
        {c.contributors && c.contributors.length > 0 ? (
          <InfoRow label="정보 기여" value={c.contributors.join(', ')} />
        ) : null}

        {/*
          ⚠️ 남의 제보도 고칠 수 있어야 5,451개 데이터가 정리된다.
             단, 루트 문서는 지도·목록의 뿌리라 **검토를 거친다** (암장 정보와 다른 판단).
        */}
        <Button
          title="정보가 틀렸어요 (수정 제안)"
          variant="ghost"
          size="sm"
          onPress={() => setSuggestOpen(true)}
          style={styles.suggestBtn}
        />
      </View>

      {/*
        ⚠️ 피치·접근로는 **루트 제보와 빠른 작업보다 위**에 둔다 (2026-08-31 사용자 지시:
           "해당 루트 전반적인 내용을 위부터 다 보여주고 제보를 하던 뭘하던 하는 게 맞아").
           읽는 순서 = 사진 → 기본 정보 → 피치 → 접근로 → (그다음에) 제보 · 빠른 작업.
           ⚠️ 작업 버튼을 내용 위로 다시 올리지 말 것.
      */}

      {/* 피치 목록 (리드) */}
      {c.type === '리드' && c.pitches && c.pitches.length > 0 ? (
        <View style={[styles.section, { borderTopColor: colors.divider }]}>
          <Text variant="title" style={styles.sectionTitle}>
            피치 ({c.pitches.length})
          </Text>
          {/*
            ⚠️ 줄 전체가 **피치 상세로 가는 버튼**이다 (2026-08-29).
               예전에는 썸네일만 눌렸고, 그것도 `images.indexOf(thumb)`로 루트 대표 사진
               뷰어를 열었다 — 피치 사진은 그 목록에 없으니 항상 -1 → 0 → **루트 첫 사진**.
               피치에 사진이 여러 장이어도 첫 장 말고는 볼 방법이 없었다.
          */}
          {c.pitches.map((p, i) => {
            const thumb = p.imageUrls?.[0];
            const shots = (p.imageUrls ?? []).filter(Boolean).length;
            const meta = [
              p.length === undefined || p.length === null || p.length === ''
                ? null
                : `${p.length}m`,
              p.style,
              p.difficulty,
              shots > 1 ? `사진 ${shots}장` : null,
            ]
              .filter(Boolean)
              .join(' · ');
            return (
              <Pressable
                key={`pitch-${i}`}
                accessibilityRole="button"
                accessibilityLabel={`${p.name || `${i + 1}피치`} 상세 보기`}
                style={styles.pitchRow}
                onPress={() =>
                  navigation.navigate('PitchDetail', {
                    pitchNumber: i + 1,
                    pitch: p,
                    routeTitle: conceptTitle(c),
                  })
                }
              >
                {thumb ? (
                  <RemoteImage
                    uri={thumb}
                    style={[styles.pitchThumb, { borderRadius: radius.sm }]}
                    variant="thumb"
                  />
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
                  <Text variant="body">{p.name || `${i + 1}피치`}</Text>
                  {meta ? (
                    <Text variant="caption" color="textSecondary">
                      {meta}
                    </Text>
                  ) : null}
                </View>
                <Text variant="body" color="disabled" style={styles.pitchChevron}>
                  ›
                </Text>
              </Pressable>
            );
          })}
          <Text variant="caption" color="textSecondary">
            피치를 누르면 그 피치의 사진과 정보를 볼 수 있습니다
          </Text>
        </View>
      ) : null}

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
        빠른 작업 — 2×2.

        ⚠️ **길찾기 타일을 지우지 말 것** (App Store 2026-08-12 반려 Guideline 4).
           앱 안 지도가 `PROVIDER_GOOGLE` 이라, iOS 사용자에게는 **네이티브 Apple 지도를
           여는 선택지**를 반드시 줘야 한다 (utils/openExternalMap.ts 가 iOS에서
           Apple 지도를 첫 선택지로 띄운다). 기능이 아니라 **심사 통과 수단**이다.
           목적지가 루트 좌표가 아니라 **인근 도로**인 이유는 2026-08-13 건 —
           길 없는 산속 좌표로는 지도 앱이 경로를 못 만들고 종료된다.

        ⚠️ 예전에는 이 넷이 **화면 맨 위에 세로로 4개** 쌓여 있었다.
           사진과 정보에 닿기도 전에 버튼이 한 화면을 채워서
           "너무 밑으로 길고 비효율적"이라는 지적이 나왔다 (2026-08-31).
           · 위치를 **아래로** 내렸다 — 보러 온 사람은 사진·정보가 먼저다
           · 한 줄에 **두 개씩** 넣어 세로 길이를 절반으로 줄였다
           · 아이콘 + 짧은 이름. 즐겨찾기는 별(누르면 채워진다), 사진 등록은 **원 안의 +**
        ⚠️ 다시 세로 한 줄씩으로 되돌리지 말 것.
      */}
      <View style={[styles.section, { borderTopColor: colors.divider }]}>
        <Text variant="title" style={styles.sectionTitle}>
          빠른 작업
        </Text>

        <View style={styles.actionGrid}>
          {routeCoord ? (
            <ActionTile
              icon="locate"
              label={dirBusy ? '찾는 중…' : '길찾기'}
              caption="인근 도로까지"
              disabled={dirBusy}
              onPress={() =>
                goDirections({
                  latitude: routeCoord.latitude,
                  longitude: routeCoord.longitude,
                  label: conceptTitle(c),
                })
              }
            />
          ) : (
            /* 좌표가 없으면 자리를 비워 두 번째 칸이 폭 전체로 늘어나지 않게 한다 */
            <View style={styles.actionTileSpacer} />
          )}

          <ActionTile
            icon="pencil"
            label="등반일지"
            caption="장소·루트 자동 입력"
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
          />
        </View>

        <View style={styles.actionGrid}>
          <ActionTile
            icon="star"
            filled={favorites.isFavorite(c.id)}
            active={favorites.isFavorite(c.id)}
            label={favorites.isFavorite(c.id) ? '즐겨찾기 해제' : '즐겨찾기'}
            caption={favorites.isFavorite(c.id) ? '내 루트에 있음' : '내 루트에 담기'}
            onPress={() => favorites.toggle(c)}
          />

          <ActionTile
            icon="plus-circle"
            label="사진 등록"
            caption="찍고 라인 그리기"
            onPress={() => setPhotoOpen(true)}
          />
        </View>
      </View>

      {/*
        관리자 수정·삭제.

        ⚠️ 2026-08-05 에 **여기서 뺐던** 버튼들이다.
           개념도를 보다가 실수로 삭제하는 사고가 실제로 났고, Firestore 문서 삭제는 되돌릴 수 없다.
           2026-08-29 에 목록을 가볍게 하려고 되돌려 놓는다 — 대신 안전장치를 유지한다:
             · 화면 **맨 아래**에 둔다 (사진·정보를 다 본 뒤에야 닿는다)
             · 삭제는 루트 이름을 보여주며 **한 번 더 확인**한다
             · 삭제 후에는 이 화면에 남지 않고 목록으로 되돌아간다
           ⚠️ 확인 대화상자를 없애지 말 것.
      */}
      {isAdmin ? (
        <View style={styles.adminRow}>
          <Button
            title="수정"
            variant="secondary"
            style={styles.adminBtn}
            onPress={() =>
              navigation.navigate('ConceptEdit', { conceptId: c.id, source: c.source })
            }
          />
          {/*
            폐쇄 설정 — 삭제 옆에 두되 **삭제가 아니다.**
            닫힌 루트를 지워 버리면 다시 열렸을 때 자료를 처음부터 만들어야 한다.
          */}
          <Button
            title={closure ? '폐쇄 해제/수정' : '폐쇄 설정'}
            variant="secondary"
            style={styles.adminBtn}
            onPress={() => setClosureOpen(true)}
          />
          <Button
            title="삭제"
            variant="secondary"
            style={styles.adminBtn}
            onPress={() =>
              Alert.alert(
                '개념도 삭제',
                `"${c.routeName ?? conceptTitle(c)}"을(를) 정말 삭제할까요?\n되돌릴 수 없습니다.`,
                [
                  { text: '취소', style: 'cancel' },
                  {
                    text: '삭제',
                    style: 'destructive',
                    onPress: () => {
                      void deleteReport(c.source, c.id)
                        .then(() => navigation.goBack())
                        .catch((e: unknown) =>
                          Alert.alert('삭제 실패', e instanceof Error ? e.message : String(e)),
                        );
                    },
                  },
                ],
              )
            }
          />
        </View>
      ) : null}

      {/* 내용 끝 배너 — 스크롤을 다 내린 자리라 읽는 것을 방해하지 않는다 */}
      <View style={styles.adSlot}>
        <AdBanner />
      </View>

      {closure ? (
        <ClosureModal closure={closure} visible={modalOpen} onClose={dismissModal} />
      ) : null}

      {isAdmin && uid ? (
        <ClosureAdminSheet
          visible={closureOpen}
          onClose={() => setClosureOpen(false)}
          concept={c}
          routeClosure={c.closure}
          cragClosure={crag?.closure}
          uid={uid}
        />
      ) : null}

      <ConceptImageViewer
        visible={viewer.open}
        images={viewer.images}
        initialIndex={viewer.index}
        onClose={() => setViewer((v) => ({ ...v, open: false }))}
      />

      <ConceptPhotoEditor
        visible={photoOpen}
        concept={c}
        onClose={() => setPhotoOpen(false)}
        /* 등록하면 '검토 중인 사진'에 바로 뜨도록 다시 읽는다 */
        onSaved={() => setReloadKey((k) => k + 1)}
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
  suggestBtn: { alignSelf: 'flex-start', marginTop: 10 },
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
  actionGrid: { flexDirection: 'row', columnGap: 8, marginBottom: 8 },
  actionTile: {
    flex: 1,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    rowGap: 2,
  },
  actionTileSpacer: { flex: 1 },
  actionLabel: { marginTop: 2 },
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
  pitchChevron: { marginLeft: 8 },
});
