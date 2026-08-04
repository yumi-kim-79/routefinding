/**
 * 개념도 상세 — 사진(캐러셀 → 탭하면 전체화면) + 기본 정보 + 피치 목록.
 *
 * v1 웹 ConceptDetailView.vue 대비 리뉴얼 시 제외한 것 (단순화 결정, 2026-08-03):
 *   - 어프로치 경로 지도 / 고도 프로필 / GPX 붙여넣기·업로드·공유
 *     → 지도·GPX는 별도 탭(루트 위치/트래킹) 소관. 여기서는 GPX가 있으면 존재만 표시.
 * 라인(선) 그리기·개념도 추가는 다음 단계(P1) — 이 화면이 그 뷰어 기반이 된다.
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { doc, getDoc } from '@react-native-firebase/firestore';
import { db } from '../../services/firebase';
import { Text } from '../../components/common/Text';
import { Button } from '../../components/common/Button';
import { ConceptPhotoEditor } from './components/ConceptPhotoEditor';
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
  /** 개념도 사진 등록 모달 (웹 상세의 '사진 등록' 버튼 대응) */
  const [photoOpen, setPhotoOpen] = useState(false);

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
  }, [params.conceptId, params.source]);

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

      {/* 개념도 사진 등록 (사진 위에 등반 라인을 그려 제보) */}
      <Button
        title="사진 등록 · 라인 그리기"
        variant="secondary"
        onPress={() => setPhotoOpen(true)}
        style={styles.logBtn}
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
                onPress={() => setViewer({ open: true, index: i })}
                style={{ width: imageWidth, marginRight: i === images.length - 1 ? 0 : spacing.sm }}
              >
                <Image
                  source={{ uri }}
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
        <InfoRow label="접근로 GPX" value={c.gpxUrl ? '등록됨' : undefined} />
      </View>

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
                    <Image
                      source={{ uri: thumb }}
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

      <ConceptImageViewer
        visible={viewer.open}
        images={images}
        initialIndex={viewer.index}
        onClose={() => setViewer((v) => ({ ...v, open: false }))}
      />

      <ConceptPhotoEditor
        visible={photoOpen}
        concept={c}
        onClose={() => setPhotoOpen(false)}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
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
  infoRow: { flexDirection: 'row', paddingVertical: 4 },
  infoLabel: { width: 96 },
  infoValue: { flex: 1 },
  pitchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  pitchThumb: { width: 72, height: 56 },
  pitchThumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  pitchBody: { flex: 1, marginLeft: 12 },
});
