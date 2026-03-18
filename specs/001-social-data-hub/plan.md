# Implementation Plan: 社群行銷資料中台

**Branch**: `001-social-data-hub` | **Date**: 2026-03-18 | **Spec**: [`specs/001-social-data-hub/spec.md`](spec.md)
**Input**: Feature specification from `/specs/001-social-data-hub/spec.md`

## Summary

建立一個以 Node.js 24 為核心的單體內部服務，負責排程抓取、手動刷新、raw data/normalized data 持久化、狀態回寫與請求保護。首版採用標準函式庫與可替換 adapter 設計：平台抓取以 fixture adapter 模擬 Instagram、Facebook、TikTok 的資料來源，Google Sheet 同步以 file-backed gateway 模擬，讓整條資料流、工作佇列、驗證、去重複、限流與狀態管理可以先完整落地並可測試。

## Technical Context

**Language/Version**: Node.js 24, ESM JavaScript  
**Primary Dependencies**: 無外部 runtime dependency，使用 Node 標準函式庫 (`http`, `crypto`, `fs/promises`, `timers`, `node:test`)  
**Storage**: 檔案式 JSON store（`data/` 目錄，原子寫入）  
**Testing**: `node --test`  
**Target Platform**: Linux/macOS server running Node.js 24  
**Project Type**: 單體 web-service + in-process worker  
**Performance Goals**: 有效手動刷新請求應立即回覆 `202 Accepted`；預設最多 3 個並行工作；背景工作完成後立即回寫狀態  
**Constraints**: 不可在 HTTP request thread 直接等待外部抓取完成；同帳號不得有多個 active job；Server 為唯一可信來源；Google Sheet 失敗不可抹除已保存的抓取結果  
**Scale/Scope**: 首版以數十到百級帳號、3 個平台、單一 service instance 為目標

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

目前 `.specify/memory/constitution.md` 仍為模板，沒有已生效的專案原則或 gate 條文，因此本 feature 以 `spec.md` 的功能需求與本次設計文件作為唯一約束來源。Phase 1 設計後重新檢查，仍無額外憲章衝突。

## Project Structure

### Documentation (this feature)

```text
specs/001-social-data-hub/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── api.openapi.yaml
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── adapters/
│   ├── platforms/
│   └── sheets/
├── cli/
├── lib/
├── repositories/
├── routes/
├── services/
├── app.js
├── config.js
└── server.js

fixtures/
└── platforms/

tests/
├── integration/
└── unit/
```

**Structure Decision**: 採單一 Node.js 專案。HTTP API、排程器與 worker 共用同一套服務層與 repository，減少首版協作成本；平台抓取與 Sheet 同步透過 adapter 分層，讓未來可替換成正式 API 整合而不影響核心流程。

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| 無 | N/A | N/A |
