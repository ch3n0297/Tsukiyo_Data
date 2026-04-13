import type { FileStore } from "../lib/fs-store.ts";
import type { OutboxMessage } from "../types/outbox.ts";

export class OutboxMessageRepository {
  private readonly store: FileStore;
  private readonly collection = "outbox-messages";

  constructor(store: FileStore) {
    this.store = store;
  }

  async listAll(): Promise<OutboxMessage[]> {
    return this.store.readCollection<OutboxMessage>(this.collection);
  }

  async create(message: OutboxMessage): Promise<OutboxMessage[]> {
    return this.store.updateCollection<OutboxMessage>(this.collection, (messages) => {
      const nextMessages = Array.isArray(messages) ? messages : [];
      nextMessages.push(message);
      return nextMessages;
    });
  }
}
