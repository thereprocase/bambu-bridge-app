# Android 0.20.2

Status and Filament now show per-unit AMS numeric relative humidity and temperature, from the optional bridge `ams.units` block. Older bridges remain supported; absent or invalid readings are unavailable and disconnected cached readings are labeled last known.

Version code 26, package `com.anonymous.bambubridgeapp`. The release APK retains the existing signing identity for an in-place update. Download it from the bridge dashboard's Install Android app link. Open the APK on Android, allow the browser to install apps if prompted, and choose Update. Existing pairing is retained; no uninstall is needed.

Validation: TypeScript and 416 JavaScript tests passed; signed arm64 release and native release unit tests passed. Signature verified against the installed-app reference. Physical phone installation remains a user step.
