package com.bingoor.app

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      useDevSupport = BuildConfig.DEBUG,
      packageList =
        PackageList(this).packages.apply {
          // The loud booking / order bell (RingModule).
          add(RingPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    // The ring channel must exist before the first ring push, even if the app is never opened again.
    RingModule.ensureChannel(this)
    loadReactNative(this)
  }
}
