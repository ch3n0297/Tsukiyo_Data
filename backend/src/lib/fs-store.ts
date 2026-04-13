import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const COLLECTION_NAME_PATTERN = /^[a-z0-9-]+$/;

export type CollectionUpdater<T> = (records: T[]) => T[] | Promise<T[]>;

export type MultiCollectionUpdater<T extends Record<string, unknown[]>> =
  (collections: T) => T | Promise<T>;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

interface CollectionEntry {
  collection: string;
  records: unknown[];
}

export class FileStore {
  #baseDir: string;
  #lock: Promise<unknown>;

  constructor(baseDir: string) {
    this.#baseDir = path.resolve(baseDir);
    this.#lock = Promise.resolve();
  }

  async init(collections: string[]): Promise<void> {
    await mkdir(this.#baseDir, { recursive: true });
    await Promise.all(collections.map((collection) => this.#ensureFile(collection)));
  }

  async readCollection<T>(collection: string): Promise<T[]> {
    return this.#withLock(async () => clone(await this.#readRawCollection<T>(collection)));
  }

  async writeCollection<T>(collection: string, records: T[]): Promise<T[]> {
    return this.#withLock(async () => {
      await this.#writeRawCollection(collection, records);
      return clone(records);
    });
  }

  async updateCollection<T>(collection: string, updater: CollectionUpdater<T>): Promise<T[]> {
    return this.#withLock(async () => {
      const current = await this.#readRawCollection<T>(collection);
      const next = await updater(clone(current));
      await this.#writeRawCollection(collection, next);
      return clone(next);
    });
  }

  async updateCollections<T extends Record<string, unknown[]>>(
    collections: string[],
    updater: MultiCollectionUpdater<T>
  ): Promise<T> {
    return this.#withLock(async () => {
      const uniqueCollections = [
        ...new Set(collections.map((collection) => this.#normalizeCollection(collection))),
      ];
      const current = {} as T;

      for (const collection of uniqueCollections) {
        (current as Record<string, unknown[]>)[collection] = await this.#readRawCollection(collection);
      }

      const next = await updater(clone(current));
      const entries: CollectionEntry[] = uniqueCollections.map((collection) => ({
        collection,
        records: (next as Record<string, unknown[]>)?.[collection],
      }));

      for (const entry of entries) {
        if (!Array.isArray(entry.records)) {
          throw new TypeError(
            `Collection updater must return an array for "${entry.collection}".`,
          );
        }
      }

      await this.#writeRawCollections(entries);
      return clone(next);
    });
  }

  async #withLock<T>(task: () => Promise<T>): Promise<T> {
    const result = this.#lock.then(task, task) as Promise<T>;
    this.#lock = result.catch(() => undefined);
    return result;
  }

  async #ensureFile(collection: string): Promise<void> {
    const filename = this.#getFilename(collection);

    try {
      await readFile(filename, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code !== "ENOENT") {
        throw error;
      }

      await this.#writeRawCollection(collection, []);
    }
  }

  async #readRawCollection<T>(collection: string): Promise<T[]> {
    const filename = this.#getFilename(collection);
    const content = await readFile(filename, "utf8");
    return JSON.parse(content || "[]") as T[];
  }

  async #writeRawCollection(collection: string, records: unknown[]): Promise<void> {
    await this.#writeRawCollections([{ collection, records }]);
  }

  #getFilename(collection: string): string {
    const normalizedCollection = this.#normalizeCollection(collection);
    const filename = path.resolve(this.#baseDir, `${normalizedCollection}.json`);
    const relative = path.relative(this.#baseDir, filename);

    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new TypeError(`Collection "${normalizedCollection}" resolves outside the data directory.`);
    }

    return filename;
  }

  #normalizeCollection(collection: string): string {
    if (typeof collection !== "string" || !COLLECTION_NAME_PATTERN.test(collection)) {
      throw new TypeError(
        'Collection names must match /^[a-z0-9-]+$/ and may not include path separators.',
      );
    }

    return collection;
  }

  async #writeRawCollections(entries: CollectionEntry[]): Promise<void> {
    const stagedFiles: Array<{ filename: string; tempFilename: string }> = [];

    try {
      for (const { collection, records } of entries) {
        if (!Array.isArray(records)) {
          throw new TypeError(`Collection "${collection}" must be written as an array.`);
        }

        const filename = this.#getFilename(collection);
        const tempFilename = path.join(
          path.dirname(filename),
          `.${path.basename(filename)}.${process.pid}.${Date.now()}.tmp`,
        );
        const body = JSON.stringify(records, null, 2);

        await writeFile(tempFilename, `${body}\n`, "utf8");
        stagedFiles.push({ filename, tempFilename });
      }

      for (const { filename, tempFilename } of stagedFiles) {
        await rename(tempFilename, filename);
      }
    } catch (error) {
      await Promise.all(
        stagedFiles.map(({ tempFilename }) => unlink(tempFilename).catch(() => undefined)),
      );
      throw error;
    }
  }
}
