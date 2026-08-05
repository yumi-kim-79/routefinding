/**
 * 업데이트 안내 — Firebase **Remote Config** 로 "최소 버전"을 내려받아 판단한다.
 *
 * 왜 Remote Config 인가:
 *   앱을 다시 배포하지 않고도 기준을 바꿀 수 있어야 한다. 치명적인 버그가 발견되면
 *   콘솔에서 `min_version_*` 만 올리면 구버전 사용자 전원이 다음 실행 때 안내를 본다.
 *   (Firestore 문서로도 되지만, RC는 읽기 비용이 없고 캐시·조건 배포가 딸려 온다)
 *
 * ⚠️ **첫 배포에 반드시 들어가야 한다.** 이 코드가 없는 버전을 설치한 사용자에게는
 *    나중에 무슨 수를 써도 안내를 띄울 수 없다 — 그래서 출시 전에 넣는다.
 *
 * 앱 시작을 느리게 하지 않는 방법:
 *   1) 기본값을 코드에 심어 두고 → 2) **캐시된 값으로 즉시 판단**하고 →
 *   3) 새 값은 백그라운드로 받아 와서 다시 판단한다.
 *   네트워크를 기다리며 스플래시를 붙잡지 않는다.
 *
 * ── Remote Config 키 (Firebase 콘솔에서 만든다) ─────────────────────────
 *  | 키                      | 예       | 뜻                                        |
 *  |-------------------------|----------|-------------------------------------------|
 *  | min_version_android     | 2.0.0    | **이 미만이면 강제** — 건너뛸 수 없다      |
 *  | min_version_ios         | 2.0.0    | 〃                                         |
 *  | latest_version_android  | 2.0.0    | 이 미만이면 **권장** — '나중에' 가능        |
 *  | latest_version_ios      | 2.0.0    | 〃                                         |
 *  | update_message          | (문구)   | 안내 문구. 비우면 기본 문구                 |
 *  | store_url_android/ios   | (주소)   | 스토어 주소 덮어쓰기(보통 비워 둔다)        |
 */
import { Platform } from 'react-native';
import {
  activate,
  fetchConfig,
  getRemoteConfig,
  getString,
} from '@react-native-firebase/remote-config';
import { APP_VERSION, defaultStoreUrl } from '../constants/version';

export type UpdateLevel = 'none' | 'optional' | 'required';

export interface UpdateInfo {
  level: UpdateLevel;
  /** 스토어에 올라와 있는 최신 버전 (안내 문구용) */
  latestVersion: string;
  message: string;
  storeUrl: string;
}

const DEFAULT_MESSAGE =
  '새 버전이 나왔습니다.\n더 안정적으로 쓰시려면 업데이트해 주세요.';

/** 기준값이 비어 있으면 "안내 안 함"으로 동작하도록 0.0.0 을 기본으로 둔다 */
const DEFAULTS: Record<string, string> = {
  min_version_android: '0.0.0',
  min_version_ios: '0.0.0',
  latest_version_android: '0.0.0',
  latest_version_ios: '0.0.0',
  update_message: '',
  store_url_android: '',
  store_url_ios: '',
};

/**
 * '2.10.3' 같은 문자열 비교. `a < b` 이면 음수.
 * ⚠️ 문자열 비교(`'2.10.0' < '2.9.0'`)는 틀린다 — 반드시 마디별 숫자로 비교한다.
 */
export function compareVersion(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) {
      return d;
    }
  }
  return 0;
}

const key = (base: string) => `${base}_${Platform.OS === 'ios' ? 'ios' : 'android'}`;

function readInfo(): UpdateInfo {
  const rc = getRemoteConfig();
  const min = getString(rc, key('min_version'));
  const latest = getString(rc, key('latest_version'));
  const message = getString(rc, 'update_message') || DEFAULT_MESSAGE;
  const storeUrl = getString(rc, key('store_url')) || defaultStoreUrl();

  let level: UpdateLevel = 'none';
  if (min && compareVersion(APP_VERSION, min) < 0) {
    level = 'required';
  } else if (latest && compareVersion(APP_VERSION, latest) < 0) {
    level = 'optional';
  }

  return { level, latestVersion: latest || min || APP_VERSION, message, storeUrl };
}

let ready: Promise<void> | undefined;

/**
 * 기본값 심기 + 캐시 활성화 (네트워크를 기다리지 않는다).
 *
 * ⚠️ `setDefaults` / `setConfigSettings` 는 RNFB 25.1.0 의 **모듈러 함수로는 없다**
 *    (모듈러 export 목록에 activate/fetchConfig/getString 등만 있다).
 *    인스턴스 메서드로 호출하는 것이 정상 경로다 — deprecated 네임스페이스 API가 아니다.
 */
async function prepare(): Promise<void> {
  const rc = getRemoteConfig();
  await rc.setConfigSettings({
    // 개발 중에는 콘솔에서 바꾼 값이 바로 보여야 한다. 배포는 1시간 캐시.
    minimumFetchIntervalMillis: __DEV__ ? 0 : 60 * 60 * 1000,
    fetchTimeMillis: 10 * 1000,
  });
  await rc.setDefaults(DEFAULTS);
  await activate(rc); // 지난 실행에서 받아 둔 값이 있으면 즉시 쓴다
}

/**
 * 1차 판단 — **캐시만 보고 즉시** 돌려준다 (앱 시작을 붙잡지 않는다).
 */
export async function checkUpdateFromCache(): Promise<UpdateInfo> {
  if (!ready) {
    ready = prepare();
  }
  await ready;
  return readInfo();
}

/**
 * 2차 판단 — 새 값을 받아 온 뒤 다시 본다. 실패해도 조용히 캐시 결과를 유지한다.
 * (산에서 네트워크가 약할 때 업데이트 안내 때문에 앱이 막히면 안 된다)
 */
export async function refreshUpdate(): Promise<UpdateInfo | null> {
  try {
    if (!ready) {
      ready = prepare();
    }
    await ready;
    const rc = getRemoteConfig();
    await fetchConfig(rc);
    await activate(rc);
    return readInfo();
  } catch (e) {
    console.warn('[update] Remote Config 새로고침 실패:', e);
    return null;
  }
}
