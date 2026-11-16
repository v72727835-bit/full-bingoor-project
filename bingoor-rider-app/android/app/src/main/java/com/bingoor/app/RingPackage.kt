package com.bingoor.app

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/** Registers [RingModule] (the loud bell) with React Native. */
class RingPackage : ReactPackage {
  @Deprecated("Required by ReactPackage")
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> = listOf(RingModule(reactContext))

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<in Nothing, in Nothing>> = emptyList()
}
