# Technical Spec:TypeScript 核心型別定義

**目的**:定義所有 repository、service、adapter、route 共用的 TypeScript interface。Coding Agent 撰寫型別相關程式碼時以本文件為準,避免自創欄位。

**對應 ADR**:[ADR-003 TypeScript 全面遷移](../adr/ADR-003-typescript-full-migration.md)

---

## 檔案規劃

所有共用型別放在 `backend/src/types/`,按領域拆分:

```
backend/src/types/
├── platform.ts        ← Platform, PlatformToken
├── job.ts             ← Job, JobStatus, TriggerSource
├── account-config.ts  ← AccountConfig
├── adapter.ts         ← PlatformAdapter, RawPlatformRecord
├── normalized.ts      ← NormalizedRecord
└── index.ts           ← re-export 全部
```

前端共用型別以 `frontend/src/types/` 為主,必要時從後端 types 複製(避免跨目錄 import)。

---

## 核心 Interface

### `types/platform.ts`

```typescript
export type Platform = 'instagram' | 'facebook' | 'tiktok' | 'google';

export interface PlatformToken {
  id: string;
  userId: string;
  platform: Platform;
  accountId: string | null;
  accessToken: string;        // 加密後的值(寫入 DB 前)或解密後的值(讀出後)
  refreshToken: string | null; // TikTok、Google 有;Meta 無
  expiresAt: Date | null;
  scopes: string[];
  tokenMetadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
```

### `types/job.ts`

```typescript
export type JobStatus = 'queued' | 'running' | 'success' | 'error';
export type TriggerSource = 'scheduled' | 'manual';

export interface Job {
  id: string;
  userId: string;
  accountConfigId: string;
  triggerSource: TriggerSource;
  refreshDays: number;
  status: JobStatus;
  systemMessage: string | null;
  queuedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
}
```

### `types/account-config.ts`

```typescript
import type { Platform } from './platform.ts';

export interface AccountConfig {
  id: string;
  userId: string;
  clientName: string;
  platform: Platform;       // 注意:google 不屬於 AccountConfig,只在 PlatformToken
  accountId: string;
  refreshDays: number;      // 1-365
  sheetId: string | null;
  sheetTab: string | null;
  createdAt: Date;
}
```

### `types/adapter.ts`

```typescript
import type { AccountConfig } from './account-config.ts';

export interface RawPlatformRecord {
  postId: string;
  rawData: Record<string, unknown>;
  fetchedAt: Date;
}

export interface PlatformAdapter {
  fetchAccountContent(params: {
    accountConfig: AccountConfig;
    refreshDays: number;
    now: Date;
    accessToken: string; // 解密後的 token
  }): Promise<RawPlatformRecord[]>;
}
```

### `types/normalized.ts`

```typescript
import type { Platform } from './platform.ts';

export type MediaType = 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM' | 'UNKNOWN';

export interface NormalizedRecord {
  id: string;
  userId: string;
  jobId: string | null;
  platform: Platform;
  accountId: string;
  postId: string;
  postTimestamp: Date | null;
  caption: string | null;
  mediaType: MediaType | null;
  likeCount: number;
  commentCount: number;
  viewCount: number;
  shareCount: number;
  extraData: Record<string, unknown>;
  createdAt: Date;
}
```

---

## Supabase SDK 與 Repository 型別約束

Repository 方法**必須**在函式簽名強制 `userId: string`,即使 RLS 已經保證隔離。這是為了讓 TypeScript 編譯期能抓到漏掉 `user_id` 的錯誤。

```typescript
// ✅ 正確:userId 在簽名中
export async function findJobs(userId: string): Promise<Job[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('user_id', userId);
  if (error) throw error;
  return data.map(mapRowToJob);
}

// ❌ 錯誤:沒有 userId 參數,可能誤用 service role 撈出全部資料
export async function findAllJobs(): Promise<Job[]> { /* ... */ }
```

## `tsconfig.json`(後端)建議設定

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noImplicitAny": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## 相關文件

- [Database Schema](database-schema.md)(欄位對應)
- [ADR-003:TypeScript 全面遷移](../adr/ADR-003-typescript-full-migration.md)
