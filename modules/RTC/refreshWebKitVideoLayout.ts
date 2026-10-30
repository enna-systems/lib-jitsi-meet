import { getLogger } from '@jitsi/logger';

const logger = getLogger('rtc:refreshWebKitVideoLayout');

/**
 * Recreates the local portrait media presentation after WebKit has decoded its first frame.
 * WebKit can initially fit unrotated camera dimensions and retain that smaller layer after rotation.
 * Keep capture and CSS unchanged; only reload playback across a rendering boundary.
 * See https://bugs.webkit.org/show_bug.cgi?id=259364#c18.
 *
 * @param video - The local camera playback element.
 * @param stream - The exact stream being attached.
 * @param isAttached - Whether this track still owns the element and stream.
 * @returns Cleanup for a pending frame callback or repaint.
 */
export function refreshWebKitVideoLayout(
        video: HTMLVideoElement,
        stream: MediaStream,
        isAttached: () => boolean): () => void {
    let cancelled = false;
    let decoded = false;
    let frame: number | undefined;
    let repaint: number | undefined;

    frame = video.requestVideoFrameCallback(() => {
        if (cancelled || decoded) {
            return;
        }
        decoded = true;
        frame = undefined;

        if (!isAttached() || video.srcObject !== stream || !video.isConnected || video.paused
                || video.videoWidth <= 0 || video.videoHeight <= video.videoWidth) {
            return;
        }

        video.pause();
        video.srcObject = null;
        video.load();
        repaint = requestAnimationFrame(() => {
            if (cancelled || !isAttached() || !video.isConnected || video.srcObject !== null) {
                repaint = undefined;

                return;
            }
            // rVFC can run before rAF in the same rendering cycle. Leave one full frame unbound.
            repaint = requestAnimationFrame(() => {
                repaint = undefined;

                // Never revive a muted/disposed track or replace a newer source.
                if (cancelled || !isAttached() || !video.isConnected || video.srcObject !== null) {
                    return;
                }

                video.srcObject = stream;
                video.play().catch(error => {
                    if (isAttached() && video.srcObject === stream) {
                        logger.warn('Could not resume local WebKit camera presentation', error);
                    }
                });
            });
        });
    });

    return () => {
        cancelled = true;
        if (typeof frame === 'number') {
            video.cancelVideoFrameCallback(frame);
            frame = undefined;
        }
        if (typeof repaint === 'number') {
            cancelAnimationFrame(repaint);
            repaint = undefined;
        }
    };
}
