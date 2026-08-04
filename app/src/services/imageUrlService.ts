/**
 * 이미지 URL 해석 — GCS 원본 주소를 Storage 다운로드 URL로 바꾼다.
 *
 * ⚠️ **실측 (docs/03 인수인계 주의사항):**
 *   DB에 저장된 이미지 URL이 `https://storage.googleapis.com/<bucket>/<path>` 형식이다.
 *   이 형식은 **Storage 보안 규칙이 아니라 GCS IAM**을 타므로 그냥 쓰면 **403**이 난다.
 *   `getDownloadURL()`로 다시 물어보면 `?alt=media&token=...`이 붙은 주소가 나오고,
 *   그건 Storage 규칙을 따르므로 정상적으로 보인다.
 *   웹 `ConceptListView.vue`가 하는 일과 동일 — 앱에도 같은 처리가 필요하다.
 *
 * 이미 `firebasestorage.googleapis.com/...&token=` 형식이면 그대로 쓴다.
 */
import { getDownloadURL, ref } from '@react-native-firebase/storage';
import { storage } from './firebase';

const GCS_PREFIX = 'https://storage.googleapis.com/';

/** raw URL → 해석된 URL (실패 시 빈 문자열). 앱이 사는 동안 유지되는 캐시 */
const cache = new Map<string, string>();
/** 같은 URL을 동시에 여러 번 요청하지 않도록 */
const inflight = new Map<string, Promise<string>>();

export function isRawGcsUrl(u: string | undefined | null): boolean {
  return typeof u === 'string' && u.startsWith(GCS_PREFIX);
}

/** `https://storage.googleapis.com/<bucket>/<objectPath>` → `<objectPath>` (디코드) */
function gcsObjectPath(u: string): string {
  const rest = u.slice(GCS_PREFIX.length);
  const slash = rest.indexOf('/');
  if (slash < 0) {
    return '';
  }
  return decodeURIComponent(rest.slice(slash + 1).split('?')[0]);
}

/**
 * 화면에 바로 쓸 수 있는 URL을 돌려준다.
 * GCS 원본이 아니면 그대로, 맞으면 다운로드 URL로 변환(캐시).
 */
export async function resolveImageUrl(raw: string): Promise<string> {
  if (!raw || !isRawGcsUrl(raw)) {
    return raw;
  }
  const hit = cache.get(raw);
  if (hit !== undefined) {
    return hit;
  }
  const running = inflight.get(raw);
  if (running) {
    return running;
  }

  const task = (async () => {
    try {
      const path = gcsObjectPath(raw);
      const url = await getDownloadURL(ref(storage, path));
      cache.set(raw, url);
      return url;
    } catch (e) {
      // storage/quota-exceeded(일일 한도 초과)도 여기로 온다 — 코드로는 해결 불가
      // eslint-disable-next-line no-console
      console.warn('[imageUrl] 다운로드 URL 변환 실패:', raw, e);
      cache.set(raw, '');
      return '';
    } finally {
      inflight.delete(raw);
    }
  })();

  inflight.set(raw, task);
  return task;
}
