# enna Jitsi web image

This fork retains `7d14f385435a8bb11a4c0cfc7015e18cf19b7841`, the lib-jitsi-meet revision in the
current `ghcr.io/jitsi/web:stable-11248` image. It fixes false avatar replacements after a group call
returns to P2P. The first inbound decoded-frame counter must be emitted even before packet-loss deltas
have a baseline, and freeze detection must ignore reports from connections that do not own its track.
The timeout is unchanged; genuine stalls and recovery remain covered by the upstream tests.

The changes and regression tests are committed directly in the fork. Five assertions fail on the original
source; with the fix all 622 tests pass in both Karma variants. The exact built library was also tested
twice in Safari on a real iPhone; see [validation](VALIDATION.md). The upstream test-bundle warning about
the removed `CONFERENCE_RESTARTED` export remains; lint, types and the production build are clean.

## Build

Requirements: Node 22, npm, Chrome/Chromium, Git and Docker.

```sh
bash enna/build.sh
docker build --platform linux/amd64 --build-arg ENNA_REVISION="$(git rev-parse HEAD)" \
  -t enna-jitsi-web:p2p-freeze enna
```

Set `CHROME_BIN` when Chrome is not automatically detected. The build runs `npm ci`, lint/types,
both complete Karma suites and the full production build. Generated image inputs are ignored under
`enna/target/image`. The library's version remains the identifier validated in Safari; full fork commit,
upstream revision, library SHA-256 and Node version are recorded in `enna-web-build.json` in the image.

The Dockerfile pins the existing web image by digest and replaces only the rebuilt library artifacts.
Its SHA-256-derived URL cache key prevents Safari from retaining the old library. gzip copies are rebuilt
and old Brotli copies removed so nginx cannot serve stale compressed JavaScript. Startup and runtime
remain from the original image, including its `s6` user.

## CI and dev rollout

`dev` is the integration branch; feature branches use `TKO/…`. The enna workflow verifies feature/dev
pushes and PRs to `dev`. Image publication runs only for pushes to this repository after verification;
external pull requests never receive registry credentials. There is no deployment step.

A repository administrator must configure Actions secret `DOCKER_PASSWORD_SCW_DEV` for the existing
dev registry, or grant this repository access to an equivalent organization secret. No production secret
is used. Images are published as:

```
rg.fr-par.scw.cloud/dev-enna-nsp/enna-jitsi-web:stable-11248-p2p-freeze-<full-git-commit>
```

CI retains verified image inputs for seven days and reports the pushed digest. If the secret is added
after a failed publication, rerun the failed job; verification artifacts remain available. GitOps pins
that verified digest in the dev call overlay, with the existing `registry-secret` for the web Deployment.
Only the normal GitOps PR merge rolls out the image.

Validate Dock + Chrome + real iPhone Safari, let Chrome leave and observe P2P for at least 30 seconds;
repeat and record raw frame counters, streaming status and visible video. Roll back in GitOps to
`ghcr.io/jitsi/web:stable-11248@sha256:615d9882b7bc2bc0b648fb48c153ce2b9c503f37a15e6aaf4f1c8e40f5cf8ca4`.
