/**
 * 사진 선택·업로드 공통 옵션.
 *
 * ── 왜 플랫폼별로 다른가 (2026-08-05 실측) ─────────────────────────────
 *
 * **Android — 축소한다.**
 *   원본 해상도 그대로 고르면 최신 폰은 한 장이 5,000만 화소가 넘는다.
 *   미리보기로 디코딩하는 순간 수백 MB를 쓰고, 업로드 중 다른 탭으로 가면
 *   메모리 부족으로 **앱이 그냥 죽는다.** 긴 변 2048px로 줄여서 막는다.
 *
 * **iOS — 축소하지 않는다.**
 *   `maxWidth`/`maxHeight`를 주면 iOS의 사진 요청이 **저해상도 임시본(degraded)을
 *   먼저 돌려주고**, 라이브러리가 그걸 그대로 저장해 버린다.
 *   → 처음 첨부하면 모자이크처럼 뭉개져 보이고, 나갔다 다시 첨부하면 정상으로 보인다
 *     (사용자 스크린샷으로 확인. 매번 같은 패턴이었다).
 *   iOS는 메모리 압박으로 죽는 사례가 없었으므로 **원본 그대로 받는다.**
 *
 * 즉 여기서의 차이는 취향이 아니라 **각 OS에서 실제로 터진 문제**에 맞춘 것이다.
 * 한쪽 값을 다른 쪽에 그대로 옮기면 그 OS의 문제가 되살아난다.
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
