export class OutboxMessageRepository {
  constructor(store) {
    this.store = store;
    this.collection = "outbox-messages";
  }

  async listAll() {
    return this.store.readCollection(this.collection);
  }

  async create(message) {
    return this.store.updateCollection(this.collection, (messages) => {
      messages.push(message);
      return messages;
    });
  }
}
