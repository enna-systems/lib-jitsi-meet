# enna lib-jitsi-meet fork

Read the upstream `CLAUDE.md` for architecture and library conventions.

- `dev` is the integration branch, based on upstream `7d14f385435a8bb11a4c0cfc7015e18cf19b7841`, the
  library in the existing `stable-11248` Jitsi web image. Work on `TKO/…` feature branches and open PRs to `dev`.
- Source changes and regression tests live directly in this checkout. `bash enna/build.sh` verifies the
  lockfile, lint/types, both complete Karma suites and production build, then prepares ignored image inputs.
- Keep inbound frame counters independent of packet-loss delta baselines. Freeze detection must consume
  only reports from the connection owning the exact remote track. Preserve genuine-stall detection.
- The enna workflow publishes a commit-tagged dev image only after verification. External PRs never receive
  registry credentials. GitOps separately pins the verified image digest; this repository never deploys a cluster.
- The Dockerfile retains the pinned upstream runtime, changes the library URL cache key and regenerates
  compressed assets. Restore the upstream `s6` user after assembling the image.
- See `enna/README.md` and `enna/VALIDATION.md` for the build, actual Safari validation and rollback.
- The local Safari portrait preview refresh is a candidate awaiting iPhone 17 / iOS 27 acceptance. Keep
  capture and layout CSS unchanged, cancel asynchronous work on detach/mute/dispose, and never reattach
  an old stream over a new source. Apply it only to iOS WebKit front-camera playback. Chrome unit tests
  validate lifecycle boundaries, not WebKit's native painting. Do not claim an iOS 27 fix without a target test.
