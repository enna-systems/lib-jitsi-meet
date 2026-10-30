FROM ghcr.io/jitsi/web:stable-11248@sha256:615d9882b7bc2bc0b648fb48c153ce2b9c503f37a15e6aaf4f1c8e40f5cf8ca4

USER root

ARG ENNA_REVISION
LABEL org.opencontainers.image.title="enna Jitsi web: P2P streaming status fix" \
      org.opencontainers.image.source="https://github.com/enna-systems/lib-jitsi-meet" \
      org.opencontainers.image.revision="$ENNA_REVISION"

# build.sh verifies the fork checkout before preparing library artifacts for the existing upstream web image.
COPY target/image/libs/ /usr/share/jitsi-meet/libs/
COPY target/image/enna-web-build.json target/image/SHA256SUMS /usr/share/jitsi-meet/
COPY target/image/cache-version /tmp/enna-web-cache-version
RUN set -eu; \
    cd /usr/share/jitsi-meet; \
    sha256sum --check SHA256SUMS; \
    test "$(grep -o 'libs/lib-jitsi-meet.min.js?v=' index.html | wc -l)" -eq 1; \
    cache_version="$(cat /tmp/enna-web-cache-version)"; \
    sed -i "s|libs/lib-jitsi-meet.min.js?v=[^\" ]*|libs/lib-jitsi-meet.min.js?v=${cache_version}|" index.html; \
    rm -f index.html.gz index.html.br /tmp/enna-web-cache-version; \
    for asset in libs/lib-jitsi-meet*; do \
        case "$asset" in *.gz|*.br) rm -f "$asset" ;; esac; \
    done; \
    for asset in libs/lib-jitsi-meet*; do gzip -9 -n -k "$asset"; done

# Restore the upstream runtime user after assembling its read-only web assets.
USER s6
