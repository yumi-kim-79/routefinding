/**
 * Firebase 프로젝트 상수.
 *
 * ⚠️ Cloud Functions 주소는 **프로젝트 ID + 리전**으로 정해진다.
 *    프로젝트를 옮기거나 함수 리전을 바꾸면 여기도 같이 고쳐야 한다.
 *    (현재 functions/index.js 는 리전을 지정하지 않아 기본값 us-central1 이다)
 */
export const FIREBASE_PROJECT_ID = 'routefinding09-4b597';
export const FUNCTIONS_REGION = 'us-central1';

export const FUNCTIONS_BASE_URL =
  `https://${FUNCTIONS_REGION}-${FIREBASE_PROJECT_ID}.cloudfunctions.net`;
