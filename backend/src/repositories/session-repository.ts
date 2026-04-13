import type { FileStore } from "../lib/fs-store.ts";
import type { Session } from "../types/session.ts";

export class SessionRepository {
  private store: FileStore;
  private collection = "sessions";

  constructor(store: FileStore) {
    this.store = store;
  }

  async listAll(): Promise<Session[]> {
    return this.store.readCollection<Session>(this.collection);
  }

  async findById(sessionId: string): Promise<Session | null> {
    const sessions = await this.listAll();
    return sessions.find((session) => session.id === sessionId) ?? null;
  }

  async create(session: Session): Promise<Session[]> {
    return this.store.updateCollection<Session>(this.collection, (sessions) => {
      const nextSessions = Array.isArray(sessions) ? sessions : [];
      nextSessions.push(session);
      return nextSessions;
    });
  }

  async updateById(sessionId: string, patch: Partial<Session>): Promise<Session | null> {
    let updatedSession: Session | null = null;
    const { id: _ignoredId, ...safePatch } = patch ?? {};

    await this.store.updateCollection<Session>(this.collection, (sessions) => {
      const index = sessions.findIndex((session) => session.id === sessionId);

      if (index === -1) {
        return sessions;
      }

      sessions[index] = {
        ...sessions[index],
        ...safePatch,
      };
      updatedSession = sessions[index];
      return sessions;
    });

    return updatedSession;
  }

  async deleteById(sessionId: string): Promise<Session[]> {
    return this.store.updateCollection<Session>(this.collection, (sessions) =>
      sessions.filter((session) => session.id !== sessionId),
    );
  }

  async deleteByUserId(userId: string): Promise<Session[]> {
    return this.store.updateCollection<Session>(this.collection, (sessions) =>
      sessions.filter((session) => session.userId !== userId),
    );
  }
}
