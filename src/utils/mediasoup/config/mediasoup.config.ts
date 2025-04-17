import { cpus } from 'os';

export default Object.freeze({
  numWorkers: Object.keys(cpus()).length,
  worker: {
    ...(process.env.NODE_ENV == 'local' && { logLevel: 'debug' as const }),
    logTags: ['rtp' as const, 'srtp' as const, 'rtcp' as const],
    rtcMinPort: 40000,
    rtcMaxPort: 49999,
  },
  router: {
    mediaCodecs: [
      {
        kind: 'audio' as const,
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
        //added
        preferredPayloadType: 111,
        parameters: {
          minptime: 10,
          useinbandfec: 1,
        },
      },
      {
        kind: 'video' as const,
        mimeType: 'video/VP8',
        clockRate: 90000,
        parameters: {
          'x-google-start-bitrate': 1000,
        },
      },
      {
        kind: 'video' as const,
        mimeType: 'video/VP9',
        clockRate: 90000,
        parameters: {
          'profile-id': 2,
          'x-google-start-bitrate': 1000,
        },
      },
      {
        kind: 'video' as const,
        mimeType: 'video/H264',
        clockRate: 90000,
        parameters: {
          'packetization-mode': 1,
          'profile-level-id': '42e01f',
          'level-asymmetry-allowed': 1,
          'x-google-start-bitrate': 1000,
        },
      },
    ],
  },
  webRtcTransport: {
    listenIps: [{ ip: '0.0.0.0', announcedIp: process.env.BASE_DOMAIN! }], // TODO: Change announcedIp to your external IP or domain name
    enableUdp: false,
    enableTcp: true,
    preferUdp: false,
    maxIncomingBitrate: 1500000,
  },
  plainRtpTransport: {
    listenIp: {
      ip: '0.0.0.0',
      announcedIp: process.env.BASE_DOMAIN!,
    }, // TODO: Change announcedIp to your external IP or domain name
    rtcpMux: true,
    comedia: false,
  },
});
