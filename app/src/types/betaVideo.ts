/**
 * 베타 영상 — 루트 문서의 `betaVideos` 배열.
 *
 * ⚠️ **영상을 우리가 호스팅하지 않는다.** 유튜브·인스타 **링크만** 받는다.
 *    남의 영상을 복사해 우리 Storage 에 올리면 저작권 문제가 되고,
 *    용량·전송 비용도 감당할 수 없다. 링크는 "보러 가게 보내는 것"이라 문제가 없다.
 *
 * ⚠️ 별도 컬렉션을 만들지 않고 **루트 문서의 배열**로 둔다.
 *    루트 하나에 영상 몇 개뿐이고, 목록에서 이미 루트를 읽고 있어 추가 읽기가 0이다.
 *    (`likedBy` 배열과 같은 판단 — 수천 개가 되면 그때 하위 컬렉션으로 옮긴다)
 */
export type VideoPlatform = 'youtube' | 'instagram' | 'other';

export interface BetaVideo {
  url: string;
  platform: VideoPlatform;
  title?: string;
  addedBy: string;
  addedByUid: string;
}

/** 유튜브 영상 ID 뽑기 — watch / youtu.be / shorts / embed 를 모두 다룬다 */
export function youtubeId(url: string): string | null {
  const m =
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/.exec(
      url,
    );
  return m ? m[1] : null;
}

export function platformOf(url: string): VideoPlatform {
  if (youtubeId(url)) {
    return 'youtube';
  }
  if (/instagram\.com/.test(url)) {
    return 'instagram';
  }
  return 'other';
}

/**
 * 목록에 쓸 썸네일.
 * ⚠️ 유튜브는 `img.youtube.com` 이 **공짜로** 썸네일을 준다 — 우리가 만들 필요가 없다.
 *    인스타는 공개 썸네일 주소가 없어 아이콘으로 대신한다.
 */
export function videoThumbnail(v: BetaVideo): string | null {
  const id = youtubeId(v.url);
  return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : null;
}

/** 붙여넣기 값 검사 — 링크 형태가 아니면 거절한다 */
export function isVideoUrl(url: string): boolean {
  return /^https?:\/\/\S+$/i.test(url.trim());
}
