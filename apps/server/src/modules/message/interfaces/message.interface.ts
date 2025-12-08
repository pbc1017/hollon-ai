import { ParticipantType } from '../enums/message.enums';

export interface Participant {
  type: ParticipantType;
  id: string;
}

export interface InboxOptions {
  unreadOnly?: boolean;
  requiresResponse?: boolean;
  limit?: number;
  offset?: number;
}
