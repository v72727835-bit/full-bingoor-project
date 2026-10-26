# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# --- React Native core (R8/ProGuard enabled for release; rider audit Issue 4) ---
# Most RN libraries ship their own consumer ProGuard rules via autolinking, but
# keep the obvious reflection surfaces so release builds don't crash.
-keep,allowobfuscation @interface com.facebook.proguard.annotations.DoNotStrip
-keep,allowobfuscation @interface com.facebook.proguard.annotations.KeepGettersAndSetters
-keep @com.facebook.proguard.annotations.DoNotStrip class *
-keepclassmembers class * { @com.facebook.proguard.annotations.DoNotStrip *; }
-keepclassmembers class * { @com.facebook.react.bridge.ReactMethod *; }
-keep class com.facebook.react.bridge.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }
-keep class com.facebook.jni.** { *; }

# Hermes
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.jni.** { *; }

# OkHttp / Okio (used by React Native networking / fetch)
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**

# react-native-webview (the OSM map), keychain, geolocation, reanimated, svg
-keep class com.reactnativecommunity.webview.** { *; }
-keep class com.oblador.keychain.** { *; }
-keep class com.reactnativecommunity.geolocation.** { *; }
-keep class com.swmansion.reanimated.** { *; }
-keep class com.horcrux.svg.** { *; }

# Keep JS-callable native module/view manager classes (names used across the bridge)
-keep class * extends com.facebook.react.bridge.NativeModule { *; }
-keep class * extends com.facebook.react.uimanager.ViewManager { *; }
-keep class * extends com.facebook.react.bridge.BaseJavaModule { *; }
