/**
 * 업데이트 안내 판단 훅.
 *
 * 앱 시작을 붙잡지 않는 순서:
 *   1) 캐시된 Remote Config 로 **즉시** 판단 → 필요하면 바로 안내를 띄운다
 *   2) 새 값을 백그라운드로 받아 다시 판단 (네트워크를 기다리지 않는다)
 *
 * ── 🚨 2026-08-31: '무한 루프' 신고 ──────────────────────────────────────
 *  사용자 보고: "밀면 스토어로 잘 넘어가는데 **업데이트가 아니고 '열기'** 로 나온다.
 *               열기를 누르면 다시 업데이트 화면. 무한 루프에 걸렸다."
 *
 *  원인은 둘이다.
 *   ① **운영** — Remote Config `latest_version_*` 이 **스토어에 실제로 올라간 버전보다
 *      앞서 있었다.** (RC 2.0.8 ↔ Play 최신 2.0.4) 스토어에 받을 게 없으니
 *      아무리 다녀와도 앱 버전은 그대로고, 다음 실행에 또 같은 화면이 뜬다.
 *      → 11_UPDATE_GATE.md §2-1: **스토어에 공개된 뒤에** RC 를 올린다.
 *   ② **코드** — 권장(optional) 단계인데도 안내가 **네비게이터를 통째로 대체**해서,
 *      스토어에서 돌아오면 앱이 아니라 벽을 다시 마주했다.
 *
 *  이 파일에서 고친 것(②):
 *   · 스토어로 보낸 뒤 **앱이 다시 활성화되면 권장 안내를 자동으로 닫는다.**
 *     (할 일은 했다. 실제로 올라갔다면 APP_VERSION 이 바뀌어 애초에 안 뜬다)
 *   · '나중에'/자동 닫힘은 **이 프로세스가 살아 있는 동안** 기억한다(모듈 레벨).
 *     화면 재마운트로 되살아나지 않는다.
 *   ⚠️ 강제(required) 단계는 이 규칙에서 제외한다 — 닫히면 안 되는 화면이다.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import {
  checkUpdateFromCache,
  refreshUpdate,
  type UpdateInfo,
} from '../services/updateService';

/**
 * 이번 실행에서 이미 넘긴 권장 버전들.
 * ⚠️ 모듈 레벨이라 컴포넌트가 다시 마운트돼도 유지된다.
 *    앱을 완전히 껐다 켜면 초기화된다 — 저장소(AsyncStorage 등) 의존성을 새로 넣지 않기 위한 선택이다.
 *    다시 뜨더라도 이제는 **벽이 아니라 닫을 수 있는 안내**라 갇히지 않는다.
 */
const dismissedVersions = new Set<string>();

export function useUpdateGate() {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [, forceRender] = useState(0);
  /** 스토어로 보냈다 → 돌아오면 자동으로 닫는다 */
  const sentToStore = useRef(false);

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

  const dismiss = useCallback(() => {
    if (info && info.level === 'optional') {
      dismissedVersions.add(info.latestVersion);
      forceRender((n) => n + 1);
    }
  }, [info]);

  /** UpdateGate 가 스토어를 연 직후 호출한다 */
  const markSentToStore = useCallback(() => {
    sentToStore.current = true;
  }, []);

  // 스토어에 다녀와 앱이 다시 활성화되면 권장 안내를 닫는다 (여기가 루프를 끊는 지점)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active' && sentToStore.current) {
        sentToStore.current = false;
        dismiss();
      }
    });
    return () => sub.remove();
  }, [dismiss]);

  const visible =
    !!info &&
    info.level !== 'none' &&
    !(info.level === 'optional' && dismissedVersions.has(info.latestVersion));

  return { info, visible, dismiss, markSentToStore };
}
