/**
 * 즐겨찾기 목록 훅 — 지도 · 개념도 · 마이페이지가 **같은 구독 하나**를 쓴다.
 *
 * ⚠️ `screens/route/hooks/useFavorites`(별 채우기용 id 집합)와 **다른 훅이다.**
 *    저쪽은 "이 루트가 즐겨찾기인가"만 알면 되고, 이쪽은 목록을 그린다.
 *    합치지 않은 이유: 개념도 상세는 id 집합만 있으면 되는데 목록까지 들고 있으면
 *    루트 하나 볼 때마다 즐겨찾기 전체를 읽는다.
 */
import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import {
  removeFavorite,
  subscribeFavorites,
  type FavoriteRoute,
} from '../services/favoriteService';

export interface UseFavoriteListResult {
  /** 로딩 중에는 `null` — 빈 배열(진짜 없음)과 구분해야 빈 화면 문구가 깜빡이지 않는다 */
  items: FavoriteRoute[] | null;
  error: string | null;
  /** 로그인 안 한 상태 */
  signedOut: boolean;
  remove: (conceptId: string) => void;
}

export function useFavoriteList(): UseFavoriteListResult {
  const uid = useAuthStore((s) => s.user?.uid);
  const [items, setItems] = useState<FavoriteRoute[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) {
      setItems([]);
      return;
    }
    setItems(null);
    setError(null);
    return subscribeFavorites(uid, setItems, (msg) => {
      setError(msg);
      setItems([]);
    });
  }, [uid]);

  const remove = useCallback(
    (conceptId: string) => {
      if (!uid) {
        return;
      }
      void removeFavorite(uid, conceptId).catch((e: unknown) => {
        // eslint-disable-next-line no-console
        console.warn('[my_routes] 삭제 실패:', e);
      });
    },
    [uid],
  );

  return { items, error, signedOut: !uid, remove };
}
