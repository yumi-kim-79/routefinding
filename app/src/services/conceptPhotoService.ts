/**
 * 개념도 사진(라인/텍스트) 등록 서비스 — 웹 `ConceptPhotoEditor.vue`의 onSave와 1:1.
 *
 * CLAUDE.md: 비용 발생 호출(Storage 쓰기 · Firestore 쓰기)은 service로 격리한다.
 *
 * Storage 경로는 **기존 storage.rules에 맞춘다** (규칙 변경 불필요):
 *   route_images/{산}/{구역}/{루트}/user_{uid}_{ts}.jpg        원본
 *   route_images/{산}/{구역}/{루트}/user_{uid}_{ts}_lined.jpg  라인 합성본
 *
 * ⚠️ **합성본을 반드시 업로드 시점에 만든다.**
 *    승인되면 합성본이 개념도 `imageUrls`에 들어가는데, 목록·캐러셀·뷰어는 URL을
 *    그냥 이미지로 띄우므로 원본을 넣으면 라인이 사라진다 (docs/03 실측 주의사항).
 */
import { addDoc, collection, serverTimestamp } from '@react-native-firebase/firestore';
import { getDownloadURL, putFile, ref } from '@react-native-firebase/storage';
import { auth, db, storage } from './firebase';
import type { Concept } from '../types/concept';
import type { PhotoLine, PhotoText } from '../types/conceptPhoto';

/** Storage 경로에 못 쓰는 문자 치환 (웹 safe()와 동일) */
function safe(v: string | undefined): string {
  return String(v || '미지정').replace(/[/#?[\]]/g, '_');
}

export function conceptPhotoTitle(c: Concept): string {
  return [c.mountain, c.zone, c.routeName].filter(Boolean).join(' · ') || '개념도';
}

export interface SubmitPhotoParams {
  concept: Concept;
  /** 원본 사진 로컬 uri (image-picker) */
  photoUri: string;
  /** 라인 합성본 로컬 uri (view-shot 캡처). 선/글자가 없으면 null */
  flatUri: string | null;
  lines: PhotoLine[];
  texts: PhotoText[];
  onProgress?: (message: string) => void;
}

export async function submitConceptPhoto({
  concept,
  photoUri,
  flatUri,
  lines,
  texts,
  onProgress,
}: SubmitPhotoParams): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('로그인이 필요합니다.');
  }

  const base =
    `route_images/${safe(concept.mountain)}/${safe(concept.zone)}/${safe(concept.routeName)}` +
    `/user_${user.uid}_${Date.now()}`;

  // ① 원본 — 나중에 선만 다시 고칠 수 있도록 남긴다
  onProgress?.('사진 업로드 중…');
  const rawPath = `${base}.jpg`;
  const rawRef = ref(storage, rawPath);
  await putFile(rawRef, photoUri);
  const imageUrl = await getDownloadURL(rawRef);

  // ② 라인 합성본
  let flatUrl = '';
  let flatPath = '';
  if (flatUri && (lines.length > 0 || texts.length > 0)) {
    onProgress?.('라인 합성본 업로드 중…');
    flatPath = `${base}_lined.jpg`;
    const flatRef = ref(storage, flatPath);
    await putFile(flatRef, flatUri);
    flatUrl = await getDownloadURL(flatRef);
  }

  onProgress?.('등록 중…');
  await addDoc(collection(db, 'concept_photos'), {
    conceptId: concept.id,
    conceptSource: concept.source,
    conceptTitle: conceptPhotoTitle(concept),
    authorUid: user.uid,
    authorEmail: user.email ?? '',
    imageUrl,
    storagePath: rawPath,
    flatUrl,
    flatPath,
    lines,
    texts,
    // 규칙상 pending 외의 값으로는 생성할 수 없다
    status: 'pending' as const,
    createdAt: serverTimestamp(),
  });
}
