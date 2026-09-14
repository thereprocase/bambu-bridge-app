# Battery work and acceptance

## Home Assistant delivery and fast return

Choose **Use Home Assistant alerts** on the Status screen after configuring and
testing HA notifications. This persists the choice natively, clears the native
monitor's saved session and stops its service. A sticky service restart also
honors the choice. It does not configure HA or verify notification delivery.

When the app is hidden, the camera stops immediately and the monitor-controls
UI stops polling. An existing UI status socket gets a 60-second grace period for
quick app switches, but failed sockets do not reconnect while hidden. A network
change closes the old socket immediately. After the grace period the socket
closes; the last snapshot remains cached for immediate display on return.
Android may suspend JS timers, so resume also checks elapsed wall time before
reusing a connection. No wake lock or foreground service is used to enforce the
grace timer. Controls still require a fresh live snapshot after reconnect.

On a server advertising viewer lifecycle version 1, a fully loaded 3D view can
retain its geometry and camera position for the same grace period while stopping
polling and animation immediately. Loading/older viewers still unload when
hidden. Configuration/credential/network changes invalidate the warm view.
After process eviction or grace expiry the viewer reloads normally. Warm resume
requires the companion server viewer change; it is not available on older pages.

Finite user-initiated HTTP operations retain their existing timeouts; this is not
a claim that every in-flight request disappears the instant the app is hidden.
HA's own server-side integration can poll, but that work does not run on this
phone. No Firebase project or provider is added to Beluga.

## Findings and scope

An operator phone's battery history attributed approximately 108 minutes of CPU
time to this app, with approximately five minutes of foreground activity and
168 minutes of foreground-service activity. This identifies a serious symptom,
not the hot thread or the responsible release: the app had been updated during
the day. No CPU profile was collected. Do not claim this patch fixes that entire
drain without a controlled device comparison.

The direct monitor previously scheduled a liveness check every five seconds,
sent transport pings every 25 seconds in addition to the bridge's idle heartbeat,
and retried even when Android had no default network. The monitor controls also
polled native status every two seconds while their route remained focused in the
background. This patch removes those sources of unnecessary work. It preserves
the 15-second initial snapshot deadline, 65-second incoming-message deadline,
alert transitions and immediate recovery when a new default network appears.

Healthy frequent telemetry now needs fewer than 60 watchdog callbacks per hour
instead of 720. This counts executor callbacks, not measured hardware wakeups.
The bridge's application ping/pong protocol remains the heartbeat for both native
and UI status sockets. While offline, alerts remain delayed and the notification
says so; the native service waits for a network callback instead of retrying.

## Preserve features with less background traffic

The always-on bridge should own continuous printer observation. The phone should
receive only what its current task requires:

- Visible dashboard: current status; camera frames only while its view is active.
- Visible 3D viewer: render while interacting or animating; cap animation cadence
  and suspend it when hidden. Static scenes should render on change.
- Background alerts: completion, pause, failure and new errors, with event IDs,
  deduplication and replay after reconnect. Avoid full temperature/AMS/raw-state
  traffic when none of it is displayed.
- Unreachable network: no connection attempts until a network is available.
  A reachable network with an unreachable bridge still needs bounded retries.

The existing native monitor consumes the full status stream and watches future
jobs indefinitely. A follow-up should add a versioned alert subscription on the
server, preserving initial-state and reconnect semantics, before switching the
client. Retain direct LAN/Tailscale monitoring as an explicit option.

Optional shared push delivery can let Android sleep between alerts. The server
already has ntfy support for completion, failure and filament runout; pause and
other attention events need coverage before replacing native monitoring. A
push provider is a product/privacy choice, not a silent dependency change.
Merely moving a private persistent connection into another app does not prove a
battery improvement. See Android's [Doze guidance](https://developer.android.com/training/monitoring-device-state/doze-standby)
and [network update guidance](https://developer.android.com/develop/connectivity/minimize-effect-regular-updates).

## Device acceptance still required

Operator rule for the connected development phone: enable Android's **Stay
awake while charging** only while UI automation needs it. Turn it off when
that work finishes; do not leave it enabled for read-only audits or battery
measurements. Verify `settings get global stay_on_while_plugged_in` returns
`0` at handoff.

Use matched release builds on the same phone, with comparable charge, temperature,
network and printer activity. Preserve pairing and app data, and capture existing
battery history before any reset. Do not reconnect to or operate a printer just
to profile without the operator's authorization.

Compare at least 30-minute runs of: idle background monitoring, an active print
with the screen off, unreachable bridge, unavailable network, visible camera,
and visible 3D viewer. Compare against monitoring disabled. Record app CPU time,
screen-off uptime, bytes/messages, reconnects, frame count and energy where the
device supports it. Use a short system/CPU trace to locate any sustained hot
thread. Keep raw traces private; publish only scrubbed aggregate results.

Required behavior: no camera frames or viewer animation in the background; no
UI status polling there; no socket retries without a default network; prompt
resumption when it returns; no duplicate or lost observed alert transitions;
and clean cancellation after stopping. Exercise LAN/remote handoff, initial
offline startup, bridge outage, screen lock and process restart. Automated
checks are necessary but do not establish a battery-life improvement.
