/**
 * 유튜브에서 루트 영상 후보 찾기.
 *
 * ⚠️ **자동으로 붙이지 않는다.** 후보를 보여주고 사람이 고른다.
 *    루트명이 '노을' '감자' '축제' 처럼 흔한 단어인 경우가 많아
 *    (실측: 선운산 도솔암 107개 루트 등) 자동 매칭은 **엉뚱한 영상을
 *    5,451개 루트에 붙이는 사고**가 된다. 데이터 오염은 되돌리기 어렵다.
 *
 * ⚠️ 키가 없으면 `null` 을 돌려준다. 호출부는 그때 유튜브 앱을 검색어와 함께 연다.
 */
import { YOUTUBE_API_KEY, videoQuery } from '../constants/youtube';

export interface VideoCandidate {
  videoId: string;
  title: string;
  channel: string;
  thumbnail: string;
  url: string;
}

export function hasYoutubeKey(): boolean {
  return YOUTUBE_API_KEY.trim().length > 0;
}

/** 유튜브 앱/웹 검색 주소 (키가 없을 때의 대안) */
export function youtubeSearchUrl(mountain?: string, zone?: string, routeName?: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(
    videoQuery(mountain, zone, routeName),
  )}`;
}

/**
 * 후보 검색.
 * @returns 키가 없으면 null
 * ⚠️ 검색 1회가 할당량 100 유닛이다. **버튼을 눌렀을 때만** 부를 것.
 */
export async function searchRouteVideos(
  mountain?: string,
  zone?: string,
  routeName?: string,
): Promise<VideoCandidate[] | null> {
  if (!hasYoutubeKey()) {
    return null;
  }
  const q = videoQuery(mountain, zone, routeName);
  const url =
    'https://www.googleapis.com/youtube/v3/search' +
    `?part=snippet&type=video&maxResults=8&q=${encodeURIComponent(q)}` +
    `&key=${YOUTUBE_API_KEY}`;

  const res = await fetch(url);
  if (!res.ok) {
    // 할당량 초과(403)가 가장 흔하다 — 사용자에게 그대로 보여준다
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(body.error?.message ?? `유튜브 검색 실패 (${res.status})`);
  }
  const data = (await res.json()) as {
    items?: {
      id?: { videoId?: string };
      snippet?: {
        title?: string;
        channelTitle?: string;
        thumbnails?: { medium?: { url?: string } };
      };
    }[];
  };

  return (data.items ?? [])
    .filter((it) => it.id?.videoId)
    .map((it) => ({
      videoId: it.id!.videoId!,
      title: it.snippet?.title ?? '',
      channel: it.snippet?.channelTitle ?? '',
      thumbnail:
        it.snippet?.thumbnails?.medium?.url ??
        `https://img.youtube.com/vi/${it.id!.videoId!}/mqdefault.jpg`,
      url: `https://www.youtube.com/watch?v=${it.id!.videoId!}`,
    }));
}
