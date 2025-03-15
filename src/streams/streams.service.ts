import { Injectable, NotFoundException } from '@nestjs/common';
import { StreamSession } from '@prisma/client';
import { PrismaService } from 'src/db/prisma.service';
import { SignalingUser } from 'src/gateways/web-rtc2/types/signaling-user.type';
import { WebRTCGateway2 } from 'src/gateways/web-rtc2/web-rtc.gateway';
import { UsersService } from 'src/users/users.service';
import { miniUserSelect } from 'src/utils/db/constants/mini-user-select.constant';

@Injectable()
export class StreamsService {
  constructor(
    private prisma: PrismaService,
    private usersService: UsersService,
    private webRTCGateway: WebRTCGateway2,
  ) {}

  async getLiveInfo(userId: number, channelId: string) {
    const session = await this.prisma.streamSession.findUnique({
      where: {
        channelId,
        OR: [{ teacherId: userId }, { learnerId: userId }],
        endedAt: null,
      },
      include: {
        teacher: { select: miniUserSelect },
        learner: { select: miniUserSelect },
      },
    });
    if (!session)
      throw new NotFoundException('There is no ongoing session in this room.');

    const channel = this.webRTCGateway.getChannelInfo(session.channelId);

    const role = this.getUserRole(session, userId);
    const user: SignalingUser = {
      role,
      user: this.usersService.generateMiniUser(
        role == 'TEACHER' ? session.teacher : session.learner,
      ),
    };
    return {
      user,
      channel,
    };
  }

  async endLive(channelId: string) {
    let session = await this.prisma.streamSession.findUnique({
      where: { channelId },
    });

    if (!session)
      throw new NotFoundException(`No ongoing stream session in room.`);

    session = await this.prisma.streamSession.update({
      where: { id: session.id },
      data: { endedAt: new Date() },
    });

    return { ...session, endedAt: session.endedAt! };
  }

  async validateUserIsInOngoingStreamChannel(
    userId: number,
    channelId: string,
  ) {
    const session = await this.prisma.streamSession.findUnique({
      where: {
        channelId,
        OR: [{ teacherId: userId }, { learnerId: userId }],
        endedAt: null,
      },
      include: {
        teacher: { select: miniUserSelect },
        learner: { select: miniUserSelect },
      },
    });
    if (!session)
      throw new NotFoundException(
        `Stream session with channel id '${channelId}' having user with id '${userId}' does not exist.`,
      );

    const user =
      session.teacherId === userId ? session.teacher : session.learner;

    return {
      role: this.getUserRole(session, userId),
      user: this.usersService.generateMiniUser(user),
    };
  }

  private getUserRole(session: StreamSession, userId: number) {
    return session.teacherId === userId
      ? ('TEACHER' as const)
      : ('LEARNER' as const);
  }
}
