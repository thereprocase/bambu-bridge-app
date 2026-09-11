# Android 0.20.0 — camera, viewing, and print alerts

Install the APK as an update. The package and signing identity are unchanged;
saved bridge settings and secure pairing are retained. Android 7 or newer,
ARM64. Bridge 0.5.0 is recommended for camera recovery and faster 3D loading.

## Camera and 3D

- Continuous authenticated camera streaming replaces snapshot polling. Frames
  decode on Android without repeatedly converting images to base64 in JavaScript.
  The displayed FPS is measured; the printer determines the available rate.
- Open the camera fullscreen, rotate the phone, and pinch to zoom. Double tap
  toggles zoom. Settings has an optional keep-screen-awake toggle for fullscreen
  camera and 3D; leaving the view releases it.
- Camera freshness is measured by the last displayed frame. A stale image is
  dimmed and shows its age. Connections retry with bounded backoff, and camera
  traffic stops when its screen is hidden or the app goes into the background.
- Network changes and returning to the app refresh the connection selection.
  Camera and live status reconnect; the 3D viewer reloads its route. Failed
  printer commands are never automatically replayed.
- Paired HTTPS reads recover when an idle pooled connection has closed. Reads
  retain the same identity checks and redirect restrictions; commands are not retried.
- Completed and failed jobs can open in 3D while the bridge still has their job
  data. This does not enable print controls or create a permanent model archive.

## Print alerts

On **Status**, tap **Enable print alerts** and allow Android notifications.
The app runs a native foreground service that monitors the selected printer's
status connection, independently of the JavaScript screen. A persistent
notification shows connection/progress status and includes **Stop monitoring**.
The monitor does not stream the camera or send printer commands.

Alerts cover completion, pauses, failed prints, and new printer errors. Repeated
snapshots/reconnects do not repeat the same alert; opening the app on an already
completed historical job does not send a completion alert. Monitoring continues
between jobs until stopped. Starting monitoring on a different printer requires
stopping the current monitor first.

For more reliable delivery while locked, use **Allow background connection**
when offered. Android may otherwise suspend networking during deep sleep.
Monitoring requires a working LAN/Tailscale connection; during an outage alerts
are delayed, and short-lived events that occur entirely during the outage may
be missed. Force-stopping the app or rebooting the phone requires enabling
monitoring again. No third-party push service is used.

The service's restart state is encrypted with Android Keystore and stored in
the app's no-backup directory. Disconnecting/changing the bridge stops the
monitor and removes its saved service credential. Paired credentials remain
HTTPS-only and verify the paired identity; manual HTTP compatibility remains.

## Connection checks

**Settings → Check connection** tests configured routes, authentication, server
version, printer connection, a camera frame, and the viewer page. Job metadata
indicates whether a model is available; open the viewer to verify rendering.
The shareable report uses fixed result categories and excludes credentials,
addresses, printer identifiers, and job names.

## Source and verification

Corresponding source is tagged **v0.20.0**, under AGPL-3.0-only. Release checks
include TypeScript, Jest, ESLint, native camera/parser/alert/TLS tests, and APK
package and signing-certificate verification. See the release notes for the
final acceptance results and any device-testing limitations.
