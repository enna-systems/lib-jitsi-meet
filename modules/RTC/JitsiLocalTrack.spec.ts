import { CameraFacingMode } from '../../service/RTC/CameraFacingMode';
import { MediaType } from '../../service/RTC/MediaType';
import { VideoType } from '../../service/RTC/VideoType';
import browser from '../browser';

import JitsiLocalTrack from './JitsiLocalTrack';

describe('JitsiLocalTrack WebKit camera presentation', () => {
    let localTrack: JitsiLocalTrack;
    let stream: MediaStream;
    let video: HTMLVideoElement;
    let frames: VideoFrameRequestCallback[];
    let animations: FrameRequestCallback[];
    let paused: jasmine.Spy;
    let nextAnimationId: number;

    const metadata: VideoFrameCallbackMetadata = {
        expectedDisplayTime: 0,
        height: 1280,
        mediaTime: 0,
        presentationTime: 0,
        presentedFrames: 1,
        width: 720
    };

    function makeVideo(): HTMLVideoElement {
        const element = document.createElement('video');

        element.style.objectFit = 'contain';
        document.body.appendChild(element);
        spyOnProperty(element, 'videoWidth').and.returnValue(720);
        spyOnProperty(element, 'videoHeight').and.returnValue(1280);
        paused = spyOnProperty(element, 'paused').and.returnValue(false);
        spyOn(element, 'pause');
        spyOn(element, 'load');
        spyOn(element, 'play').and.returnValue(Promise.resolve());
        spyOn(element, 'requestVideoFrameCallback').and.callFake(callback => {
            frames.push(callback);

            return frames.length;
        });
        spyOn(element, 'cancelVideoFrameCallback');

        return element;
    }

    function paint(): void {
        animations.splice(0).forEach(callback => callback(0));
    }

    beforeEach(() => {
        frames = [];
        animations = [];
        nextAnimationId = 0;
        spyOn(browser, 'isIosBrowser').and.returnValue(true);
        spyOn(browser, 'isWebKitBased').and.returnValue(true);
        spyOn(window, 'requestAnimationFrame').and.callFake(callback => {
            animations.push(callback);

            return ++nextAnimationId;
        });
        spyOn(window, 'cancelAnimationFrame');

        const canvas = document.createElement('canvas');

        canvas.width = 720;
        canvas.height = 1280;
        stream = canvas.captureStream(0);
        localTrack = new JitsiLocalTrack({
            constraints: { height: { ideal: 720 }, width: { ideal: 1280 } },
            deviceId: '',
            facingMode: CameraFacingMode.USER,
            mediaType: MediaType.VIDEO,
            rtcId: 1,
            stream,
            track: stream.getVideoTracks()[0],
            videoType: VideoType.CAMERA
        });
        video = makeVideo();
    });

    afterEach(async () => {
        await localTrack.dispose();
        video.remove();
        stream.getTracks().forEach(track => track.stop());
    });

    it('refreshes portrait playback after its first frame without restarting capture or changing contain', async () => {
        const camera = stream.getVideoTracks()[0];
        const stop = spyOn(camera, 'stop').and.callThrough();

        await localTrack.attach(video);
        expect(video.load).not.toHaveBeenCalled();
        expect(video.requestVideoFrameCallback).toHaveBeenCalledTimes(1);
        frames[0]?.(0, metadata);
        expect(video.load).toHaveBeenCalledTimes(1);
        expect(video.srcObject).toBeNull();
        paint();
        expect(video.srcObject).toBeNull();
        paint();
        expect(video.srcObject).toBe(stream);
        expect(video.play).toHaveBeenCalledTimes(1);
        expect(video.style.objectFit).toBe('contain');
        expect(stop).not.toHaveBeenCalled();
        expect(camera.readyState).toBe('live');
        expect(localTrack.getTrack()).toBe(camera);

        // A stale duplicate notification must not repeatedly reload playback.
        frames[0]?.(0, metadata);
        expect(video.load).toHaveBeenCalledTimes(1);
    });

    it('handles both the large self-view and thumbnail independently', async () => {
        const large = makeVideo();

        try {
            await localTrack.attach(video);
            await localTrack.attach(large);
            expect(frames.length).toBe(2);
            frames.forEach(callback => callback(0, metadata));
            paint();
            paint();
            expect(video.load).toHaveBeenCalledTimes(1);
            expect(large.load).toHaveBeenCalledTimes(1);
            expect(video.srcObject).toBe(stream);
            expect(large.srcObject).toBe(stream);
        } finally {
            localTrack.detach(large);
            large.remove();
        }
    });

    it('cancels a pending first-frame callback when the video is detached', async () => {
        await localTrack.attach(video);
        localTrack.detach(video);
        expect(video.cancelVideoFrameCallback).toHaveBeenCalledWith(1);
        frames[0]?.(0, metadata);
        expect(video.load).not.toHaveBeenCalled();
        expect(video.srcObject).toBeNull();
    });

    it('does not reattach the old stream after detaching between reset and repaint', async () => {
        await localTrack.attach(video);
        frames[0]?.(0, metadata);
        localTrack.detach(video);
        expect(window.cancelAnimationFrame).toHaveBeenCalledWith(1);
        paint();
        paint();
        expect(video.srcObject).toBeNull();
        expect(video.play).not.toHaveBeenCalled();
    });

    it('does not restore a camera muted between reset and repaint', async () => {
        await localTrack.attach(video);
        frames[0]?.(0, metadata);
        await localTrack.mute();
        paint();
        paint();
        expect(video.srcObject).toBeNull();
        expect(video.play).not.toHaveBeenCalled();
        expect(stream.getVideoTracks()[0].readyState).toBe('ended');
    });

    it('leaves a newer source alone when an old callback arrives', async () => {
        const newer = new MediaStream();

        await localTrack.attach(video);
        video.srcObject = newer;
        frames[0]?.(0, metadata);
        expect(video.srcObject).toBe(newer);
        expect(video.load).not.toHaveBeenCalled();
    });

    it('leaves a newer source alone during the repaint gap', async () => {
        const newer = new MediaStream();

        await localTrack.attach(video);
        frames[0]?.(0, metadata);
        paint();
        video.srcObject = newer;
        paint();
        expect(video.srcObject).toBe(newer);
        expect(video.play).not.toHaveBeenCalled();
    });

    it('cancels recovery on disposal after the first repaint', async () => {
        await localTrack.attach(video);
        frames[0]?.(0, metadata);
        paint();
        await localTrack.dispose();
        expect(window.cancelAnimationFrame).toHaveBeenCalledWith(2);
        paint();
        expect(video.srcObject).toBeNull();
        expect(video.play).not.toHaveBeenCalled();
    });

    it('handles a rejected resume without an unhandled promise rejection', async () => {
        (video.play as jasmine.Spy).and.callFake(() => Promise.reject(new Error('Playback denied')));
        await localTrack.attach(video);
        frames[0]?.(0, metadata);
        paint();
        paint();
        await Promise.resolve();
        expect(video.srcObject).toBe(stream);
        expect(video.play).toHaveBeenCalledTimes(1);
    });

    it('respects an explicitly paused preview', async () => {
        await localTrack.attach(video);
        paused.and.returnValue(true);
        frames[0]?.(0, metadata);
        expect(video.load).not.toHaveBeenCalled();
        expect(video.play).not.toHaveBeenCalled();
    });

    it('does not refresh landscape playback', async () => {
        (Object.getOwnPropertyDescriptor(video, 'videoWidth')?.get as jasmine.Spy).and.returnValue(1280);
        (Object.getOwnPropertyDescriptor(video, 'videoHeight')?.get as jasmine.Spy).and.returnValue(720);
        await localTrack.attach(video);
        frames[0]?.(0, metadata);
        expect(video.load).not.toHaveBeenCalled();
    });

    it('does not apply to desktop browsers', async () => {
        (browser.isIosBrowser as jasmine.Spy).and.returnValue(false);
        await localTrack.attach(video);
        expect(video.requestVideoFrameCallback).not.toHaveBeenCalled();
    });

    it('does not apply to non-WebKit browsers', async () => {
        (browser.isWebKitBased as jasmine.Spy).and.returnValue(false);
        await localTrack.attach(video);
        expect(video.requestVideoFrameCallback).not.toHaveBeenCalled();
    });

    it('does not apply to screensharing', async () => {
        localTrack.videoType = VideoType.DESKTOP;
        await localTrack.attach(video);
        expect(video.requestVideoFrameCallback).not.toHaveBeenCalled();
    });

    it('does not apply to the rear camera', async () => {
        spyOn(localTrack, 'getCameraFacingMode').and.returnValue(CameraFacingMode.ENVIRONMENT);
        await localTrack.attach(video);
        expect(video.requestVideoFrameCallback).not.toHaveBeenCalled();
    });

    it('does not apply to audio', async () => {
        spyOn(localTrack, 'isVideoTrack').and.returnValue(false);
        await localTrack.attach(video);
        expect(video.requestVideoFrameCallback).not.toHaveBeenCalled();
    });

    it('does not require frame callbacks on older browsers', async () => {
        Object.defineProperty(video, 'requestVideoFrameCallback', { configurable: true, value: undefined });
        await expectAsync(localTrack.attach(video)).toBeResolved();
        expect(video.load).not.toHaveBeenCalled();
    });
});
