import { ChildProcess, spawn } from 'child_process';
import { EventEmitter } from 'events';
import { MediaKind } from 'mediasoup/node/lib/rtpParametersTypes';
import Constants from '../constants';
import getCodecInfoFromRtpParameters from '../helpers/get-codec-info-from-rtp-params';
import { MediaRecordInfo, RecordInfo } from '../interfaces/record-info';

const treeKill = require('tree-kill');

const GSTREAMER_DEBUG_LEVEL = process.env.GSTREAMER_DEBUG_LEVEL || '3';
const GSTREAMER_COMMAND = 'gst-launch-1.0';
const GSTREAMER_OPTIONS = `--gst-debug-level=${GSTREAMER_DEBUG_LEVEL} -v -e`;

export default class GStreamer {
  constructor(recordInfo: RecordInfo) {
    this._recordInfo = recordInfo;
    this._observer = new EventEmitter();
    this._process = undefined;
    this._createProcess();
  }

  private _recordInfo;
  private _observer;
  private _process?: ChildProcess;

  kill() {
    console.log('kill() [pid:%d]', this._process?.pid);
    // this._process?.kill('SIGINT');

    if (this._process?.pid) treeKill(this._process.pid, 'SIGINT');
  }

  restart(mediaRecordInfo: MediaRecordInfo, mediaKind: MediaKind) {
    this._process?.kill();
    this._recordInfo[mediaKind].push(mediaRecordInfo);
    this._createProcess();
  }

  private _createProcess() {
    // Use the commented out exe to create gstreamer dot file
    // const exe = `GST_DEBUG_DUMP_DOT_DIR=./dump ${GSTREAMER_COMMAND} ${GSTREAMER_OPTIONS}`;

    const exe = `${GSTREAMER_COMMAND} ${GSTREAMER_OPTIONS}`;

    console.log(this._commandArgs);

    this._process = spawn(exe, this._commandArgs, {
      detached: false,
      shell: true,
    });

    if (this._process.stderr) {
      this._process.stderr.setEncoding('utf-8');
    }
    if (this._process.stdout) {
      this._process.stdout.setEncoding('utf-8');
    }

    this._process.on('message', (message) => {
      // console.log(
      //   'gstreamer::process::message [pid:%d, message:%o]',
      //   this._process?.pid,
      //   message,
      // );
    });

    this._process.on('error', (error) => {
      // console.log(
      //   'gstreamer::process::error [pid:%d, error:%o]',
      //   this._process?.pid,
      //   error,
      // );
    });

    this._process.once('close', () => {
      console.log('gstreamer::process::close [pid:%d]', this._process?.pid);
      this._observer.emit('process-close');
    });

    this._process.stderr?.on('data', (data) => {
      console.log('gstreamer::process::stderr::data [data:%o]', data);
    });

    this._process.stdout?.on('data', (data) => {
      // console.log('gstreamer::process::stdout::data [data:%o]', data);
    });
  }

  private get _commandArgs() {
    let commandArgs = [
      `rtpbin name=rtpbin latency=50 buffer-mode=0 sdes="application/x-rtp-source-sdes, cname=(string)${this._recordInfo.video[0].rtpParameters.rtcp?.cname}"`,
      '!',
    ];

    let sinkIndex = 0;
    this._recordInfo.video.forEach((_, index) => {
      commandArgs = commandArgs.concat(this._getVideoArgs(index, sinkIndex));
      commandArgs = commandArgs.concat(
        this._getRtcpArgs('video', index, sinkIndex),
      );
      sinkIndex++;
    });
    this._recordInfo.audio.forEach((_, index) => {
      commandArgs = commandArgs.concat(this._getAudioArgs(index, sinkIndex));
      commandArgs = commandArgs.concat(
        this._getRtcpArgs('audio', index, sinkIndex),
      );
      sinkIndex++;
    });
    commandArgs = commandArgs.concat(this._addArgs);

    // commandArgs = commandArgs.concat(this._videoArgs);
    // commandArgs = commandArgs.concat(this._audioArgs);
    commandArgs = commandArgs.concat(this._sinkArgs);
    // commandArgs = commandArgs.concat(this._rtcpArgs);

    return commandArgs;
  }

  private _getVideoArgs(index: number, sinkIndex: number) {
    const { rtpParameters, remoteRtpPort } = this._recordInfo.video[index];

    const { clockRate, payloadType, codecName } = getCodecInfoFromRtpParameters(
      'video',
      rtpParameters,
    );

    const VIDEO_CAPS = `application/x-rtp,media=(string)video,clock-rate=(int)${clockRate},payload=(int)${payloadType},encoding-name=(string)${codecName.toUpperCase()},ssrc=(uint)${rtpParameters.encodings![0].ssrc}`;

    return [
      `udpsrc port=${remoteRtpPort} caps=${VIDEO_CAPS}`,
      '!',
      `rtpbin.recv_rtp_sink_${sinkIndex} rtpbin.`,
      '!',
      'queue',
      '!',
      'rtpvp8depay',
      '!',
      'mux.',
    ];
  }

  private _getAudioArgs(index: number, sinkIndex: number) {
    const { rtpParameters, remoteRtpPort } = this._recordInfo.audio[index];

    const { clockRate, payloadType, codecName } = getCodecInfoFromRtpParameters(
      'audio',
      rtpParameters,
    );

    const AUDIO_CAPS = `application/x-rtp,media=(string)audio,clock-rate=(int)${clockRate},payload=(int)${payloadType},encoding-name=(string)${codecName.toUpperCase()},ssrc=(uint)${rtpParameters.encodings![0].ssrc}`;

    return [
      `udpsrc port=${remoteRtpPort} caps=${AUDIO_CAPS}`,
      '!',
      `rtpbin.recv_rtp_sink_${sinkIndex} rtpbin.`,
      '!',
      'rtpopusdepay',
      '!',
      'opusdec',
      '!',
      'queue',
      '!',
      'add.',
    ];
  }

  private _getRtcpArgs(type: MediaKind, index: number, sinkIndex: number) {
    const { [type]: mediaArr } = this._recordInfo;
    const { remoteRtcpPort, localRtcpPort } = mediaArr[index];

    return [
      `udpsrc address=127.0.0.1 port=${remoteRtcpPort}`,
      '!',
      `rtpbin.recv_rtcp_sink_${sinkIndex} rtpbin.send_rtcp_src_${sinkIndex}`,
      '!',
      `udpsink host=127.0.0.1 port=${localRtcpPort} bind-address=127.0.0.1 bind-port=${remoteRtcpPort} sync=false async=false`,
    ];
  }

  private get _addArgs() {
    return [
      'adder name=add',
      '!',
      'audioconvert',
      '!',
      'opusenc',
      '!',
      'queue',
      '!',
      'mux.',
    ];
  }

  private get _sinkArgs() {
    return [
      'webmmux name=mux',
      '!',
      `filesink location=${Constants.RECORD_FILE_LOCATION_PATH}/${this._recordInfo.fileName}.webm`,
    ];
  }
}
