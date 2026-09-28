/**
 * 베타 영상 붙이기/떼기 — 루트 문서의 `betaVideos` 배열.
 *
 * ⚠️ `arrayUnion` / `arrayRemove` 를 쓴다. 읽고-쓰기로 하면 두 사람이 동시에
 *    붙일 때 하나가 사라진다 (커뮤니티 `likedBy` 와 같은 이유).
 * ⚠️ `arrayRemove` 는 **객체가 완전히 같아야** 지워진다. 목록에서 받은 값을
 *    그대로 넘겨야 하고, 중간에 필드를 더하거나 빼면 안 지워진다.
 */
import { arrayRemove, arrayUnion, doc, updateDoc } from '@react-native-firebase/firestore';
import { db } from './firebase';
import { clearConceptCache } from './conceptService';
import { isVideoUrl, platformOf, type BetaVideo } from '../types/betaVideo';
import type { Concept } from '../types/concept';

export const MAX_BETA_VIDEOS = 10;

export async function addBetaVideo(
  concept: Pick<Concept, 'id' | 'source' | 'betaVideos'>,
  url: string,
  title: string,
  author: { uid: string; nickname: string },
): Promise<void> {
  const clean = url.trim();
  if (!isVideoUrl(clean)) {
    throw new Error('영상 주소를 확인해 주세요. (http 로 시작하는 링크)');
  }
  if ((concept.betaVideos?.length ?? 0) >= MAX_BETA_VIDEOS) {
    throw new Error(`영상은 최대 ${MAX_BETA_VIDEOS}개까지 붙일 수 있습니다.`);
  }
  if (concept.betaVideos?.some((v) => v.url === clean)) {
    throw new Error('이미 붙어 있는 영상입니다.');
  }

  const video: BetaVideo = {
    url: clean,
    platform: platformOf(clean),
    ...(title.trim() ? { title: title.trim() } : {}),
    addedBy: author.nickname,
    addedByUid: author.uid,
  };
  await updateDoc(doc(db, concept.source, concept.id), { betaVideos: arrayUnion(video) });
  clearConceptCache();
}

export async function removeBetaVideo(
  concept: Pick<Concept, 'id' | 'source'>,
  video: BetaVideo,
): Promise<void> {
  await updateDoc(doc(db, concept.source, concept.id), { betaVideos: arrayRemove(video) });
  clearConceptCache();
}
