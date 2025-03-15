import { IMiniUser } from 'src/auth/interfaces/mini-user.interface';
import UserSignalingRole from './user-signaling-role.type';

export type SignalingUser = { role: UserSignalingRole; user: IMiniUser };
