/**
 * 프로필 사진 업로드 서비스.
 *
 * CLAUDE.md: 비용 발생 호출(Storage 쓰기)은 service 모듈로 격리한다.
 *
 * 저장 경로는 **웹과 동일**하게 맞춘다 — `profile_photos/{uid}.jpg`
 * (웹 MyProfileTab.vue, storage.rules의 `profile_photos/{fileName}` 규칙과 1:1).
 * storage.rules: 본인 uid.jpg만 읽기/쓰기 허용.
 *
 * 업로드 후 users/{uid}.photoUrl 갱신은 호출부(userStore.updateProfile)가 담당한다.
 */
import { getDownloadURL, putFile, ref } from '@react-native-firebase/storage';
import { storage } from './firebase';

/** 웹과 동일한 경로 규칙 */
export function profilePhotoPath(uid: string): string {
  return `profile_photos/${uid}.jpg`;
}

/**
 * 로컬 파일(image-picker가 준 uri)을 Storage에 올리고 다운로드 URL을 돌려준다.
 * @param uid   사용자 UID (경로 = profile_photos/{uid}.jpg)
 * @param localUri image-picker asset.uri (file:// 또는 content://)
 */
export async function uploadProfilePhoto(
  uid: string,
  localUri: string,
): Promise<string> {
  const storageReference = ref(storage, profilePhotoPath(uid));
  await putFile(storageReference, localUri);
  return getDownloadURL(storageReference);
}
