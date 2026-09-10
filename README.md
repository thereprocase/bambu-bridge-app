# Bambu Bridge (Android app)

The Android companion for the self-hosted [Bambu Bridge](https://github.com/thereprocase/bambu-bridge) printer server.

**[Download Android v0.18.3](https://github.com/thereprocase/bambu-bridge-app/releases/tag/v0.18.3)** · **[Project overview](https://thereprocase.github.io/bambu-bridge/#android)** · **[What changed](docs/RELEASE-0.18.3.md)**

The APK supports ARM64 phones running Android 7 or newer. Use Bambu Bridge 0.1.3.
Install it as an update to preserve your saved connection and printer settings.

> Independent community software. Not affiliated with or endorsed by Bambu Lab.

Bambu Bridge is a small server you run on your own machine (a home server, a
Raspberry Pi, a spare PC) that talks to your Bambu Lab P1S over your LAN. This
Android app is the front end: it connects to *your* bridge — never to the
cloud — so you can watch prints, jog the axes, manage filament, and open the
live 3D view from your phone.

- **You host the bridge. You hold the key.** All traffic goes to your own
  bridge server over your LAN or your own Tailscale network. Nothing routes
  through anyone else's cloud.
- **Works at home and away.** On your home Wi-Fi it uses the fast LAN path; off
  the network it falls back to your Tailscale address automatically.

## What you need

1. A running **Bambu Bridge server** (the separate self-hosted project). The app
   is useless on its own — it's a remote control for that server.
2. The bridge's **Base URL** — e.g. `http://your-bridge-host:8080/api/v1`.
3. The bridge's **API key** (a bearer token). See [Getting the API key](#getting-the-api-key).
4. An Android phone. The app ships as a sideloaded `.apk` — see
   [Installing](#installing).

## Installing

This is a sideloaded app, not a Play Store listing. The step-by-step guide is in **[docs/INSTALL.md](docs/INSTALL.md)**. The short version:

1. Download the [latest APK](https://github.com/thereprocase/bambu-bridge-app/releases/latest) to your phone.
2. Open it. Android will ask to allow installs from this source — turn that on,
   then come back and tap Install.
3. Open the app. It starts on the **Settings** screen because it needs to know
   where your bridge is.

> **Note:** this is a custom build, not Expo Go. The app uses on-device storage
> (MMKV) that does not run inside the Expo Go sandbox, so it will only work as
> the installed `.apk` (or a custom dev build). Trying to load it in Expo Go
> will fail at launch — that's expected.

## Connecting

On first launch you land on **Settings**. Fill in:

- **Remote base URL (Tailscale)** — how your bridge is reachable from anywhere,
  e.g. `http://your-bridge-host:8080/api/v1` or
  `http://100.x.y.z:8080/api/v1`. Include the `/api/v1` path. The default port
  is `8080`.
- **LAN base URL (optional)** — a faster address used automatically when you're
  on your home Wi-Fi, e.g. `http://192.168.1.50:8080/api/v1`. The app falls
  back to the Tailscale URL when you're away.
- **API key (bearer)** — paste your bridge's key (below).

Tap **Save & probe**. A green dot means the app reached your bridge and the key
was accepted. Then add your printer under **Add a printer** (its LAN IP plus the
8-digit access code from the printer's screen).

### Getting the API key

The key is your bridge's `BRIDGE_API_KEY`. On the machine running the bridge,
it lives in the bridge's environment file:

```
~/.config/bambu-bridge/bridge.env
```

Open that file and copy the value of `BRIDGE_API_KEY` into the app's **API key**
field. Treat it like a password — anyone with the URL and this key can control
your printer.

### LAN vs. Tailscale

- **At home:** save your home network in Settings and the app talks to the
  bridge directly over your LAN — fast, and it works even with Tailscale off.
- **Away:** the app uses your Tailscale address. If you can't reach the bridge
  while out, the usual cause is Tailscale being off on the phone or on the
  bridge host. The app shows a banner and serves cached data until the
  connection comes back.

Saved networks are matched by subnet (the first three numbers of your Wi-Fi IP).
The app never reads your Wi-Fi name and never needs location permission.

## Trouble?

See **[docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)** — symptom-to-fix for
the common cases: can't reach the bridge, key rejected, printer offline, camera
or 3D view not loading, and Tailscale being off.

## License

AGPL-3.0-only — see [LICENSE](LICENSE), [NOTICE](NOTICE), and [THIRD_PARTY.md](THIRD_PARTY.md).

Build instructions: [docs/BUILDING.md](docs/BUILDING.md). The published source
contains no signing keys, credentials, phone captures, or private development history.
