# P2P video status regression — 2026-10-30

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
