/** 개념도 즐겨찾기 상태 훅 (목록·상세 공용) */
import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '../../../stores/authStore';
import { subscribeFavoriteIds, toggleFavorite } from '../../../services/favoriteService';
import type { Concept } from '../../../types/concept';

export interface UseFavoritesResult {
  favoriteIds: Set<string>;
  isFavorite: (conceptId: string) => boolean;
  toggle: (concept: Concept) => void;
}

export function useFavorites(): UseFavoritesResult {
  const uid = useAuthStore((s) => s.user?.uid);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!uid) {
      setFavoriteIds(new Set());
      return;
    }
    return subscribeFavoriteIds(uid, setFavoriteIds, (msg) =>
      // 실패해도 목록은 계속 보여준다 (별만 안 채워짐)
      // eslint-disable-next-line no-console
      console.warn('[my_routes] 구독 실패:', msg),
    );
  }, [uid]);

  const isFavorite = useCallback((id: string) => favoriteIds.has(id), [favoriteIds]);

  const toggle = useCallback(
    (concept: Concept) => {
      if (!uid) {
        return;
      }
      void toggleFavorite(uid, concept, favoriteIds.has(concept.id)).catch((e: unknown) => {
        // eslint-disable-next-line no-console
        console.warn('[my_routes] 토글 실패:', e);
      });
    },
    [favoriteIds, uid],
  );

  return { favoriteIds, isFavorite, toggle };
}
