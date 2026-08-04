#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>
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
