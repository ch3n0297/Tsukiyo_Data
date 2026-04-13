export type OutboxMessageType = 'password-reset';

export interface OutboxMessage {
  id: string;
  type: OutboxMessageType;
  to: string;
  subject: string;
  body: string;
  createdAt: string;
}
