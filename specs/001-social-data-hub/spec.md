# Feature Specification: 社群行銷資料中台

**Feature Branch**: `001-social-data-hub`  
**Created**: 2026-03-17  
**Status**: Draft  
**Input**: User description: "建立一個以 Server 為唯一可信核心的內部社群行銷資料中台，定時抓取 Instagram、Facebook、TikTok 等平台資料，保留 raw data、產出 normalized data、同步可讀結果到 Google Sheet，並支援從 Google Sheet 對單一帳號送出非同步手動刷新請求，具備驗證、去重複、限流與狀態回寫。"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 排程同步與統一報表 (Priority: P1)

作為內部營運或分析人員，我需要系統定期抓取多個社群平台的帳號資料，整理成一致格式並同步到 Google Sheet，這樣我可以在熟悉的介面查看最新結果，而不必直接接觸原始 API 回應或依賴 Google Sheet 當主資料源。

**Why this priority**: 這是整個資料中台存在的核心價值。若沒有穩定的排程抓取與統一輸出，手動刷新與狀態管理都沒有實際業務意義。

**Independent Test**: 建立至少一組有效的平台帳號設定並執行一次排程同步，確認系統能取得資料、保留原始紀錄、產出統一格式結果，且 Google Sheet 可查看更新後資料。

**Acceptance Scenarios**:

1. **Given** 已設定可用的平台帳號與排程，**When** 排程到達並啟動同步，**Then** 系統會抓取各帳號資料、保存原始資料、產生標準化結果，並將可讀輸出同步到指定 Google Sheet。
2. **Given** 同一次排程中部分帳號來源正常、部分帳號來源失敗，**When** 排程結束，**Then** 成功帳號的資料仍可更新，失敗帳號會保留失敗狀態與可理解訊息，而不會讓整批結果全部失效。

---

### User Story 2 - 單一帳號手動刷新 (Priority: P2)

作為在 Google Sheet 操作的內部使用者，我需要針對單一帳號送出手動刷新，讓我在固定排程之外，能快速補抓該帳號最近 N 天的內容與數據變化。

**Why this priority**: 固定排程能覆蓋日常更新，但業務場景常需要臨時補抓近期資料。若無法手動刷新，使用者仍會回到人工流程。

**Independent Test**: 在 Google Sheet 選定一列有效帳號設定並觸發刷新，確認系統會快速回覆已受理、建立背景工作，並在完成後回寫最終狀態與結果。

**Acceptance Scenarios**:

1. **Given** 某帳號列具有有效的 `platform`、`account_id` 與 `refresh_days`，且目前沒有進行中的工作，**When** 使用者從 Google Sheet 送出刷新，**Then** 系統會接受請求、建立單一帳號背景工作，並立即顯示 `queued` 狀態與受理訊息。
2. **Given** 某帳號的手動刷新工作已完成，**When** 使用者重新查看該列，**Then** Google Sheet 會顯示最新的 `success` 或 `error` 狀態、最近成功時間與對應的系統訊息。

---

### User Story 3 - 請求保護與狀態可視化 (Priority: P3)

作為系統管理者與操作人員，我需要刷新請求具備驗證、去重複、限流與清楚狀態，這樣系統才能在使用者重複操作、參數錯誤或外部 API 不穩定時仍維持可控。

**Why this priority**: 沒有保護機制時，Google Sheet 會變成任意送出請求的入口，容易造成重複抓取、資源浪費與錯誤難以追蹤。

**Independent Test**: 針對同一帳號送出重複刷新、提交非法 `refresh_days`、模擬來源 API 失敗，確認系統能拒絕不合法請求、避免重複 active job，並在 Google Sheet 呈現明確狀態訊息。

**Acceptance Scenarios**:

1. **Given** 使用者送出的 `refresh_days` 非整數或超出 1 至 365 範圍，**When** 系統收到刷新請求，**Then** 請求不會建立工作，且 Google Sheet 會顯示明確錯誤訊息。
2. **Given** 同一帳號已有 `queued` 或 `running` 的工作，**When** 使用者再次提交刷新請求，**Then** 系統不會建立第二個 active job，並會回傳目前狀態或拒絕原因。
3. **Given** 平台 token 過期或外部 API 暫時不可用，**When** 背景工作執行刷新，**Then** 系統會將工作標記為 `error`，保留可理解的失敗訊息，且不要求 Google Sheet 同步等待外部 API 完成。

### Edge Cases

- `refresh_days` 等於 1 或 365 時必須視為有效值；0、366、空值、小數與文字必須被拒絕。
- 同一帳號在排程同步期間又收到手動刷新時，系統必須避免產生兩個同時執行中的 active job。
- 外部平台回應過慢、逾時或暫時限流時，手動刷新請求仍應先完成受理流程，最後以背景工作結果更新狀態。
- 帳號設定列缺少 `platform`、`account_id` 或目的工作表資訊時，不得建立刷新工作，且要顯示易理解的錯誤原因。
- 來源平台資料抓取成功但同步到 Google Sheet 失敗時，系統必須保留已抓取結果與同步失敗狀態，方便後續補寫或重試。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系統 MUST 將 Server 管理的資料儲存與工作紀錄視為唯一可信來源；Google Sheet 僅作為操作介面與展示介面。
- **FR-002**: 系統 MUST 支援對已設定帳號進行固定排程抓取，涵蓋初始支援的平台: Instagram、Facebook、TikTok。
- **FR-003**: 系統 MUST 保存各平台抓取回來的 raw data，以供除錯、回查與後續重處理。
- **FR-004**: 系統 MUST 將不同平台資料轉換為一致的 normalized data，讓內部人員可在單一報表脈絡下比較與查看。
- **FR-005**: 系統 MUST 將整理後的可讀結果同步到指定的 Google Sheet，而不要求使用者直接查看 raw data。
- **FR-006**: 使用者 MUST 能從 Google Sheet 針對單一帳號送出手動刷新請求。
- **FR-007**: 手動刷新 MUST 以帳號層級的 `refresh_days` 作為抓取範圍，且允許值僅限 1 至 365 的整數。
- **FR-008**: 系統 MUST 不支援在手動刷新中由使用者輸入任意 `start_date` / `end_date` 或指定單一內容項目作為刷新範圍。
- **FR-009**: 手動刷新 MUST 採非同步處理，請求受理與實際抓取執行必須分成兩個階段。
- **FR-010**: 對於有效的手動刷新請求，系統 MUST 在不等待外部平台 API 完成的前提下，快速回覆已受理結果並顯示 `queued` 狀態。
- **FR-011**: 系統 MUST 提供至少 `queued`、`running`、`success`、`error` 四種刷新狀態，並附帶使用者可理解的 `system_message`。
- **FR-012**: 系統 MUST 在 Server 端驗證所有刷新請求，即使 Google Sheet 與 Apps Script 已做過前置驗證。
- **FR-013**: 系統 MUST 驗證來自 Apps Script 或其他允許來源的請求身分，例如透過 API key、timestamp、signature 或同等級機制。
- **FR-014**: 系統 MUST 確保同一帳號在任何時間點最多只有一個處於 `queued` 或 `running` 的 active job。
- **FR-015**: 系統 MUST 對刷新請求實施限流規則，至少涵蓋同一帳號重複刷新限制、單一請求來源的請求頻率限制，以及系統整體可同時執行的工作上限。
- **FR-016**: 系統 MUST 在工作完成後將最終狀態、最近成功時間、目前工作識別與相關訊息回寫到 Google Sheet。
- **FR-017**: 系統 MUST 記錄工作從提交、排入佇列、開始執行到完成或失敗的時間點與結果摘要，以支援追蹤與稽核。
- **FR-018**: 系統 MUST 讓排程同步與手動刷新共用一致的資料整理與輸出規則，避免同一帳號在不同觸發方式下產出不一致結果。
- **FR-019**: 系統 MUST 將 token 管理、核心 API 呼叫、資料標準化、商業邏輯運算與工作控制保留在 Server，不可依賴 Google Sheet 或 Apps Script 作為最終執行核心。
- **FR-020**: 系統 MUST 在單一帳號或單一平台失敗時隔離影響範圍，不得因個別失敗導致其他已成功的帳號結果一併失效。

### Key Entities *(include if feature involves data)*

- **Account Configuration**: 定義一個可被排程或手動刷新的帳號設定，包含 `client_name`、`platform`、`account_id`、`refresh_days`、目的工作表資訊，以及顯示給使用者的狀態欄位。
- **Refresh Job**: 代表一次排程同步中的帳號工作或一次手動刷新請求，包含觸發來源、目標帳號、刷新範圍、生命週期狀態、時間戳記與結果摘要。
- **Raw Platform Record**: 保存平台原始回應的資料實體，用於問題追蹤、重算與驗證資料來源。
- **Normalized Content Record**: 以統一欄位表示的內容資料實體，用來支援跨平台報表、彙整與 Google Sheet 輸出。
- **Sheet Status Snapshot**: 反映在 Google Sheet 某一列上的最新操作狀態，例如 `refresh_status`、`system_message`、`last_request_time`、`last_success_time`、`current_job_id`。
- **Platform Authorization**: 由 Server 管理的平台授權或 token 資訊，供受控抓取流程使用，不直接暴露在 Google Sheet。

### Assumptions

- 本系統是內部使用的資料中台，手動刷新權限僅開放給被允許的內部操作角色，而非公開給終端客戶任意呼叫。
- Google Sheet 的一列對應一個可刷新的平台帳號設定。
- 首波支援平台以 Instagram、Facebook、TikTok 為主，後續可延用相同資料流與狀態模型擴充其他平台。
- Google Sheet 顯示的是整理後、適合閱讀與協作的輸出資料，不承擔 raw data 主儲存職責。
- raw data 保留期限、標準化欄位完整字典與實際同步排程頻率將在後續設計階段細化，不影響本功能的需求邊界。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 內部團隊可透過同一份 Google Sheet 檢視至少 3 個支援平台的整理後資料，而不需要額外查看 raw data 才能完成日常檢查。
- **SC-002**: 95% 的有效單一帳號手動刷新請求，會在提交後 1 分鐘內於 Google Sheet 顯示初始狀態與系統訊息。
- **SC-003**: 在外部平台 API 正常可用的情況下，90% 的有效單一帳號手動刷新請求會在 10 分鐘內於 Google Sheet 顯示最終 `success` 或 `error` 結果。
- **SC-004**: 100% 的非法刷新請求會在未建立 active job 的情況下被拒絕，並向操作人員顯示可理解的錯誤原因。
- **SC-005**: 同一帳號同時存在多個 `queued` 或 `running` 工作的事件數必須維持為 0。
- **SC-006**: 對於成功完成的排程同步，100% 的目標帳號都能在同一輪流程中產出對應的狀態結果，包含成功或失敗原因，不允許出現無狀態可追蹤的帳號。
