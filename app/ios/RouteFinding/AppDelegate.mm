#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>
#import <ReactAppDependencyProvider/RCTAppDependencyProvider.h>
#import <Firebase.h>
#import <GoogleMaps/GoogleMaps.h>

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  // ⚠️ Google Maps: 공식 문서상 **이 메서드의 첫 호출**이어야 한다.
  //    키는 Google Cloud Console에서 'Maps SDK for iOS' 사용 설정 후 발급.
  //    앱 제한: 번들 ID com.yusung.routefinding
  [GMSServices provideAPIKey:@"AIzaSyACWK8O4lm8-BYPZxrivajB1i58xVb2eS4"];

  // React Native Firebase: 기본 앱 초기화 (GoogleService-Info.plist 기반)
  if ([FIRApp defaultApp] == nil) {
    [FIRApp configure];
  }

  self.moduleName = @"RouteFinding";
  // You can add your custom initial props in the dictionary below.
  // They will be passed down to the ViewController used by React Native.
  self.initialProps = @{};

  /*
   * 🚨 RN 0.77+ 필수 — 빠지면 **실행 즉시 크래시**한다.
   *    (2026-08-14 App Store Guideline 2.1(a) 반려의 원인. 빌드 2.0.0(4))
   *
   *    React Native 0.77 부터 AppDelegate 는 서드파티 네이티브 모듈·Fabric 컴포넌트
   *    목록을 넘겨줄 `dependencyProvider` 를 반드시 설정해야 한다.
   *    RN 0.76.9 에는 없던 요구사항이라, 0.81.6 으로 올리면서 AppDelegate 를
   *    갱신하지 않아 누락됐다.
   *
   *    프로퍼티 자체는 프로토콜에 선언돼 있어 **컴파일은 그냥 통과한다.**
   *    실패는 런타임에만 드러난다:
   *      react-native/Libraries/AppDelegate/RCTReactNativeFactory.mm:194
   *        if (self.delegate.dependencyProvider == nil) {
   *          [NSException raise:@"ReactNativeFactoryDelegate dependencyProvider is nil"
   *                      format:@"Delegate must provide a valid dependencyProvider"];
   *
   *    ⚠️ 반드시 `[super application:...]` **앞에서** 설정한다.
   *       super 가 React Native 를 기동하기 때문이다.
   *
   *    ⚠️ `RCTAppDependencyProvider` 는 `pod install` 이 생성하는 코드다
   *       (`ios/build/generated/ios/`, pod 이름 `ReactAppDependencyProvider`).
   *       Pods 를 지우고 다시 깔면 함께 재생성된다.
   */
  self.dependencyProvider = [RCTAppDependencyProvider new];

  return [super application:application didFinishLaunchingWithOptions:launchOptions];
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self bundleURL];
}

- (NSURL *)bundleURL
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

@end
