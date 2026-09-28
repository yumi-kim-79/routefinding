/**
 * 회원 탈퇴 (계정 삭제) 서비스.
 *
 * ⚠️ App Store 심사 대응 (2026-08-12 반려, Guideline 5.1.1(v))
 *   > "The app supports account creation but does not include an option to
 *   >  initiate account deletion."
 *   계정 생성이 있는 앱은 **앱 안에서** 계정 삭제를 제공해야 한다.
 *   일시 정지·비활성화만으로는 불충분하고, 고객센터 연락을 요구해서도 안 된다.
 *
 * 삭제 범위 (사용자 결정 2026-08-12):
 *   ✅ 지운다 — 개인 데이터
 *      users/{uid}                       프로필(닉네임·이메일·사진·소개)
 *      users/{uid}/my_routes/*           즐겨찾기
 *      users/{uid}/climbing_logs/*       등반일지
 *      concept_photos (내가 올린 것)     개념도 사진 + 라인
 *      route_reports / bouldering_reports 중 **승인 전(draft·pending·rejected)** 내 제보
 *      Firebase Auth 계정 자체
 *
 *   ⏸️ 남긴다 — 승인된 루트 제보(공개 등반 정보)
 *      커뮤니티 자산이라 지우면 다른 사용자가 보던 개념도가 사라진다.
 *      보안 규칙상 승인된 제보는 본인도 삭제할 수 없다(관리자만).
 *      계정이 사라지므로 이름·이메일과 연결되지 않는다.
 *
 * Firebase 제약:
 *   `deleteUser()`는 최근 로그인을 요구한다(`auth/requires-recent-login`).
 *   → 비밀번호 재확인 후 `reauthenticateWithCredential`을 먼저 호출한다.
 *
 * ⚠️ Firestore 삭제를 **먼저** 하고 Auth 계정을 **나중에** 지운다.
 *    순서를 바꾸면 인증이 사라져 보안 규칙에 막혀 데이터가 고아로 남는다.
 */
import {
  EmailAuthProvider,
  deleteUser,
  reauthenticateWithCredential,
} from '@react-native-firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
} from '@react-native-firebase/firestore';
import { auth, db } from './firebase';
import { COLLECTIONS, SUBCOLLECTIONS } from '../constants/firestoreFields';

/** 진행 상황 콜백 (UI에 단계 표시용) */
export type DeletionProgress = (message: string) => void;

/** 승인된 제보는 본인이 지울 수 없다 — 이 상태만 삭제 대상 */
const DELETABLE_REPORT_STATUS = ['draft', 'pending', 'rejected'];

/** 서브컬렉션 문서 전부 삭제 (개인 데이터라 건수가 적어 클라이언트에서 처리 가능) */
async function deleteSubcollection(uid: string, name: string): Promise<number> {
  const snap = await getDocs(collection(doc(db, COLLECTIONS.USERS, uid), name));
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  return snap.size;
}

/** 특정 컬렉션에서 내가 쓴 **승인 전** 문서만 삭제 */
async function deleteMyPendingDocs(
  collectionName: string,
  uid: string,
): Promise<number> {
  const snap = await getDocs(
    query(collection(db, collectionName), where('authorUid', '==', uid)),
  );
  const targets = snap.docs.filter((d) => {
    const status = (d.data() as { status?: string }).status ?? 'draft';
    return DELETABLE_REPORT_STATUS.includes(status);
  });
  await Promise.all(targets.map((d) => deleteDoc(d.ref)));
  return targets.length;
}

/**
 * 비밀번호를 재확인해 최근 로그인 상태로 만든다.
 * @throws 비밀번호가 틀리면 Firebase 에러 그대로
 */
export async function reauthenticate(password: string): Promise<void> {
  const user = auth.currentUser;
  if (!user?.email) {
    throw new Error('로그인 정보를 찾을 수 없습니다. 다시 로그인해 주세요.');
  }
  const credential = EmailAuthProvider.credential(user.email, password);
  await reauthenticateWithCredential(user, credential);
}

export interface DeletionSummary {
  favorites: number;
  climbingLogs: number;
  photos: number;
  pendingReports: number;
}

/**
 * 계정과 개인 데이터를 삭제한다.
 * 호출 전에 반드시 `reauthenticate()`로 비밀번호를 확인할 것.
 */
export async function deleteAccount(
  onProgress?: DeletionProgress,
): Promise<DeletionSummary> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('로그인 상태가 아닙니다.');
  }
  const uid = user.uid;

  onProgress?.('즐겨찾기 삭제 중…');
  const favorites = await deleteSubcollection(uid, SUBCOLLECTIONS.MY_ROUTES);

  onProgress?.('등반일지 삭제 중…');
  const climbingLogs = await deleteSubcollection(uid, 'climbing_logs');

  onProgress?.('등록한 사진 삭제 중…');
  // concept_photos는 승인 여부와 무관하게 본인 것을 지운다
  // (사진은 개인이 올린 콘텐츠이고, 규칙상 승인된 건 관리자만 지울 수 있어 실패는 무시)
  const photoSnap = await getDocs(
    query(collection(db, 'concept_photos'), where('authorUid', '==', uid)),
  );
  let photos = 0;
  for (const d of photoSnap.docs) {
    try {
      await deleteDoc(d.ref);
      photos += 1;
    } catch {
      // 승인된 사진은 규칙상 관리자만 삭제 가능 — 건너뛴다
    }
  }

  onProgress?.('승인 전 제보 삭제 중…');
  let pendingReports = 0;
  for (const col of ['route_reports', 'bouldering_reports']) {
    try {
      pendingReports += await deleteMyPendingDocs(col, uid);
    } catch {
      // 한쪽 컬렉션이 막혀도 탈퇴 자체는 진행한다
    }
  }

  onProgress?.('프로필 삭제 중…');
  await deleteDoc(doc(db, COLLECTIONS.USERS, uid));

  onProgress?.('계정 삭제 중…');
  // ⚠️ 반드시 마지막. 먼저 지우면 인증이 사라져 위 삭제들이 규칙에 막힌다.
  await deleteUser(user);

  return { favorites, climbingLogs, photos, pendingReports };
}
