/**
 * AdMob 초기화 — **처음 배너를 그릴 때 한 번만** 한다.
 *
 * ⚠️ 앱 시작(`App.tsx`)에서 초기화하지 않는 이유:
 *    모바일 광고 SDK 초기화는 네트워크를 타고 수백 ms가 걸린다. 앱 시작이 느리다는
 *    피드백을 받아 시작 경로를 정리해 놓은 상태다(16차) — 거기에 다시 얹으면 되돌리는 셈이다.
 *    광고는 화면에 배너가 붙는 순간 필요하므로 그때 초기화해도 늦지 않다.
 *
 * 동의(UMP/GDPR)는 여기서 다루지 않는다. 이용자가 사실상 국내라 EU 동의 폼이 뜨지 않고,
 * 폼을 붙이면 첫 화면에 모달이 하나 더 생긴다. [QUESTION] 해외 배포 시 UMP 추가 검토.
 */
import mobileAds from 'react-native-google-mobile-ads';

let started: Promise<unknown> | undefined;

/** 여러 배너가 동시에 붙어도 초기화는 한 번만 (같은 Promise를 돌려준다) */
export function ensureAdsInitialized(): Promise<unknown> {
  const running = started;
  if (running) {
    return running;
  }
  const task = mobileAds()
    .initialize()
    .catch((e: unknown) => {
      // 광고 실패로 앱이 멈추면 안 된다 — 조용히 넘기고 배너만 안 나온다
      // eslint-disable-next-line no-console
      console.warn('[ads] 초기화 실패:', e);
    });
  started = task;
  return task;
}
