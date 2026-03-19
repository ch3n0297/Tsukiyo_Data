export class SessionRepository {
  constructor(store) {
    this.store = store;
    this.collection = "sessions";
  }

  async listAll() {
    return this.store.readCollection(this.collection);
  }

  async findById(sessionId) {
    const sessions = await this.listAll();
    return sessions.find((session) => session.id === sessionId) ?? null;
  }

  async create(session) {
    return this.store.updateCollection(this.collection, (sessions) => {
      sessions.push(session);
      return sessions;
    });
  }

  async updateById(sessionId, patch) {
    let updatedSession = null;

    await this.store.updateCollection(this.collection, (sessions) => {
      const index = sessions.findIndex((session) => session.id === sessionId);

      if (index === -1) {
        return sessions;
      }

      sessions[index] = {
        ...sessions[index],
        ...patch,
      };
      updatedSession = sessions[index];
      return sessions;
    });

    return updatedSession;
  }

  async deleteById(sessionId) {
    return this.store.updateCollection(this.collection, (sessions) =>
      sessions.filter((session) => session.id !== sessionId),
    );
  }

  async deleteByUserId(userId) {
    return this.store.updateCollection(this.collection, (sessions) =>
      sessions.filter((session) => session.userId !== userId),
    );
  }
}
