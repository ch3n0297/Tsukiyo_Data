# `.pen` 畫面命名清單與繪製順序

## 1. 文件目的

本文件是給設計稿使用的畫面命名與繪製順序清單。

用途：

- 定義 `.pen` 檔案中每個 top-level frame 建議名稱
- 區分哪些畫面已存在、哪些尚未建立
- 提供推薦繪製順序，避免先畫次要頁面
- 提醒每個畫面應搭配哪些狀態稿

本文件以 [frontend-design-screen-requirements.md](./frontend-design-screen-requirements.md) 為基礎，進一步落成為實際設計工作用的命名表。

角色能力與設定模組拆分，另外參考 [role-capabilities-and-settings-ia.md](./role-capabilities-and-settings-ia.md)。

## 2. 命名原則

### 2.1 建議格式

建議每個 top-level frame 採以下格式之一：

- `模組 / 畫面名稱`
- `模組 / 畫面名稱 / 變體`

### 2.2 命名規則

- 優先使用中文名稱，避免之後設計討論需要來回翻譯
- 同一類頁面用相同前綴，方便在畫布上集中管理
- 若有 light / dark / brand 等變體，放在最後一段
- 若是狀態稿，狀態名稱也放在最後一段

### 2.3 建議模組前綴

- `Auth`
- `Dashboard`
- `Admin`
- `Settings`
- `State`
- `Modal`

## 3. 目前 `.pen` 已存在的畫面

依目前設計檔內容，已存在的 top-level frames 主要包含：

1. `資料中台總覽 / Dark`
2. `資料中台總覽 / Light`
3. `資料中台總覽 / 純總覽`
4. `社群帳號接入與權杖管理`
5. `Auth / 登入`
6. `Auth / 註冊申請`
7. `Auth / 忘記密碼`
8. `Auth / 重設密碼`
9. `Dashboard / 帳號列表`
10. `Dashboard / 帳號詳情`
11. `Dashboard / 同步任務與刷新狀態`
12. `Admin / 待審註冊申請`
13. `Settings / 個人設定`
14. `Admin / 使用者管理`
15. `Settings / 排程與系統設定`

### 3.1 建議保留 / 調整方式

- `資料中台總覽 / Dark`
  - 保留，作為總覽看板的 dark 變體
- `資料中台總覽 / Light`
  - 保留
- `資料中台總覽 / 純總覽`
  - 保留
- `社群帳號接入與權杖管理`
  - 保留，可視為後續 `Settings / 平台授權與帳號接入`
- `Settings / 個人設定`
  - 保留，作為一般帳號與管理員共用的個人偏好頁
- `Admin / 使用者管理`
  - 保留，取代原本語意模糊的 `Settings / 帳號設定管理`
- `Settings / 排程與系統設定`
  - 保留，作為 admin only 的系統設定頁

## 4. 建議 `.pen` 畫面命名清單

以下為建議的正式畫面命名。

### 4.1 第一階段必畫頁面

1. `Auth / 登入`
2. `Auth / 註冊申請`
3. `Auth / 忘記密碼`
4. `Auth / 重設密碼`
5. `Dashboard / 總覽看板 / Dark`
6. `Dashboard / 總覽看板 / Light`
7. `Dashboard / 總覽看板 / 純總覽`
8. `Dashboard / 帳號列表`
9. `Dashboard / 帳號詳情`
10. `Admin / 待審註冊申請`
11. `Dashboard / 同步任務與刷新狀態`

### 4.2 第二階段建議頁面

1. `Settings / 個人設定`
2. `Settings / 平台授權與帳號接入`
3. `Admin / 使用者管理`
4. `Settings / 排程與系統設定`
5. `Modal / 手動刷新`

### 4.3 建議狀態稿命名

若你要把狀態稿也畫成獨立 frame，建議採下面格式：

1. `State / Auth / 登入 / 錯誤`
2. `State / Auth / 註冊申請 / 成功待審核`
3. `State / Auth / 忘記密碼 / 送出成功`
4. `State / Auth / 重設密碼 / 成功`
5. `State / Dashboard / 帳號列表 / 空狀態`
6. `State / Dashboard / 帳號詳情 / 空狀態`
7. `State / Dashboard / 帳號詳情 / 載入中`
8. `State / Dashboard / 同步任務 / 無資料`
9. `State / Dashboard / 同步任務 / 錯誤`
10. `State / Modal / 手動刷新 / 被拒絕`

## 5. 建議繪製順序

以下順序是依需求重要性、資訊架構與頁面共用度排序。

### 第一批：先把身份驗證流程畫齊

1. `Auth / 登入`
2. `Auth / 註冊申請`
3. `Auth / 忘記密碼`
4. `Auth / 重設密碼`

原因：

- 這四頁共用版型與表單元件
- 一次畫完可以先建立 auth 視覺語言
- 後面 admin / dashboard 的 user entry point 也會更明確

### 第二批：補齊主要產品頁

5. `Dashboard / 總覽看板 / Dark`
6. `Dashboard / 總覽看板 / 純總覽`
7. `Dashboard / 帳號列表`
8. `Dashboard / 帳號詳情`
9. `Dashboard / 同步任務與刷新狀態`

原因：

- 這是資料中台的核心操作路徑
- `帳號列表` 與 `帳號詳情` 會共用很多資訊卡、狀態 badge、表格樣式
- `同步任務與刷新狀態` 會補足總覽之外的操作可追蹤性

### 第三批：補 admin 與設定頁

10. `Admin / 待審註冊申請`
11. `Settings / 個人設定`
12. `Settings / 平台授權與帳號接入`
13. `Admin / 使用者管理`
14. `Settings / 排程與系統設定`

原因：

- admin 與 settings 屬於次級但必要模組
- 視覺上可沿用 dashboard shell
- 但 `個人設定`、`使用者管理` 與 `系統設定` 必須分頁，避免把「設定自己」與「管理別人」混在一起

### 第四批：補操作型狀態與 modal

15. `Modal / 手動刷新`
16. `State / ...` 系列狀態稿

原因：

- 這類稿通常依賴前面主頁已定稿
- 若太早畫，容易反覆返工

## 6. 每一頁建議搭配的狀態稿

### 6.1 `Auth / 登入`

至少搭配：

- 正常
- 載入中
- 帳密錯誤
- 帳號待審核
- 帳號停用

### 6.2 `Auth / 註冊申請`

至少搭配：

- 正常
- 驗證錯誤
- email 已存在
- 送出成功 / 待審核

### 6.3 `Auth / 忘記密碼`

至少搭配：

- 正常
- 驗證錯誤
- 送出成功

### 6.4 `Auth / 重設密碼`

至少搭配：

- 正常
- token 無效
- token 過期
- 重設成功

### 6.5 `Dashboard / 總覽看板 / Dark`、`Dashboard / 總覽看板 / Light` 與 `Dashboard / 總覽看板 / 純總覽`

至少搭配：

- 正常
- 載入中
- 系統異常警示
- 無資料

### 6.6 `Dashboard / 帳號列表`

至少搭配：

- 正常
- 空狀態
- 篩選後無結果
- 帳號有錯誤狀態

### 6.7 `Dashboard / 帳號詳情`

至少搭配：

- 正常
- 載入中
- 無法載入
- 最新輸出為空

### 6.8 `Admin / 待審註冊申請`

至少搭配：

- 正常
- 空狀態
- 審核送出中
- 審核成功
- 審核失敗

### 6.9 `Dashboard / 同步任務與刷新狀態`

至少搭配：

- 正常
- 進行中工作
- 錯誤工作
- 無任務資料

## 7. 建議的畫布排法

為了避免 `.pen` 畫布越做越亂，建議按區塊排列：

- 第一列：Dashboard 類頁面
- 第二列：Auth 類頁面
- 第三列：Admin / Settings 類頁面
- 第四列：State / Modal 類頁面

### 7.1 範例排列

第一列：

1. `Dashboard / 總覽看板 / Dark`
2. `Dashboard / 總覽看板 / Light`
3. `Dashboard / 總覽看板 / 純總覽`
4. `Dashboard / 帳號列表`
5. `Dashboard / 帳號詳情`
6. `Dashboard / 同步任務與刷新狀態`

第二列：

1. `Auth / 登入`
2. `Auth / 註冊申請`
3. `Auth / 忘記密碼`
4. `Auth / 重設密碼`

第三列：

1. `Admin / 待審註冊申請`
2. `Settings / 平台授權與帳號接入`
3. `Settings / 帳號設定管理`
4. `Settings / 排程與系統設定`

第四列：

1. `Modal / 手動刷新`
2. `State / Auth / ...`
3. `State / Dashboard / ...`

## 8. 建議先做的下一張畫面

如果你現在要立刻開畫，最建議先做的是：

1. `Auth / 登入`
2. `Dashboard / 帳號列表`
3. `Dashboard / 帳號詳情`

原因：

- 這三張最能把產品主流程接起來
- 登入頁能先定品牌語言
- 帳號列表與帳號詳情能把資料中台的核心內容具體化

## 9. 與現有文件的對應

- 詳細的「每頁該放什麼元素」，看 [frontend-design-screen-requirements.md](./frontend-design-screen-requirements.md)
- 這份文件則負責回答：
  - `.pen` 裡每頁該叫什麼名字
  - 先畫哪一頁
  - 每頁至少要補哪些狀態稿
