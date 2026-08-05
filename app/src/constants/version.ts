/**
 * 앱 버전 · 스토어 주소 — **업데이트 안내의 기준값**.
 *
 * ⚠️ 버전의 단일 소스는 `app/package.json` 의 `version` 이다.
 *    Android `versionName` 도 gradle이 같은 파일에서 읽는다(android/app/build.gradle).
 *    → **출시할 때 package.json 의 version 하나만 올리면 된다.**
 *
 * ⚠️ iOS 는 Xcode 의 `MARKETING_VERSION` 을 손으로 맞춰야 한다
 *    (Xcode 프로젝트 설정은 빌드 시점에 JS를 읽지 못한다).
 *    안 맞으면 App Store 표시 버전만 어긋나고, 업데이트 판정은 아래 APP_VERSION 을 따른다.
 */
import { Platform } from 'react-native';
const pkg = require('../../package.json') as { version: string };

/** 현재 설치된 앱 버전 (예: '2.0.0') */
export const APP_VERSION: string = pkg.version;

export const ANDROID_PACKAGE = 'com.yusung.routefinding';

/**
 * App Store 숫자 ID.
 * [TODO] App Store Connect 에 앱을 만들면 채운다 (예: '6501234567').
 *   비어 있으면 iOS는 Remote Config 의 `store_url_ios` 를 써야 한다.
 */
export const APP_STORE_ID = '';

/** 스토어로 보내는 기본 주소 (Remote Config 로 덮어쓸 수 있다) */
export function defaultStoreUrl(): string {
  if (Platform.OS === 'android') {
    // market:// 는 Play 앱을 바로 연다. 없으면 updateService 가 https 로 재시도한다.
    return `market://details?id=${ANDROID_PACKAGE}`;
  }
  return APP_STORE_ID ? `itms-apps://apps.apple.com/app/id${APP_STORE_ID}` : '';
}

/** market:// 가 실패했을 때 쓸 웹 주소 */
export function webStoreUrl(): string {
  if (Platform.OS === 'android') {
    return `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
  }
  return APP_STORE_ID ? `https://apps.apple.com/app/id${APP_STORE_ID}` : '';
}
