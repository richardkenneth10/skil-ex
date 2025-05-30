export interface IMatch {
  otherUser: {
    id: number;
    name: string;
    avatarUrl: string | null;
  };
  offeredSkill: {
    id: number;
    name: string;
    category: { id: number; name: string };
  };
  wantedSkill: {
    id: number;
    name: string;
    category: { id: number; name: string };
  };
  pendingMatch?:
    | {
        id: number;
        userStatus: 'RECEIVER' | 'SENDER';
      }
    | undefined;
}
