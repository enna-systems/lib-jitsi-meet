import { StatisticsEvents } from '../../service/statistics/Events';
import EventEmitter from '../util/EventEmitter';

import StatsCollector from './RTPStatsCollector';

const SSRC = 12345;

/** Runs real collector reports without starting a WebRTC polling timer. */
function createCollector(video = true, local = false) {
    const track = {
        getParticipantId: () => 'remote',
        isAudioTrack: () => !video,
        isLocal: () => local,
        isVideoTrack: () => video
    };
    const events = new EventEmitter();
    const peerconnection = {
        doesTrueSimulcast: () => false,
        eventEmitter: new EventEmitter(),
        getTrackBySSRC: () => track
    };
    const collector = new StatsCollector(peerconnection, 200, 10000, events);
    const reports: Map<number, number>[] = [];

    events.on(StatisticsEvents.CONNECTION_STATS, (_tpc, data: { framesDecoded: Map<number, number> }) => {
        reports.push(data.framesDecoded);
    });
    collector.previousStatsReport = new Map();

    return {
        collect(ssrc: number, framesDecoded: number) {
            const id = `video-${ssrc}`;

            collector.currentStatsReport = new Map([ [ id, {
                bytesReceived: framesDecoded * 1000,
                frameHeight: 720,
                frameWidth: 1280,
                framesDecoded,
                framesPerSecond: 30,
                id,
                kind: video ? 'video' : 'audio',
                packetsReceived: framesDecoded * 2,
                ssrc,
                timestamp: 10000 * (reports.length + 1),
                type: local ? 'outbound-rtp' : 'inbound-rtp'
            } ] ]);
            collector.processStatsReport();
            collector.previousStatsReport = collector.currentStatsReport;

            return reports[reports.length - 1];
        }
    };
}

describe('RTPStatsCollector framesDecoded at stream startup', () => {
    it('reports the first inbound counter without needing a packet delta baseline', () => {
        expect(createCollector().collect(SSRC, 295).get(SSRC)).toBe(295);
    });

    it('reports zero so a stream that has not decoded a frame can still be monitored', () => {
        expect(createCollector().collect(SSRC, 0).get(SSRC)).toBe(0);
    });

    it('reports a replacement SSRC immediately instead of waiting another stats interval', () => {
        const collector = createCollector();

        collector.collect(SSRC, 300);
        expect(collector.collect(SSRC + 1, 60).get(SSRC + 1)).toBe(60);
    });

    it('excludes audio and local video', () => {
        expect(createCollector(false).collect(SSRC, 50).size).toBe(0);
        expect(createCollector(true, true).collect(SSRC, 50).size).toBe(0);
    });
});
