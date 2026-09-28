/**
 * 이미지 URL 해석 — GCS 원본 주소를 Storage 다운로드 URL로 바꾼다.
 *
 * ⚠️ **실측 (docs/03 인수인계 주의사항):**
 *   DB에 저장된 이미지 URL이 `https://storage.googleapis.com/<bucket>/<path>` 형식이다.
 *   이 형식은 **Storage 보안 규칙이 아니라 GCS IAM**을 타므로 그냥 쓰면 **403**이 난다.
 *   `getDownloadURL()`로 다시 물어보면 `?alt=media&token=...`이 붙은 주소가 나오고,
 *   그건 Storage 규칙을 따르므로 정상적으로 보인다.
 *
 * 이미 `firebasestorage.googleapis.com/...&token=` 형식이면 그대로 쓴다.
 *
 * ── 🚀 2026-08-25: 동시 요청 제한 + 우선순위 + 축소본 (사용자 피드백) ──────
 *  "개념도가 많아 목록 썸네일이 너무 느리고 스크롤도 잘 안 내려간다."
 *
 *  원인이 둘이다 (docs/14_IMAGE_PERF.md):
 *   A. 썸네일 한 장마다 `getDownloadURL()` **왕복이 1회씩** 필요한데,
 *      목록이 10장을 그리면 왕복 10건이 동시에 나가 서로를 밀어낸다.
 *   B. 104×88 자리에 **원본(2~5MB)** 을 받는다. 이쪽이 더 크다.
 *
 *  → A: 동시 실행을 `MAX_CONCURRENT` 로 묶고, 대기열을 **LIFO** 로 꺼낸다.
 *       목록을 빠르게 내리면 지나간 카드보다 **지금 보이는 카드**가 먼저 뜬다.
 *       상세·뷰어는 `priority: 'high'` 로 큐 앞에 세운다.
 *  → B: `resolveThumbnailUrl()` 이 Resize Images 축소본을 쓴다(아래 참조).
 */
import { getDownloadURL, ref } from '@react-native-firebase/storage';
import { storage } from './firebase';

const GCS_PREFIX = 'https://storage.googleapis.com/';

/** raw URL → 해석된 URL (실패 시 빈 문자열). 앱이 사는 동안 유지되는 캐시 */
const cache = new Map<string, string>();
/** 같은 URL을 동시에 여러 번 요청하지 않도록 */
const inflight = new Map<string, Promise<string>>();

/**
 * 동시에 진행할 변환 요청 수.
 * 너무 낮으면 한 장씩 뜨는 것처럼 느려지고, 너무 높으면 서로를 밀어낸다.
 *
 * 2026-08-28: 썸네일 백필 이후 **받는 바이트가 40KB로 줄어** 병목이
 * 이미지 전송이 아니라 `getDownloadURL()` 왕복 자체가 됐다 → 4 → 6 으로 올린다.
 */
const MAX_CONCURRENT = 6;

export type ImagePriority = 'high' | 'low';

let active = 0;

interface Job {
  /** 차례가 되면 실행 */
  run: () => void;
  /** 시작 전에 버려질 때 — 반드시 약속을 풀어 줘야 한다 */
  cancel: () => void;
}

/** 상세·뷰어용. 항상 먼저 처리한다 */
const highQueue: Job[] = [];
/** 목록 썸네일용 */
const lowQueue: Job[] = [];

function pump(): void {
  while (active < MAX_CONCURRENT) {
    // ⚠️ low 는 **뒤에서** 꺼낸다(LIFO). 목록을 빠르게 내렸을 때
    //    이미 지나간 카드보다 지금 보이는 카드가 먼저 뜨게 하기 위해서다.
    const next = highQueue.shift() ?? lowQueue.pop();
    if (!next) {
      return;
    }
    active += 1;
    next.run();
  }
}

/**
 * 큐를 거쳐 실행한다. 동시 실행 수를 넘지 않는다.
 *
 * @param onCancel 시작 전에 버려졌을 때 대신 돌려줄 값
 */
function queued<T>(
  priority: ImagePriority,
  task: () => Promise<T>,
  onCancel: () => T,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const job: Job = {
      run: () => {
        if (settled) {
          return;
        }
        settled = true;
        task()
          .then(resolve, reject)
          .finally(() => {
            active -= 1;
            pump();
          });
      },
      cancel: () => {
        if (settled) {
          return;
        }
        settled = true;
        resolve(onCancel());
      },
    };
    if (priority === 'high') {
      highQueue.push(job);
    } else {
      lowQueue.push(job);
    }
    pump();
  });
}

/**
 * 아직 시작하지 않은 **목록 썸네일** 요청을 모두 버린다.
 * 검색어가 바뀌어 목록이 통째로 교체될 때 호출한다 —
 * 이제 화면에 없는 카드의 요청이 새 목록을 밀어내지 않게 한다.
 * (이미 시작된 요청은 그대로 두고 결과는 캐시에 남긴다)
 *
 * ⚠️ 버릴 때 **반드시 `cancel()` 로 약속을 풀어야 한다.**
 *    그냥 배열만 비우면 그 약속은 영원히 대기 상태로 남고,
 *    `inflight` 에 죽은 약속이 남아 **같은 이미지를 다시 열어도 영영 안 뜬다.**
 *    (검색어를 바꿨다가 되돌아오면 재현되던 버그 — 2026-08-28 발견)
 */
export function dropPendingThumbnails(): void {
  const dropped = lowQueue.splice(0, lowQueue.length);
  dropped.forEach((job) => job.cancel());
}

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
 * 이미 받아둔 **축소본** 주소 (없으면 undefined).
 *
 * ⚠️ 목록을 스크롤하면 카드가 재활용되며 같은 이미지가 계속 다시 마운트된다.
 *    그때마다 비동기로 캐시를 조회하면 **한 프레임씩 스피너가 번쩍인다.**
 *    동기로 꺼낼 수 있으면 첫 렌더에 바로 그려 깜빡임을 없앤다.
 */
export function cachedThumbnailUrl(
  raw: string | undefined | null,
): string | undefined {
  if (!raw || !isRawGcsUrl(raw)) {
    return undefined;
  }
  return cache.get(THUMB_CACHE_PREFIX + raw);
}

/** 이미 변환해 둔 값이 있으면 즉시 돌려준다 (렌더 첫 프레임에 바로 그리기 위해) */
export function cachedImageUrl(raw: string | undefined | null): string | undefined {
  if (!raw) {
    return undefined;
  }
  if (!isRawGcsUrl(raw)) {
    return raw;
  }
  return cache.get(raw);
}

/**
 * 화면에 바로 쓸 수 있는 URL을 돌려준다.
 * GCS 원본이 아니면 그대로, 맞으면 다운로드 URL로 변환(캐시).
 *
 * @param priority 'high' = 상세/뷰어(지금 보고 있는 사진), 'low' = 목록 썸네일
 */
export async function resolveImageUrl(
  raw: string,
  priority: ImagePriority = 'low',
): Promise<string> {
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

  const task = queued(
      priority,
      async () => {
        try {
          const url = await getDownloadURL(ref(storage, gcsObjectPath(raw)));
          cache.set(raw, url);
          return url;
        } catch (e) {
          // storage/quota-exceeded(일일 한도 초과)도 여기로 온다 — 코드로는 해결 불가
          console.warn('[imageUrl] 다운로드 URL 변환 실패:', raw, e);
          cache.set(raw, '');
          return '';
        } finally {
          inflight.delete(raw);
        }
      },
      () => {
        // 버려졌다 — 캐시에 남기지 않는다. 다시 화면에 나오면 그때 새로 요청한다
        inflight.delete(raw);
        return '';
      },
  );

  inflight.set(raw, task);
  return task;
}

// ── 축소본(썸네일) ─────────────────────────────────────────────────────────
/*
 * Firebase Extensions 'Resize Images' 가 만드는 축소본을 목록에서 쓴다.
 *   원본     route_images/북한산/인수봉/서면슬랩/photo.jpg          ~3MB
 *   축소본   route_images/북한산/인수봉/서면슬랩/photo_400x400.jpg  ~40KB
 *
 * ⚠️ 익스텐션 설치·백필은 콘솔 작업이다 (docs/14_IMAGE_PERF.md).
 *    **아직 안 돼 있어도 앱이 깨지지 않아야 한다** → 축소본이 없으면 원본으로 되돌아간다.
 *
 * ⚠️ 다만 없는 파일을 매번 물어보면 왕복만 늘어 오히려 느려진다.
 *    그래서 처음 몇 번 연속 실패하면 **이번 실행 동안은 아예 시도하지 않는다.**
 *    설치·백필한 뒤에는 첫 성공과 함께 자동으로 켜진다 —
 *    앱을 다시 배포하거나 설정을 바꿀 필요가 없다.
 *
 * ⚠️ 익스텐션의 '이미지 형식 변환' 옵션을 켜면 확장자가 바뀌어(.jpg → .jpeg)
 *    아래 경로 계산이 어긋난다. **원본 형식 유지**로 둘 것.
 */
const THUMB_SUFFIX = '_400x400';
/**
 * 이 횟수만큼 **연속** 실패하면 이번 실행에서는 축소본을 포기한다.
 * ⚠️ 방금 올린 사진은 함수가 아직 축소본을 못 만들었을 수 있다.
 *    그런 사진 몇 장 때문에 앱 전체가 축소본을 포기하면 안 되므로
 *    성공이 한 번이라도 나오면 카운터를 초기화하고, 임계값도 넉넉히 잡는다.
 */
const THUMB_GIVEUP_AFTER = 8;
/** 축소본 URL은 원본과 키가 겹치지 않게 접두사를 붙여 캐시한다 */
const THUMB_CACHE_PREFIX = 'thumb::';

let thumbState: 'unknown' | 'available' | 'unavailable' = 'unknown';
let thumbMisses = 0;

/** `.../photo.jpg` → `.../photo_400x400.jpg` (확장자가 없으면 undefined) */
function thumbObjectPath(objectPath: string): string | undefined {
  const dot = objectPath.lastIndexOf('.');
  const slash = objectPath.lastIndexOf('/');
  if (dot <= slash) {
    return undefined;
  }
  return `${objectPath.slice(0, dot)}${THUMB_SUFFIX}${objectPath.slice(dot)}`;
}

/**
 * 목록 썸네일용 URL. 축소본이 있으면 그걸, 없으면 원본을 돌려준다.
 * (원본 경로 계산이 불가능하거나 축소본이 없는 것으로 판명되면 곧바로 원본)
 */
export async function resolveThumbnailUrl(
  raw: string,
  priority: ImagePriority = 'low',
  /**
   * 축소본이 없을 때 원본으로 대신할지.
   * ⚠️ 점진적 로딩의 **미리보기 층**은 `false` 로 부른다 —
   *    원본을 미리보기로 받아 오면 같은 파일을 두 번 받는 셈이라 의미가 없다.
   */
  fallbackToOriginal = true,
): Promise<string> {
  if (!raw || !isRawGcsUrl(raw) || thumbState === 'unavailable') {
    return fallbackToOriginal ? resolveImageUrl(raw, priority) : '';
  }
  const thumbPath = thumbObjectPath(gcsObjectPath(raw));
  if (!thumbPath) {
    return fallbackToOriginal ? resolveImageUrl(raw, priority) : '';
  }

  const key = THUMB_CACHE_PREFIX + raw;
  const hit = cache.get(key);
  if (hit) {
    return hit;
  }
  const running = inflight.get(key);
  if (running) {
    return running;
  }

  const task = queued(
      priority,
      async () => {
        try {
          const url = await getDownloadURL(ref(storage, thumbPath));
          cache.set(key, url);
          thumbState = 'available';
          thumbMisses = 0;
          return url;
        } catch {
          // 축소본이 아직 없다 — 원본으로 되돌아간다
          if (thumbState === 'unknown') {
            thumbMisses += 1;
            if (thumbMisses >= THUMB_GIVEUP_AFTER) {
              thumbState = 'unavailable';
            }
          }
          return '';
        } finally {
          inflight.delete(key);
        }
      },
      () => {
        inflight.delete(key);
        return '';
      },
  );
  inflight.set(key, task);

  const found = await task;
  if (found) {
    return found;
  }
  return fallbackToOriginal ? resolveImageUrl(raw, priority) : '';
}
