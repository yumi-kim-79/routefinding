# ─────────────────────────────────────────────────────────────────────────
# R8/ProGuard 규칙 (2026-08-05 — release 코드 축소용)
#
# 대부분의 라이브러리는 자기 consumer-rules.pro를 함께 배포하므로 여기 다시 적지 않는다.
# 아래는 **리플렉션·JNI로 접근돼 R8이 쓰임을 알 수 없는 것들**만 지킨다.
#
# ⚠️⚠️ 실패 기록 (2026-08-05, 실기기에서 앱이 시작 즉시 죽음) ⚠️⚠️
#   java.lang.NoSuchFieldError: no type "Lcom/facebook/react/fabric/Binding;" found
#     and so no field "mBinding" could be found in class "FabricUIManager"
#   → TypeError: Cannot read property 'ScreenStack' of undefined
#
#   원인: `-keepclassmembers` 만 쓰면 **필드는 남기지만 그 필드의 "타입 클래스"는
#         지워도 된다**고 R8이 판단한다. `mBinding`은 남았는데 그 타입인
#         `com.facebook.react.fabric.Binding` 이 사라져 JNI가 필드를 못 찾았다.
#   해결: **`includedescriptorclasses`** — "이 멤버가 참조하는 타입까지 같이 지켜라".
#         New Architecture(Fabric)는 자바 필드를 C++에서 직접 읽으므로 필수다.
#
#   규칙이 모자라면 증상은 "앱이 바로 죽는다" 또는 "특정 화면만 죽는다"로 나온다.
#   급하면 build.gradle 의 enableProguardInReleaseBuilds 를 false 로 되돌릴 것
#   (APK가 10MB 남짓 커지는 대신 확실히 동작한다).
# ─────────────────────────────────────────────────────────────────────────

# ── React Native — JNI/리플렉션 진입점 ────────────────────────────────────
# includedescriptorclasses: 멤버가 참조하는 타입 클래스까지 함께 보존 (위 실패 기록 참조)
-keep,allowobfuscation @interface com.facebook.proguard.annotations.DoNotStrip
-keep,allowobfuscation @interface com.facebook.proguard.annotations.KeepGettersAndSetters
-keep @com.facebook.proguard.annotations.DoNotStrip class *
-keep @com.facebook.common.internal.DoNotStrip class *
-keepclassmembers,includedescriptorclasses class * {
    @com.facebook.proguard.annotations.DoNotStrip *;
    @com.facebook.common.internal.DoNotStrip *;
}
# 네이티브 메서드와 그 시그니처에 등장하는 타입 (JNI가 이름으로 찾는다)
-keepclassmembers,includedescriptorclasses class * {
    native <methods>;
}
-keepclassmembers class * {
    @com.facebook.react.uimanager.annotations.ReactProp <methods>;
    @com.facebook.react.uimanager.annotations.ReactPropGroup <methods>;
}

# New Architecture 핵심 — 자바 필드를 C++에서 직접 읽는다. 이름이 바뀌면 못 찾는다.
-keep,includedescriptorclasses class com.facebook.react.fabric.** { *; }
-keep,includedescriptorclasses class com.facebook.react.turbomodule.** { *; }
-keep,includedescriptorclasses class com.facebook.react.runtime.** { *; }
-keep,includedescriptorclasses class com.facebook.react.uimanager.** { *; }
-keep,includedescriptorclasses class com.facebook.react.bridge.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.hermes.** { *; }
-dontwarn com.facebook.**

# ── Firebase / Google Play services — 모델 클래스를 리플렉션으로 만든다 ────
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# Firestore가 문서 ↔ 객체 변환에 쓰는 어노테이션
-keepattributes Signature,InnerClasses,EnclosingMethod,*Annotation*

# ── 이 앱의 네이티브 모듈들 ───────────────────────────────────────────────
# 화면(Fabric 컴포넌트) — ScreenStack이 위 크래시에 함께 등장했다
-keep class com.swmansion.rnscreens.** { *; }
-keep class com.th3rdwave.safeareacontext.** { *; }
-keep class com.rnmaps.** { *; }
-keep class com.horcrux.svg.** { *; }
-keep class fr.greweb.reactnativeviewshot.** { *; }
-keep class com.imagepicker.** { *; }
-keep class com.reactnativecommunity.geolocation.** { *; }
-keep class com.reactnativedocumentpicker.** { *; }
# AdMob 래퍼 (구글 SDK 자체는 위 gms 규칙이 덮는다)
-keep class io.invertase.googlemobileads.** { *; }

# ── OkHttp / Okio — 네트워크 스택 경고 억제 ───────────────────────────────
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**
