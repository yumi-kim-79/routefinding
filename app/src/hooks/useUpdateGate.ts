/**
 * 업데이트 안내 판단 훅.
 *
 * 앱 시작을 붙잡지 않는 순서:
 *   1) 캐시된 Remote Config 로 **즉시** 판단 → 필요하면 바로 화면을 덮는다
 *   2) 새 값을 백그라운드로 받아 다시 판단 (네트워크를 기다리지 않는다)
 *
 * '나중에'로 넘긴 권장 업데이트는 **이번 실행 동안만** 숨긴다.
 * 앱을 다시 켜면 또 보인다 — 그래야 결국 올라간다. (강제 단계는 숨길 수 없다)
 */
import { useCallback, useEffect, useState } from 'react';
import {
  checkUpdateFromCache,
  refreshUpdate,
  type UpdateInfo,
} from '../services/updateService';

export function useUpdateGate() {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let alive = true;

    void (async () => {
      try {
        const cached = await checkUpdateFromCache();
        if (alive) {
          setInfo(cached);
        }
      } catch (e) {
        // Remote Config 가 아예 안 되는 상황(플러그인 누락 등)에도 앱은 그대로 동작해야 한다
        console.warn('[update] 캐시 판단 실패:', e);
      }

      const fresh = await refreshUpdate();
      if (alive && fresh) {
        setInfo(fresh);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const dismiss = useCallback(() => setDismissed(true), []);

  const visible =
    !!info && info.level !== 'none' && !(info.level === 'optional' && dismissed);

  return { info, visible, dismiss };
}
