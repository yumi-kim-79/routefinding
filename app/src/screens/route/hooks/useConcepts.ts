/**
 * 개념도 목록 상태 훅.
 *
 * 화면(ConceptListScreen)은 표시에만 집중하고, 로딩/새로고침/검색 필터는 여기에 모은다
 * (CLAUDE.md 갓 파일 분해 원칙).
 *
 * ⚠️ 핵심 정책 (사용자 결정 2026-08-03):
 *   **검색어가 없으면 목록을 띄우지 않고, Firestore 조회도 하지 않는다.**
 *   승인 루트가 5,400건이 넘어 전체 목록은 의미가 없고 읽기 비용/대기시간만 크다.
 *   → 첫 검색 시점에 1회 전량 로드하고, 이후엔 캐시(5분 TTL) + 클라이언트 필터.
 *
 * 검색은 공백으로 나눈 모든 토큰이 포함되어야 매칭(AND).
 * 예: "북한산 슬랩" → 등반지 북한산 + 구역/루트명에 슬랩 포함.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  fetchConcepts,
  subscribeConceptsUpdate,
} from '../../../services/conceptService';
import {
  conceptSearchIndex,
  type Concept,
  type ConceptType,
} from '../../../types/concept';

/** 상단 필터 칩: 전체 / 리드 / 볼더링 */
export type ConceptFilter = '전체' | ConceptType;

interface UseConceptsResult {
  /** 검색어·칩 적용 결과 */
  filtered: Concept[];
  keyword: string;
  setKeyword: (v: string) => void;
  filter: ConceptFilter;
  setFilter: (v: ConceptFilter) => void;
  /** 검색어가 있어야 목록을 그린다 */
  hasQuery: boolean;
  /** 최초(또는 새로고침) 조회 중 */
  loading: boolean;
  refreshing: boolean;
  refresh: () => void;
  /** 전체 실패(치명적) 메시지 */
  error: string | null;
  /** 부분 실패 경고 (한쪽 컬렉션만 실패) */
  warnings: string[];
}

export function useConcepts(): UseConceptsResult {
  const [items, setItems] = useState<Concept[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [filter, setFilter] = useState<ConceptFilter>('전체');

  /** 조회를 이미 시작했는지 (검색어를 지웠다 다시 쳐도 재조회하지 않음) */
  const startedRef = useRef(false);

  const load = useCallback(async (forceRefresh: boolean) => {
    try {
      const res = await fetchConcepts(forceRefresh);
      setItems(res.items);
      setWarnings(res.warnings);
      // 두 컬렉션 모두 실패 = 아무것도 못 보여줌 → 에러로 승격
      setError(
        res.items.length === 0 && res.warnings.length >= 2
          ? res.warnings.join('\n')
          : null,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : '개념도를 불러오지 못했습니다.');
      setItems([]);
    }
  }, []);

  /**
   * 로컬 캐시로 먼저 그린 뒤, 서버 갱신이 끝나면 조용히 반영한다
   * (conceptService의 stale-while-revalidate — 시작 속도 개선, 2026-08-05).
   */
  useEffect(
    () =>
      subscribeConceptsUpdate((res) => {
        setItems(res.items);
        setWarnings(res.warnings);
      }),
    [],
  );

  const hasQuery = keyword.trim().length > 0;

  // 첫 검색 시점에만 조회 시작 (그 전까지 Firestore 읽기 0)
  useEffect(() => {
    if (!hasQuery || startedRef.current) {
      return;
    }
    startedRef.current = true;
    setLoading(true);
    void load(false).finally(() => setLoading(false));
  }, [hasQuery, load]);

  /**
   * 화면으로 돌아올 때 재확인.
   * 캐시가 살아 있으면 `fetchConcepts`가 즉시 반환하므로 읽기 비용은 0이고,
   * 수정·삭제·승인으로 캐시가 비워졌다면 그때만 다시 읽는다
   * (2026-08-05: 관리자 수정이 목록에 반영되지 않던 문제).
   */
  useFocusEffect(
    useCallback(() => {
      if (startedRef.current) {
        void load(false);
      }
    }, [load]),
  );

  const refresh = useCallback(() => {
    setRefreshing(true);
    startedRef.current = true;
    void load(true).finally(() => setRefreshing(false));
  }, [load]);

  const filtered = useMemo<Concept[]>(() => {
    const tokens = keyword.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!items || tokens.length === 0) {
      return [];
    }
    const byType =
      filter === '전체' ? items : items.filter((c) => c.type === filter);

    return byType.filter((c) => {
      const idx = conceptSearchIndex(c);
      return tokens.every((t) => idx.includes(t));
    });
  }, [items, filter, keyword]);

  return {
    filtered,
    keyword,
    setKeyword,
    filter,
    setFilter,
    hasQuery,
    loading,
    refreshing,
    refresh,
    error,
    warnings,
  };
}
