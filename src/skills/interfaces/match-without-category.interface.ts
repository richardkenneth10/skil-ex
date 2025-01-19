export interface IMatchWithoutCategory {
  otherUser: {
    id: number;
    name: string;
    bio: string | null;
    avatarUrl: string | null;
  };
  offeredSkill: {
    id: number;
    name: string;
    categoryId: number;
  };
  wantedSkill: {
    id: number;
    name: string;
    categoryId: number;
  };
  pendingMatch?:
    | {
        id: number;
        userStatus: 'RECEIVER' | 'SENDER';
      }
    | undefined;
}
