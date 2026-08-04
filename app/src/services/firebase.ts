/**
 * Firebase 초기화 / 접근 모듈
 *
 * React Native Firebase는 네이티브 설정 파일
 * (Android: `android/app/google-services.json`,
 *  iOS: `ios/RouteFinding/GoogleService-Info.plist`)
 * 을 읽어 **기본 앱을 자동 초기화**한다. 따라서 별도 FirebaseOptions
 * 하드코딩은 하지 않는다(기존 v1 Firebase 프로젝트 `routefinding09-4b597` 재사용).
 *
 * - 모든 Firebase 호출은 이 모듈을 통해 인스턴스를 얻는다(비용 호출 격리, docs/03 원칙).
 * - App Check provider는 docs/02_DATA_MODEL.md 명세를 따른다:
 *   Android = Play Integrity, iOS = DeviceCheck.
 *   개발 빌드(__DEV__)는 에뮬레이터/시뮬레이터에서 동작하도록 debug provider 사용.
 */
import { getApp } from '@react-native-firebase/app';
import { getAuth } from '@react-native-firebase/auth';
import { getFirestore } from '@react-native-firebase/firestore';
import { getStorage } from '@react-native-firebase/storage';
import { getMessaging } from '@react-native-firebase/messaging';
import {
  ReactNativeFirebaseAppCheckProvider,
  initializeAppCheck,
} from '@react-native-firebase/app-check';

export const app = getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const messaging = getMessaging(app);

let appCheckInitialized = false;

/**
 * App Check 활성화. 앱 부팅 시 1회 호출(중복 호출 가드 포함).
 * 실패해도 앱 부팅을 막지 않는다(네트워크 약한 자연암벽 환경 고려).
 */
export async function initAppCheck(): Promise<void> {
  if (appCheckInitialized) {
    return;
  }
  appCheckInitialized = true;

  // RNFB v25부터 모듈러 방식. 구 `firebase.appCheck().newReactNativeFirebaseAppCheckProvider()`는
  // deprecated이며 v26에서 네임스페이스 API와 함께 제거된다.
  const provider = new ReactNativeFirebaseAppCheckProvider();

  provider.configure({
    android: {
      // 개발: debug 토큰, 배포: Play Integrity (docs/02_DATA_MODEL.md)
      provider: __DEV__ ? 'debug' : 'playIntegrity',
    },
    apple: {
      // 개발: debug 토큰, 배포: DeviceCheck (docs/02_DATA_MODEL.md)
      // [TBD] RNFB 현재 권장값은 'appAttestWithDeviceCheckFallback'이다.
      //   App Attest는 Firebase 콘솔에서 별도 등록이 필요하므로,
      //   iOS 빌드가 복구되고 실기기 검증이 끝난 뒤 전환을 검토한다.
      provider: __DEV__ ? 'debug' : 'deviceCheck',
    },
  });

  try {
    await initializeAppCheck(app, {
      provider,
      isTokenAutoRefreshEnabled: true,
    });
  } catch (e) {
    // App Check 초기화 실패 시에도 앱은 계속 동작(서버 규칙이 enforce면 쓰기만 거부됨)
    console.warn('[firebase] App Check 초기화 실패:', e);
  }
}
