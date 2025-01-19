// import { ArgumentsHost, Catch, HttpException } from '@nestjs/common';
// import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';

// @Catch(WsException, HttpException)
// export class WebSocketExceptionFilter extends BaseWsExceptionFilter {
//   catch(exception: WsException | HttpException, host: ArgumentsHost) {
//     // console.log(exception);

//     const client = host.switchToWs().getClient() as WebSocket;
//     const data = host.switchToWs().getData();
//     const error =
//       exception instanceof WsException
//         ? exception.getError()
//         : exception.getResponse();
//     const details = error instanceof Object ? { ...error } : { message: error };
//     console.log(details);

//     client.send(
//       JSON.stringify({
//         event: 'error',
//         data: {
//           id: (client as any).id,
//           rid: data.rid,
//           ...details,
//         },
//       }),
//     );
//   }
// }

import { ArgumentsHost, Catch } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Catch()
export class WebSocketExceptionFilter extends BaseWsExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const args = host.getArgs();
    // Find possible acknowledgement callback from the end of arguments
    const ackCallback = this.findAckCallback(args);

    const client = host.switchToWs().getClient() as Socket;
    const data = host.switchToWs().getData();
    const error =
      exception instanceof WsException
        ? exception.getError()
        : exception.getResponse();
    if (ackCallback !== null) {
      console.log('acknowledgement callback exists');
      ackCallback(error);
    } else {
      console.log('acknowledgement callback does not exist');
      client.emit('globalError', error);
    }
  }

  /**
   * Finds the acknowledgement callback from the end of the arguments.
   * @param args The arguments passed to the event handler.
   * @returns The acknowledgement callback if it exists, otherwise null.
   */
  findAckCallback = (args: unknown[]): Function | null => {
    if (Array.isArray(args) && args.length >= 1) {
      for (let i = args.length - 1; i >= Math.max(0, args.length - 3); i--) {
        const arg = args[i];
        if (typeof arg === 'function') {
          return arg;
        }
      }
    }
    return null;
  };
}
