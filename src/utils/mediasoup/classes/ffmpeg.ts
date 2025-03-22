import { InternalServerErrorException } from '@nestjs/common';
import { ChildProcessWithoutNullStreams, execSync, spawn } from 'child_process';
// import * as FFmpegStatic from 'ffmpeg-static';
import { existsSync, mkdirSync } from 'fs';
import {
  MediaKind,
  RtpParameters,
} from 'mediasoup/node/lib/rtpParametersTypes';
import mediasoupConfig from 'src/utils/mediasoup/config/mediasoup.config';
import { EventEmitter, Readable } from 'stream';
import { RecordInfo } from '../interfaces/record-info';

const FFmpegStatic = require('ffmpeg-static');
const RECORD_FILE_LOCATION_PATH =
  process.env.RECORD_FILE_LOCATION_PATH || './recordings';
const cmdProgram = FFmpegStatic;

export default class FFmpeg {
  constructor(recordInfo: RecordInfo, videoType: 'webm' | 'mp4') {
    this._recordInfo = recordInfo;
    this._observer = new EventEmitter();
    this._videoType = videoType;
    this._process = undefined;
    this._createProcess();
  }

  private _recordInfo;
  private _observer;
  private _videoType;
  private _process?: ChildProcessWithoutNullStreams;

  kill = () => {
    //close consumers
    setTimeout(
      () => {
        console.log('kill() [pid:%d]', this._process?.pid);
        this._process?.kill('SIGINT');
        // execSync('taskkill /F /IM ffmpeg.exe');
      },
      //workaround for cutting record and also, you may need to actually wait to start recording beffore you inform the users (for webm)
      this._videoType === 'webm' ? 2000 : 0,
    );
  };

  validateFFmpeg = () => {
    // Ensure correct FFmpeg version is installed
    const ffmpegOut = execSync(cmdProgram + ' -version', {
      encoding: 'utf8',
    });
    const ffmpegVerMatch = /ffmpeg version (\d+)/.exec(ffmpegOut);
    let ffmpegOk = false;

    if (ffmpegOut.startsWith('ffmpeg version git')) {
      // Accept any Git build (it's up to the developer to ensure that a recent
      // enough version of the FFmpeg source code has been built)
      ffmpegOk = true;
    } else if (ffmpegVerMatch) {
      console.log(parseInt(ffmpegVerMatch[1], 10));

      const ffmpegVerMajor = parseInt(ffmpegVerMatch[1], 10);
      if (ffmpegVerMajor >= 4) {
        ffmpegOk = true;
      }
    }

    if (!ffmpegOk) {
      console.error('FFmpeg >= 4.0.0 not found in $PATH; please install it');
      throw new InternalServerErrorException('Could not set up recording.');
    }
  };

  private _createProcess = () => {
    if (!cmdProgram) {
      console.warn('cmdProgram for ffmpeg invalid', cmdProgram);
      return;
    }

    this.validateFFmpeg();

    const sdpString = createSdpText(this._recordInfo);
    const sdpStream = convertStringToStream(sdpString);

    console.log('createProcess() [sdpString:%s]', sdpString);

    // Ensure the directory exists
    if (!existsSync(RECORD_FILE_LOCATION_PATH)) {
      mkdirSync(RECORD_FILE_LOCATION_PATH, { recursive: true });
    }

    this._process = spawn(
      cmdProgram,
      this._commandArgs,
      // { shell: true }
    );

    if (this._process.stderr) {
      this._process.stderr.setEncoding('utf-8');

      this._process.stderr.on('data', (data) =>
        console.log('ffmpeg::process::data [data:%o]', data),
      );
    }

    if (this._process.stdout) {
      this._process.stdout.setEncoding('utf-8');

      this._process.stdout.on('data', (data) =>
        console.log('ffmpeg::process::data [data:%o]', data),
      );
    }

    this._process.on('exit', (code, signal) => {
      console.log('Recording process exit, code: %d, signal: %s', code, signal);

      // stopMediasoupRtp();

      if (
        // !signal ||
        signal === 'SIGINT'
      ) {
        console.log('Recording stopped');
      } else {
        console.warn(
          "Recording process didn't exit cleanly, output file might be corrupt",
        );
      }
    });

    this._process.on('message', (message) =>
      console.log('ffmpeg::process::message [message:%o]', message),
    );
    this._process.on('error', (error) =>
      console.error('ffmpeg::process::error [error:%o]', error),
    );
    this._process.once('close', () => {
      console.log('ffmpeg::process::close');
      this._observer.emit('process-close');
    });

    sdpStream.on('error', (error) =>
      console.error('sdpStream::error [error:%o]', error),
    );

    sdpStream.resume();
    sdpStream.pipe(this._process.stdin);
  };

  private get _commandArgs() {
    let commandArgs = [
      '-nostdin',
      '-loglevel',
      'debug',
      '-protocol_whitelist',
      'pipe,udp,rtp',
      '-fflags',
      '+genpts',
      '-f',
      'sdp',
      '-i',
      'pipe:0',
    ];

    this._recordInfo.video.forEach((_, index) => {
      commandArgs = commandArgs.concat(this._getVideoArgs(index));
    });
    commandArgs = commandArgs.concat([
      // 'libx264',
      // '-preset',
      // 'ultrafast',
      '-c:v',
      'copy',
    ]);

    // this._recordInfo.audio.forEach((_, index) => {
    //   commandArgs = commandArgs.concat(this._getAudioArgs(index));
    // });

    // commandArgs = commandArgs.concat([
    // // `"[0:a:0][0:a:1]amix=inputs=2:duration=longest[aout]"`,
    // ]);
    // commandArgs = commandArgs.concat([
    // '-filter_complex',
    // `"[0:a:0]aresample=async=1[first];[0:a:1]aresample=async=1[second]"`,
    // '-map',
    // `"[first]"`,
    // '-map',
    // `"[second]"`,
    // '-ac',
    // '2',
    // '-map',
    // `"[aout]"`,
    // ]);

    // commandArgs = commandArgs.concat([
    // '-filter_complex',
    // `"amerge[aout]"`,
    // '-ac',
    // '2',
    // '-map',
    // `"[aout]"`,
    // ]);

    commandArgs = commandArgs.concat(
      this._recordInfo.audio.length < 2
        ? this._getAudioArgs(0)
        : this.formatData.filter,
    );

    commandArgs = commandArgs.concat(this.formatData.cmdFormat);

    commandArgs = commandArgs.concat([
      '-y',
      `${RECORD_FILE_LOCATION_PATH}/${this._recordInfo.fileName}${this.formatData.outputExt}`,
    ]);

    console.log('commandArgs:%o', commandArgs.join(' '));

    return commandArgs;
  }

  private get webmFilter() {
    return ['-filter_complex', `amerge[aout]`, '-ac', '2', '-map', `[aout]`];
  }

  private get mp4Filter() {
    return [
      '-filter_complex',
      `"amerge[aout]"`,
      '-ac',
      '2',
      '-map',
      `"[aout]"`,
    ];
  }

  private get webmCMDFormat() {
    return [
      '-c:a',
      'libopus',
      '-movflags',
      '+faststart',
      '-flush_packets',
      '1',
      '-fflags',
      'nobuffer',
      '-rtbufsize',
      '100M',
      '-f',
      'webm',
      '-flags',
      '-global_header',
    ];
  }
  private get mp4CMDFormat() {
    return ['-c:a', 'aac', '-f', 'mp4'];
  }

  private get formatData() {
    switch (this._videoType) {
      case 'webm':
        return {
          filter: this.webmFilter,
          cmdFormat: this.webmCMDFormat,
          outputExt: `.${this._videoType}`,
        };
      case 'mp4':
        return {
          filter: this.mp4Filter,
          cmdFormat: this.mp4CMDFormat,
          outputExt: `.${this._videoType}`,
        };
    }
  }

  private _getVideoArgs(index: number) {
    return ['-map', `0:v:${index}?`];
  }

  private _getAudioArgs(index: number) {
    return ['-map', `0:a:${index}?`];
  }
}
const convertStringToStream = (stringToConvert: string) => {
  const stream = new Readable();
  stream._read = () => {};
  stream.push(stringToConvert);
  stream.push(null);

  return stream;
};

const getCodecInfoFromRtpParameters = (
  kind: MediaKind,
  rtpParameters: RtpParameters,
) => {
  const parameters: (typeof mediasoupConfig.router.mediaCodecs)[number]['parameters'] =
    rtpParameters.codecs[0].parameters;

  return {
    payloadType: rtpParameters.codecs[0].payloadType,
    codecName: rtpParameters.codecs[0].mimeType.replace(`${kind}/`, ''),
    clockRate: rtpParameters.codecs[0].clockRate,
    channels: kind === 'audio' ? rtpParameters.codecs[0].channels : undefined,
    parameters,
  };
};

const createSdpText = (recordInfo: RecordInfo) => {
  const { video, audio } = recordInfo;

  // Video codec info
  const videoData = video.map((v) => ({
    ...v,
    codecInfo: getCodecInfoFromRtpParameters('video', v.rtpParameters),
  }));

  // Audio codec info
  const audioData = audio.map((a) => ({
    ...a,
    codecInfo: getCodecInfoFromRtpParameters('audio', a.rtpParameters),
  }));

  const formatParams = (
    params: ReturnType<typeof getCodecInfoFromRtpParameters>['parameters'],
    payloadType: number,
  ) => {
    const formatted = (
      Object.entries(params) as [
        keyof typeof params,
        (typeof params)[keyof typeof params],
      ][]
    )
      .map(([key, val]) => `${key}=${val}`)
      .join(';');

    return formatted && `a=fmtp:${payloadType} ${formatted}`;
  };

  return `v=0
    o=- 0 0 IN IP4 127.0.0.1
    s=-
    c=IN IP4 127.0.0.1
    t=0 0
    a=sendonly
    ${videoData.map(
      ({
        remoteRtpPort,
        remoteRtcpPort,
        codecInfo: { payloadType, codecName, clockRate, parameters },
      }) =>
        `m=video ${remoteRtpPort} RTP/AVP ${payloadType}${
          remoteRtcpPort
            ? `
    a=rtcp:${remoteRtcpPort}`
            : ''
        }
    a=rtpmap:${payloadType} ${codecName}/${clockRate}
    ${formatParams(parameters, payloadType)}`,
    ).join(`
    `)}
    ${audioData.map(
      ({
        remoteRtpPort,
        remoteRtcpPort,
        codecInfo: { payloadType, codecName, clockRate, channels, parameters },
      }) => `m=audio ${remoteRtpPort} RTP/AVP ${payloadType}${
        remoteRtcpPort
          ? `
  a=rtcp:${remoteRtcpPort}`
          : ''
      }
    a=rtpmap:${payloadType} ${codecName}/${clockRate}/${channels}
    ${formatParams(parameters, payloadType)}`,
    ).join(`
    `)}
    `;
};

////////webm and opus
// import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
// import { existsSync, mkdirSync } from 'fs';
// import {
//   MediaKind,
//   RtpParameters,
// } from 'mediasoup/node/lib/rtpParametersTypes';
// import { EventEmitter, Readable } from 'stream';
// import { RecordInfo } from '../interfaces/record-info';

// const RECORD_FILE_LOCATION_PATH =
//   process.env.RECORD_FILE_LOCATION_PATH || './recordings';

// export default class FFmpeg {
//   constructor(recordInfo: RecordInfo) {
//     this._recordInfo = recordInfo;
//     this._observer = new EventEmitter();
//     this._process = undefined;
//     this._createProcess();
//   }

//   private _recordInfo;
//   private _observer;
//   private _process?: ChildProcessWithoutNullStreams;

//   kill = () => {
//     console.log('kill() [pid:%d]', this._process?.pid);
//     this._process?.kill('SIGINT');
//   };

//   private _createProcess = () => {
//     const sdpString = createSdpText(this._recordInfo);
//     const sdpStream = convertStringToStream(sdpString);

//     console.log('createProcess() [sdpString:%s]', sdpString);
//     console.log('commandArgs:%o', this._commandArgs);

//     // Ensure the directory exists
//     if (!existsSync(RECORD_FILE_LOCATION_PATH)) {
//       mkdirSync(RECORD_FILE_LOCATION_PATH, { recursive: true });
//     }

//     this._process = spawn(
//       // 'C:/Users/richa/ffmpeg/bin/ffmpeg.exe',
//       'ffmpeg',
//       this._commandArgs,
//     );

//     if (this._process.stderr) {
//       this._process.stderr.setEncoding('utf-8');

//       this._process.stderr.on('data', (data) =>
//         console.log('ffmpeg::process::data [data:%o]', data),
//       );
//     }

//     if (this._process.stdout) {
//       this._process.stdout.setEncoding('utf-8');

//       this._process.stdout.on('data', (data) =>
//         console.log('ffmpeg::process::data [data:%o]', data),
//       );
//     }

//     this._process.on('message', (message) =>
//       console.log('ffmpeg::process::message [message:%o]', message),
//     );
//     this._process.on('error', (error) =>
//       console.error('ffmpeg::process::error [error:%o]', error),
//     );
//     this._process.once('close', () => {
//       console.log('ffmpeg::process::close');
//       this._observer.emit('process-close');
//     });

//     sdpStream.on('error', (error) =>
//       console.error('sdpStream::error [error:%o]', error),
//     );

//     sdpStream.resume();
//     sdpStream.pipe(this._process.stdin);
//   };

//   private get _commandArgs() {
//     let commandArgs = [
//       '-loglevel',
//       'debug',
//       '-protocol_whitelist',
//       'pipe,udp,rtp',
//       '-fflags',
//       '+genpts',
//       '-f',
//       'sdp',
//       '-i',
//       'pipe:0',
//     ];

//     this._recordInfo.video.forEach((_, index) => {
//       commandArgs = commandArgs.concat(this._getVideoArgs(index));
//     });
//     commandArgs = commandArgs.concat(['-c:v', 'copy']);

//     this._recordInfo.audio.forEach((_, index) => {
//       commandArgs = commandArgs.concat(this._getAudioArgs(index));
//     });
//     commandArgs = commandArgs.concat(['-strict', '-2', '-c:a', 'copy']);

//     commandArgs = commandArgs.concat([
//       /*
//             '-flags',
//             '+global_header',
//             */
//       `${RECORD_FILE_LOCATION_PATH}/${this._recordInfo.fileName}.webm`,
//     ]);

//     console.log('commandArgs:%o', commandArgs);

//     return commandArgs;
//   }

//   private _getVideoArgs(index: number) {
//     return ['-map', `0:v:${index}`];
//   }

//   private _getAudioArgs(index: number) {
//     return ['-map', `0:a:${index}`];
//   }
// }
// const convertStringToStream = (stringToConvert: string) => {
//   const stream = new Readable();
//   stream._read = () => {};
//   stream.push(stringToConvert);
//   stream.push(null);

//   return stream;
// };

// const getCodecInfoFromRtpParameters = (
//   kind: MediaKind,
//   rtpParameters: RtpParameters,
// ) => {
//   return {
//     payloadType: rtpParameters.codecs[0].payloadType,
//     codecName: rtpParameters.codecs[0].mimeType.replace(`${kind}/`, ''),
//     clockRate: rtpParameters.codecs[0].clockRate,
//     channels: kind === 'audio' ? rtpParameters.codecs[0].channels : undefined,
//   };
// };

// const createSdpText = (recordInfo: RecordInfo) => {
//   const { video, audio } = recordInfo;

//   // Video codec info
//   const videoData = video.map((v) => ({
//     ...v,
//     codecInfo: getCodecInfoFromRtpParameters('video', v.rtpParameters),
//   }));

//   // Audio codec info
//   const audioData = audio.map((a) => ({
//     ...a,
//     codecInfo: getCodecInfoFromRtpParameters('audio', a.rtpParameters),
//   }));

//   return `v=0
//     o=- 0 0 IN IP4 127.0.0.1
//     s=Recording
//     c=IN IP4 127.0.0.1
//     t=0 0
//     ${videoData.map(
//       ({ remoteRtpPort, codecInfo: { payloadType, codecName, clockRate } }) =>
//         `m=video ${remoteRtpPort} RTP/AVP ${payloadType}
//     a=rtpmap:${payloadType} ${codecName}/${clockRate}
//     a=sendonly`,
//     ).join(`
//     `)}
//     ${audioData.map(
//       ({
//         remoteRtpPort,
//         codecInfo: { payloadType, codecName, clockRate, channels },
//       }) => `m=audio ${remoteRtpPort} RTP/AVP ${payloadType}
//     a=rtpmap:${payloadType} ${codecName}/${clockRate}/${channels}
//     a=sendonly`,
//     ).join(`
//     `)}
//     `;
// };
