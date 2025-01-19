import { SetMetadata } from '@nestjs/common';

export const IN_WEB_SOCKET_CONTEXT_KEY = 'inWebSocketContext';
export const InWebSocketContext = () => SetMetadata('inWebSocketContext', true);
