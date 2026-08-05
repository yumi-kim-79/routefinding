/**
 * 사진 선택·업로드 공통 옵션.
 *
 * ⚠️ 실측 (2026-08-05, 안드로이드):
 *   원본 해상도 그대로 고르면 최신 폰은 한 장이 5000만 화소가 넘는다.
 *   미리보기로 디코딩하는 순간 수백 MB를 쓰고, 업로드 중 다른 탭으로 가면
 *   메모리 부족으로 **앱이 그냥 죽는다.**
 *   → 고르는 단계에서 긴 변 2048px로 줄인다. 개념도·루트 사진 용도로는 충분하고
 *     (2048px면 라인 그리기·확대에도 문제없다) 업로드 시간과 Storage 사용량도 크게 준다.
 *     2026-08-03 Storage 일일 한도 초과 이력도 있어 용량을 줄이는 편이 안전하다.
 */
import type {
  CameraOptions,
  ImageLibraryOptions,
  PhotoQuality,
} from 'react-native-image-picker';

export const MAX_IMAGE_EDGE = 2048;
/** 라이브러리가 0.1 단위 리터럴 유니온만 받는다 */
export const IMAGE_QUALITY: PhotoQuality = 0.8;

/** 앨범에서 고르기 */
export function libraryOptions(selectionLimit: number): ImageLibraryOptions {
  return {
    mediaType: 'photo',
    selectionLimit,
    maxWidth: MAX_IMAGE_EDGE,
    maxHeight: MAX_IMAGE_EDGE,
    quality: IMAGE_QUALITY,
  };
}

/** 카메라로 촬영 */
export function cameraOptions(): CameraOptions {
  return {
    mediaType: 'photo',
    saveToPhotos: false,
    maxWidth: MAX_IMAGE_EDGE,
    maxHeight: MAX_IMAGE_EDGE,
    quality: IMAGE_QUALITY,
  };
}
