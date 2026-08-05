# ─────────────────────────────────────────────────────────────────────────
# R8/ProGuard 규칙 (2026-08-05 — release 코드 축소 켜면서 작성)
#
# 대부분의 라이브러리는 자기 consumer-rules.pro를 함께 배포하므로 여기 다시 적지 않는다.
# 아래는 **리플렉션·JNI로 접근돼 R8이 쓰임을 알 수 없는 것들**만 지킨다.
# 규칙이 모자라면 증상은 보통 "특정 화면만 죽는다"로 나타난다.
# 그럴 땐 build.gradle의 enableProguardInReleaseBuilds 를 false 로 되돌리고 보고할 것.
# ─────────────────────────────────────────────────────────────────────────

# React Native — JNI/리플렉션으로 접근하는 진입점들
-keep,allowobfuscation @interface com.facebook.proguard.annotations.DoNotStrip
-keep,allowobfuscation @interface com.facebook.proguard.annotations.KeepGettersAndSetters
-keep @com.facebook.proguard.annotations.DoNotStrip class *
-keepclassmembers class * {
    @com.facebook.proguard.annotations.DoNotStrip *;
}
-keepclassmembers class * {
    @com.facebook.react.uimanager.annotations.ReactProp <methods>;
    @com.facebook.react.uimanager.annotations.ReactPropGroup <methods>;
}
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.hermes.unicode.** { *; }

# Firebase / Google Play services — 모델 클래스를 리플렉션으로 만든다
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# Firestore가 문서 ↔ 객체 변환에 쓰는 어노테이션
-keepattributes Signature,InnerClasses,EnclosingMethod,*Annotation*

# 이 앱의 네이티브 모듈들 (지도·SVG·캡처·사진·위치·문서선택)
-keep class com.rnmaps.** { *; }
-keep class com.horcrux.svg.** { *; }
-keep class fr.greweb.reactnativeviewshot.** { *; }
-keep class com.imagepicker.** { *; }
-keep class com.reactnativecommunity.geolocation.** { *; }
-keep class com.reactnativedocumentpicker.** { *; }

# OkHttp / Okio — 네트워크 스택 경고 억제
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**
