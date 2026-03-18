# Quickstart: 社群行銷資料中台

## Prerequisites

- Node.js 24+
- npm 11+

## 1. 啟動服務

```bash
npm install
npm run build
export API_SHARED_SECRET=local-dev-secret
npm start
```

預設會：

- 在 `data/` 建立檔案式資料庫
- 在 `fixtures/platforms/` 讀取三個平台的示範原始資料
- 啟動 HTTP server 與排程器
- 由 Node server 直接提供 `frontend/dist/` 內的 React + Vite build 產物
- 在瀏覽器開啟 `http://localhost:3000/` 可查看唯讀 Dashboard；該介面只使用讀取 API，不會暴露 `API_SHARED_SECRET`

## 1.1 React + Vite 開發模式（選用）

```bash
export API_SHARED_SECRET=local-dev-secret
npm run dev:server
npm run dev:frontend
```

Vite dev server 會將 `/health` 與 `/api` proxy 到目前的 Node server，方便在不暴露任何 shared secret 到瀏覽器端的前提下開發前端。

## 2. 檢查健康狀態

```bash
curl http://localhost:3000/health
```

預期回傳 `200 OK` 與目前 queue/scheduler 狀態。

## 3. 觸發一次排程同步

```bash
curl -X POST http://localhost:3000/api/v1/internal/scheduled-sync \
  -H "content-type: application/json" \
  -H "x-client-id: demo-sheet" \
  -H "x-timestamp: <ISO_TIMESTAMP>" \
  -H "x-signature: <HMAC_SIGNATURE>" \
  -d '{"requested_by":"quickstart"}'
```

預期：

- 服務為所有 active account 建立 `scheduled` jobs
- `data/jobs.json` 出現 `queued` / `running` / `success` 或 `error`
- `data/sheet-status.json` 與 `data/sheet-output.json` 被更新

## 4. 送出單一帳號手動刷新

Request body:

```json
{
  "platform": "instagram",
  "account_id": "acct-instagram-demo",
  "refresh_days": 7,
  "request_source": "apps-script"
}
```

建立簽章方式：

1. 將 request body 序列化為單行 JSON
2. 組合字串：`<timestamp>.<json-body>`
3. 使用 `API_SHARED_SECRET` 做 HMAC SHA256

送出請求：

```bash
curl -X POST http://localhost:3000/api/v1/refresh-jobs/manual \
  -H "content-type: application/json" \
  -H "x-client-id: demo-sheet" \
  -H "x-timestamp: <ISO_TIMESTAMP>" \
  -H "x-signature: <HMAC_SIGNATURE>" \
  -d '{"platform":"instagram","account_id":"acct-instagram-demo","refresh_days":7,"request_source":"apps-script"}'
```

預期：

- 立即回傳 `202 Accepted`
- 帳號狀態先變為 `queued`
- 背景 worker 轉成 `running`
- 完成後回寫 `success` 或 `error`

## 5. 驗證資料輸出

檢查以下檔案：

- `data/raw-platform-records.json`
- `data/normalized-content-records.json`
- `data/jobs.json`
- `data/sheet-status.json`
- `data/sheet-output.json`

## 6. 執行測試

```bash
npm test
```

測試涵蓋：

- 排程同步會保存 raw/normalized data 並同步狀態
- 手動刷新為非同步、可去重複、可限流
- 非法 `refresh_days` 與平台錯誤會回傳可理解訊息
- React build 產物可被 Node server 正確提供，且唯讀 UI API 與受保護寫入端點的安全限制持續有效
