package com.thereprocase.bambubridge.pairing

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class SecureBridgePackage : ReactPackage {
    override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> =
        listOf(SecureBridgeModule(context))
    override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> =
        listOf(PairedViewerManager())
}
