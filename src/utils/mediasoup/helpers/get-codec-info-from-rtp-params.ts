import {
  MediaKind,
  RtpParameters,
} from 'mediasoup/node/lib/rtpParametersTypes';
import mediasoupConfig from '../config/mediasoup.config';

export default function getCodecInfoFromRtpParameters(
  kind: MediaKind,
  rtpParameters: RtpParameters,
) {
  const parameters: (typeof mediasoupConfig.router.mediaCodecs)[number]['parameters'] =
    rtpParameters.codecs[0].parameters;

  return {
    payloadType: rtpParameters.codecs[0].payloadType,
    codecName: rtpParameters.codecs[0].mimeType.replace(`${kind}/`, ''),
    clockRate: rtpParameters.codecs[0].clockRate,
    channels: kind === 'audio' ? rtpParameters.codecs[0].channels : undefined,
    parameters,
  };
}
