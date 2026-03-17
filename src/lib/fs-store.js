import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export class FileStore {
  #baseDir;
  #lock;

  constructor(baseDir) {
    this.#baseDir = baseDir;
    this.#lock = Promise.resolve();
  }

  async init(collections) {
    await mkdir(this.#baseDir, { recursive: true });
    await Promise.all(collections.map((collection) => this.#ensureFile(collection)));
  }

  async readCollection(collection) {
    return this.#withLock(async () => clone(await this.#readRawCollection(collection)));
  }

  async writeCollection(collection, records) {
    return this.#withLock(async () => {
      await this.#writeRawCollection(collection, records);
      return clone(records);
    });
  }

  async updateCollection(collection, updater) {
    return this.#withLock(async () => {
      const current = await this.#readRawCollection(collection);
      const next = await updater(clone(current));
      await this.#writeRawCollection(collection, next);
      return clone(next);
    });
  }

  async #withLock(task) {
    const result = this.#lock.then(task, task);
    this.#lock = result.catch(() => undefined);
    return result;
  }

  async #ensureFile(collection) {
    const filename = this.#getFilename(collection);

    try {
      await readFile(filename, "utf8");
    } catch {
      await this.#writeRawCollection(collection, []);
    }
  }

  async #readRawCollection(collection) {
    const filename = this.#getFilename(collection);
    const content = await readFile(filename, "utf8");
    return JSON.parse(content || "[]");
  }

  async #writeRawCollection(collection, records) {
    const filename = this.#getFilename(collection);
    const tempFilename = `${filename}.tmp`;
    const body = JSON.stringify(records, null, 2);
    await writeFile(tempFilename, `${body}\n`, "utf8");
    await rename(tempFilename, filename);
  }

  #getFilename(collection) {
    return path.join(this.#baseDir, `${collection}.json`);
  }
}
