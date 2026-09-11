# Android 0.19.0 — secure local pairing preview

Requires Bridge 0.2.0 for pairing. Existing manual connections remain compatible
with Bridge 0.1.3. Install in place: package and signing identity are unchanged.

- Scan an offline QR from the bridge installer, name the phone, and pair.
- Verify the scanned bridge public key before sending the one-use invitation.
- Store the resulting identity and per-phone credential together in SecureStore.
- Use the same origin-scoped native TLS transport for API, camera and WSS.
- Route every paired viewer request through verified native TLS. Block external
  resources/navigation, file access, redirects and certificate-error bypasses.
- Support optional remote HTTPS with ordinary system certificate validation.
- Preserve manual HTTP setup as an explicit compatibility option, separate
  from paired credentials. Preserve the protection against command replay.
- Disconnect/revoke a phone without rotating the owner's key or other phones.

The paired viewer uses the existing server viewer and its live polling behavior;
this release does not improve printer XY tracking or change rendering accuracy.
Pairing is Android-only. Ordinary browsers continue to need a publicly trusted
HTTPS endpoint such as Tailscale Serve. A changed LAN address currently needs
a fresh pairing code or a router address reservation.

Validation: 382 JavaScript tests, TypeScript, changed-file ESLint, signed ARM64
build, and native TLS tests for correct/wrong/expired keys, origin restrictions,
redirect refusal and secure WebSockets. Physical-phone scanning, embedded viewer
and an in-place installation of this preview remain pending.
