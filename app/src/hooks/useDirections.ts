/**
 * 길찾기 버튼용 훅.
 *
 * 인근 도로를 조회하는 동안(공용 OSRM 서버, 최대 6초) 버튼에 로딩을 표시하고
 * 중복 탭을 막는다. 산속에서 네트워크가 느릴 때 "눌렀는데 아무 반응 없음"을
 * 방지하려는 목적이다.
 *
 * 사용:
 *   const { busy, go } = useDirections();
 *   <Button title="인근 도로까지 길찾기" loading={busy} onPress={() => go(target)} />
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  openTrailheadDirections,
  type MapTarget,
} from '../utils/openExternalMap';

export function useDirections(): {
  busy: boolean;
  go: (target: MapTarget | null) => void;
} {
  const [busy, setBusy] = useState(false);
  // 모달 안에서 쓰이므로 조회 도중 언마운트될 수 있다 → setState 경고 방지
  const mounted = useRef(true);
  const running = useRef(false);

  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  const go = useCallback((target: MapTarget | null) => {
    if (!target || running.current) {
      return;
    }
    running.current = true;
    setBusy(true);

    void openTrailheadDirections(target).finally(() => {
      running.current = false;
      if (mounted.current) {
        setBusy(false);
      }
    });
  }, []);

  return { busy, go };
}
