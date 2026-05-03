import type { NormalizedRecord } from "../types/record.ts";

export interface NormalizedRecordRepository {
  listAll(): Promise<NormalizedRecord[]>;
  replaceForAccount(
    accountKey: string,
    nextRecords: NormalizedRecord[],
  ): Promise<NormalizedRecord[]>;
}
