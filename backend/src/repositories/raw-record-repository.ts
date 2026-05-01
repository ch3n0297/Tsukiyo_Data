import type { RawRecord } from "../types/record.ts";

export interface RawRecordRepository {
  listAll(): Promise<RawRecord[]>;
  appendMany(recordsToAdd: RawRecord[]): Promise<RawRecord[]>;
}
