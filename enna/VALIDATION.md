# Jitsi compatibility validation

## Safari local portrait presentation candidate — 2026-10-30

An iPhone 17 / iOS 27.0.1 reporter reproduced a too-small local camera picture with margins on all
four sides: in the thumbnail, on the large self-view while alone, and in a three-party call. Camera
off/on and backgrounding Safari restored the expected size. No JavaScript experiment was executed
on that device. A connected iPhone 12 / iOS 26.6.1 did not reproduce it in controlled camera-reuse and
layout-change tests. An observer received portrait H.264 at 720 × 1280; receive dimensions do not
establish the reporter's local DOM or painted geometry.

The symptom matches [WebKit 259364](https://bugs.webkit.org/show_bug.cgi?id=259364#c18). The candidate
reloads only portrait front-camera playback on iOS WebKit after the first decoded frame, leaving a
full rendering frame before restoring the exact stream. It changes neither capture nor layout CSS.
Separate local elements, including the large self-view, each get one refresh on attachment.
Detach/dispose, mute, source replacement, paused playback and unsupported APIs are covered by lifecycle
tests. Five initial lifecycle tests fail against the unchanged library. These tests establish the
new recovery behavior and its boundaries; they do **not** reproduce WebKit's native rendering defect.

**Target-device acceptance is still required. Do not treat this candidate as a verified fix.** After
the normal dev image rollout, test in Safari without console scripts:

1. Fresh portrait joins alone, with one peer and with two peers: no margins above/below the thumbnail;
   the large local image uses its expected camera framing. Keep thumbnail `contain`.
2. Repeat leaving/rejoining and test camera off/on, front/rear switch, rotation and background/foreground.
3. Mute or leave promptly during camera startup: playback must not be revived by delayed recovery.
4. Verify outgoing camera continuity and the previously fixed healthy JVB → P2P transition.

The source, dev image and GitOps rollout remain separate changes. The previously verified dev image
is the rollback target until acceptance:
`rg.fr-par.scw.cloud/dev-enna-nsp/enna-jitsi-web:stable-11248-p2p-freeze-a5262b34566f8e8fe7c1a144b2ecf61d41e064c7@sha256:76d664de6f34231b00e75c7e51b5a71879ce2b8d8ca703d84fb031cf51c0e467`.

## P2P video status regression — 2026-10-30

The original served library at `7d14f385` reproduced the false video interruption twice on a real iPhone
in Safari after Chrome left a three-party call with a native Android Dock. Both interruptions lasted
approximately ten seconds while decoded frames continued to increase. Filtering unrelated connection
stats alone still reproduced the interruption.

The regression tests fail on five assertions against the pinned original source and pass with both
source changes applied. All 622 tests pass in each of the native and polyfill Karma configurations.
ESLint, TypeScript, the complete production build and the 25 existing dev video-quality tests pass.
The upstream test-bundle warning about `CONFERENCE_RESTARTED` remains documented in the README.

The built UMD library has SHA-256
`872facaa6553ce634dfe40346415d839b7027a57c431dd4544ada2b05e35d191` and reports version
`7d14f385-enna-p2p-freeze`. The same bytes were loaded in one real Safari test tab using a WebKit response
override for the library URL. This tested the built source changes; the decoder counters and freeze
detector were not replaced or patched at runtime. This was a local candidate test, not a cluster rollout.

Two full repetitions used the native Dock, Chrome and iPhone Safari, with Chrome leaving after about a
minute. P2P was observed for 67 seconds and more than 40 seconds respectively. Every remote-video status
sample remained `active`; neither run emitted `interrupted`. The first P2P collector report already
contained the new SSRC's decoded-frame counter. Screenshots at 10/15/20/25 seconds showed the Dock video.
Safari received approximately 25 fps at 1920×1072. A sub-second decoder freeze during each transport
transition was recorded; the previous ten-second false avatar replacement did not recur.

The Docker image was built locally. Runtime checks confirmed the copied asset checksums, identical
decompressed gzip content, the changed library URL cache key and the restored upstream `s6` user.
CI publication and a verified digest in the dev overlay are still required before rollout. Genuine
stalls, absent video and counter resets remain covered by the upstream unit tests; no timeout was raised.
