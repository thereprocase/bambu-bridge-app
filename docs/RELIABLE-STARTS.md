# Reliable starts — draft, requires matching server

The Print screen now persists one non-secret intent in MMKV before POST.
The key is scoped to paired server certificate (or legacy bridge URL) and
printer. A new tap cannot replace a pending/unknown intent. An explicit resend
uses the same identity and inputs. Reads never automatically resend a command.
Older/out-of-order operation revisions cannot overwrite newer persisted state.

Accepted, preparing-file, waiting-for-printer, and outcome-unknown are separate
messages. The network spinner ends when acceptance returns, not at physical
print start. Another copy stays disabled until the server releases ownership.

Operation checks run on a focused Print screen while AppState is active. Reads
are serialized, with a two-second delay between pending checks. Hidden screens
have no timer; unknown outcomes require a manual check or foreground re-entry.
The existing camera/status/viewer background policy is unchanged.

This requires the server `start-operations` endpoints. Do not deploy against
an older server: a missing endpoint deliberately fails closed. Test process
death, bridge/printer switching, delayed responses, foreground transitions,
and legacy-server recovery UI on the actual paired APK before release.

Unknown operations currently require owner-side server resolution after
physical inspection; the app must not offer a blind "forget and print again".
