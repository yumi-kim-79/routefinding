/**
 * 사진 선택·업로드 공통 옵션.
 *
 * **Android — 축소한다.**
 *   원본 해상도 그대로 고르면 최신 폰은 한 장이 5,000만 화소가 넘는다.
 *   미리보기로 디코딩하는 순간 수백 MB를 쓰고, 업로드 중 다른 탭으로 가면
 *   메모리 부족으로 **앱이 그냥 죽는다.** 긴 변 2048px로 줄여서 막는다 (2026-08-05 실측).
 *
 * **iOS — 지금은 원본.**
 *   "첫 첨부만 모자이크로 보인다"는 증상의 원인으로 `maxWidth`를 의심해 iOS에서 뺐는데,
 *   빼고도 증상이 그대로였다. **진짜 원인은 편집기 레이아웃 타이밍**이었다
 *   (캔버스 크기를 재기 전에 `<Image>`가 마운트돼 iOS가 1px 비트맵을 캐시 —
 *    `ConceptPhotoEditor.tsx`의 주석 참조).
 *   그 문제를 고친 뒤 iOS에도 축소를 되살릴 수 있다. 한 번에 하나씩 확인하려고
 *   이번에는 원본 그대로 둔다. [TODO] 확인되면 축소 복원 (업로드 용량·시간이 준다)
 */
import { Platform } from 'react-native';
import type {
  CameraOptions,
  ImageLibraryOptions,
  PhotoQuality,
} from 'react-native-image-picker';

export const MAX_IMAGE_EDGE = 2048;
/** 라이브러리가 0.1 단위 리터럴 유니온만 받는다 */
export const IMAGE_QUALITY: PhotoQuality = 0.8;

/** Android에서만 축소 옵션을 얹는다 (위 주석 참조) */
const resizeOptions =
  Platform.OS === 'android'
    ? { maxWidth: MAX_IMAGE_EDGE, maxHeight: MAX_IMAGE_EDGE, quality: IMAGE_QUALITY }
    : {};

/** 앨범에서 고르기 */
export function libraryOptions(selectionLimit: number): ImageLibraryOptions {
  return { mediaType: 'photo', selectionLimit, ...resizeOptions };
}

/** 카메라로 촬영 */
export function cameraOptions(): CameraOptions {
  return { mediaType: 'photo', saveToPhotos: false, ...resizeOptions };
}
