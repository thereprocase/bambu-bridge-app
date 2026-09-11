# Android 0.20.1 — recovery fixes and less background work

Install this APK over the existing app. The package and signing identity are
unchanged, so settings and pairing remain available.

## Fixes

- A live-status connection that stops receiving data now expires after 65 seconds
  and reconnects. The first snapshot still has a 15-second deadline. Controls lose
  their live-state permission immediately on timeout, including when the socket
  fails to deliver its close callback. Commands are never automatically replayed.
- An unsliced model can fall back from toolpath loading to mesh loading without
  leaving an error overlay over the completed viewer. A recovered page can clear
  a loading error; authentication and bridge-identity failures remain blocked.
- A temporary failure saving print-monitor state no longer consumes a completion,
  failure, pause, or error transition before its notification can be posted.
  Disconnecting or replacing a monitoring session still suppresses old events.

## Less unnecessary work

- Native camera frames continue at the available rate. FPS/age display updates
  and endpoint-health bookkeeping are throttled independently of image delivery.
- Live snapshots update memory immediately. Ordinary persistent cache writes are
  coalesced over five seconds, with immediate writes for the first snapshot and
  meaningful job/phase changes, and a flush on background/connection close.
  Cache errors do not interrupt telemetry; cached data does not authorize controls.

## Verification

GitHub CI now compiles Android Kotlin and runs native regression tests without
release-signing credentials, alongside TypeScript, Jest, and ESLint. Regression
coverage includes stalled sockets, missing/throwing close callbacks, viewer
fallback and trust errors, save-failure recovery, camera HUD cadence, and snapshot
cache behavior. See the release notes for final counts and device acceptance.

The background-alert delivery limits in [0.20.0](RELEASE-0.20.0.md#print-alerts)
still apply. Saving the transition and posting an Android notification are not an
atomic operation; abrupt process death between those operations can still miss
an alert. This patch repairs temporary-save-failure recovery, not durable event
history. This remains a preview pending physical-phone acceptance.
