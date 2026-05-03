import type { SheetOutputSnapshot, SheetStatusSnapshot } from "../types/sheet.ts";

export interface SheetSnapshotRepository {
  listStatuses(): Promise<SheetStatusSnapshot[]>;
  listOutputs(): Promise<SheetOutputSnapshot[]>;
  upsertStatus(snapshot: SheetStatusSnapshot): Promise<SheetStatusSnapshot[]>;
  upsertOutput(snapshot: SheetOutputSnapshot): Promise<SheetOutputSnapshot[]>;
}
