import {
  RtpCapabilities,
  RtpParameters,
} from 'mediasoup/node/lib/rtpParametersTypes';

export type Entries<T> = {
  [K in keyof T]: [K, T[K]];
}[keyof T][];

export type RecordInfo = {
  fileName: string;
  video: MediaRecordInfo[];
  audio: MediaRecordInfo[];
};

export interface MediaRecordInfo {
  remoteRtpPort: number;
  rtpCapabilities: RtpCapabilities;
  rtpParameters: RtpParameters;
  remoteRtcpPort?: number;
  localRtcpPort?: number;
}
