# Android 0.18.3 — bridge compatibility and reliability

Android version code 22. The application ID remains `com.anonymous.bambubridgeapp`, matching the
installed 0.18.1 release so Android retains its app data.
This patch targets Bambu Bridge 0.1.3 and retains the existing signing identity.

## Fixed

- The Android transport accepts user-configured LAN and Tailscale IP addresses.
  The former DNS-only cleartext policy blocked these documented settings.
  HTTPS continues to use system certificate validation.

- Printer commands are no longer replayed automatically on a second network
  path after a lost response. The error explains that the command may already
  have arrived. GET reads retain the one-attempt LAN/remote fallback.
- HTTP timeouts cover response-body reads as well as the initial connection.
- Live controls wait for a valid fresh snapshot. Socket callbacks from an old
  connection cannot overwrite a restarted connection; reconnect backoff resets
  after a snapshot, not merely an upgrade. The app sends pongs, closes stalled
  initial subscriptions, and stops on explicit policy/protocol rejection.
- Changing the URL or API key restarts the live connection. Endpoint caches
  follow current settings even when a native network lookup is still pending.
- The stored-file Print action uses the bridge's queue-add and queue-start
  endpoints instead of an unsupported JSON POST to `/jobs`. Queue deletion
  uses `/queue/{id}`. AMS job mappings retain physical slot numbers 1–4.
- Print buttons require connected, fresh, idle/completed state and reject
  duplicate submissions while one is pending. Only 3MF files are offered.
- Viewer Retry resolves a fresh endpoint and key. Embedded navigation remains
  within the selected bridge viewer; timing messages accept only known numeric
  fields and a format enum.
- Diagnostic redaction is recursive and covers known credentials, URL/error
  strings and sensitive fields. File names and arbitrary page diagnostic fields
  are no longer emitted. The legacy `/config` deep link opens Settings and
  never applies URL-supplied credentials or reset instructions.
- A SecureStore read failure reaches Settings instead of hanging startup.
  A failed credential save produces a visible error and retains the prior URLs.

## Validation

TypeScript passes. ESLint passes on all 22 changed TypeScript source/test files.
All 365 tests pass across 12 Jest suites. New tests cover ambiguous command
outcomes, response-body timeouts, socket generation/liveness, current endpoint
selection, queue/AMS requests, diagnostic redaction, viewer navigation and
Keystore failure recovery. No additional JavaScript dependencies were installed.

The signed ARM64 APK is built locally with JDK 17 and the installed Expo 54
toolchain. Artifact verification checks the package ID, version code, matching
release certificate, archive integrity, and current runtime strings in the
Hermes bundle. [Expo 54 documentation](https://docs.expo.dev/versions/v54.0.0/)
and [SecureStore documentation](https://docs.expo.dev/versions/v54.0.0/sdk/securestore/)
were consulted as required by this workspace.

On 2026-09-09 the signed APK was installed in place on a Pixel 9 Pro,
retaining the original installation record and saved connection settings.
The phone reconnected to Bambu Bridge 0.1.3 through its saved HTTP LAN IP URL.
Live status changed over time, the camera image rendered, and the embedded
3D viewer loaded the active job's toolpath. Returning to Status retained the
live connection. The APK pulled back from the phone exactly matched the
release SHA-256. No fatal app exception was observed during this smoke check.

The existing print continued throughout. No real print, pause, heat, movement,
upload or deletion commands were issued; those request contracts were tested
with simulated transports. Remote-only switching and other Android devices
were not exercised in this hardware pass. Install as an update; do not
uninstall or clear app data.

The embedded viewer still uses the bridge's existing tokenized viewer URL
inside the WebView. Native HTTP and status WebSocket requests use authorization
headers. Changing a shared bridge key requires updating all of its clients.
