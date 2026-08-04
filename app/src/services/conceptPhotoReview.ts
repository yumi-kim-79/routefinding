/**
 * 개념도 사진 검토(승인·반려·삭제) — 웹 `MyPageView.vue`의 approvePhoto/rejectPhoto와 1:1.
 *
 * 보안 규칙(`firestore.rules` §4)상
 *   · 조회: 승인된 것 / 본인 것 / 관리자 전체
 *   · 생성: 본인 uid + status 'pending' 강제 (스스로 승인 불가)
 *   · 수정·삭제: 관리자, 또는 승인 전 본인
 * 쿼리도 규칙에 맞춰야 permission-denied로 리스너가 죽지 않는다.
 */
import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from '@react-native-firebase/firestore';
import { db } from './firebase';
import type { ConceptPhoto } from '../types/conceptPhoto';

export type ApplyMode = 'add' | 'replace';

/**
 * 검토 대기 목록 구독.
 * 관리자는 pending·rejected 전체, 일반 사용자는 본인 것만 (규칙과 동일 조건).
 * 승인된 건 이미 개념도에 반영됐으므로 목록에서 뺀다.
 */
export function subscribeConceptPhotos(
  uid: string,
  isAdmin: boolean,
  onData: (rows: ConceptPhoto[]) => void,
  onError: (message: string) => void,
): () => void {
  const col = collection(db, 'concept_photos');
  const q = isAdmin
    ? query(col, where('status', 'in', ['pending', 'rejected']))
    : query(col, where('authorUid', '==', uid));

  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<ConceptPhoto, 'id'>) }))
        .filter((p) => p.status !== 'approved')
        .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
      onData(rows);
    },
    (e) => onError(e.message),
  );
}

/**
 * 승인. `mode='add'`면 기존 사진에 덧붙이고, `'replace'`면 이 사진 하나로 교체한다.
 *
 * ⚠️ 개념도에 넣는 URL은 **라인 합성본(flatUrl)**이다. 선을 안 그렸으면 원본.
 *    목록·캐러셀·뷰어는 URL을 그냥 이미지로 띄우므로 원본을 넣으면 라인이 사라진다.
 */
export async function approveConceptPhoto(
  photo: ConceptPhoto,
  mode: ApplyMode,
  reviewerUid: string,
): Promise<void> {
  const finalUrl = photo.flatUrl || photo.imageUrl;
  const conceptRef = doc(db, photo.conceptSource || 'route_reports', photo.conceptId);

  await updateDoc(
    conceptRef,
    mode === 'replace'
      ? { imageUrls: [finalUrl], imageUrl: finalUrl }
      : { imageUrls: arrayUnion(finalUrl) },
  );

  await updateDoc(doc(db, 'concept_photos', photo.id), {
    status: 'approved',
    applyMode: mode,
    reviewedAt: serverTimestamp(),
    reviewedBy: reviewerUid,
  });
}

export async function rejectConceptPhoto(
  photo: ConceptPhoto,
  reason: string,
  reviewerUid: string,
): Promise<void> {
  await updateDoc(doc(db, 'concept_photos', photo.id), {
    status: 'rejected',
    rejectionReason: reason,
    reviewedAt: serverTimestamp(),
    reviewedBy: reviewerUid,
  });
}

/** 승인 전 본인 취소 (규칙상 approved는 본인도 못 지운다) */
export async function deleteConceptPhoto(photo: ConceptPhoto): Promise<void> {
  await deleteDoc(doc(db, 'concept_photos', photo.id));
}
