本作業旨在訓練你：
將「複雜系統需求」轉換為 高品質 Prompt 設計


使用 Roo Code 的 Orchestration 模式，讓 AI 能拆解任務、自主規劃、跨多步完成專案


學習如何與 AI 進行「工程級協作（AI as Engineer）」而不是單次問答


理解 AI coding agent 的能力邊界與 prompt 設計對結果品質的決定性影響



🧩 專案要求（你要做什麼應用都可以）
你可以自由選擇應用主題，例如（僅供參考）：
AI 輔助醫療監控系統


多 Agent 任務分派平台


具備資料蒐集、清洗、推論、API、前端的完整服務


結合資料庫、背景任務、排程、監控、權限管理的系統


具備 Plugin / MCP / Tooling 整合的工程型專案


👉 限制條件：
專案必須複雜到「合理地需要 Orchestration 模式」，
 若單一 Prompt 就能完成，視為不及格。

🚫 禁止事項（重要）
你 不得：
❌ 自己撰寫任何程式碼


❌ 手動修改 Roo Code 產生的程式碼


❌ 使用 IDE 內建的 autocomplete 來補程式


❌ 用 ChatGPT 直接產生最終程式碼貼進專案


你 只能做的事情：
✅ 設計 Prompt


✅ 指示 Roo Code 使用 Orchestration / Agent / Tool 模式


✅ 觀察、修正 Prompt、調整任務切分方式


✅ Review Roo Code 的 commit 與變更方向（但不可改 code）



📁 必須產出的檔案
1️⃣ DESIGN.md（系統設計文件）
你必須在專案根目錄提供：
DESIGN.md
內容必須包含：
系統目標與使用情境


功能模組切分（例如：API / Backend / Scheduler / UI / Data Pipeline / Agent）


Orchestration 角色設計（例如：Planner / Coder / Reviewer / Tool Runner）


資料流、控制流（可以用文字或簡圖描述）


你預期 Roo Code 要如何拆解任務與協作


為什麼這個系統「合理需要 orchestration 模式」
這個檔案不一定要使用 roo code 產生，可以用手寫或是用 chatgpt 討論完成都可以。


📌 評分會檢查：
這個系統是不是「真的複雜到不能單步完成」

2️⃣ PROMPT.md（Prompt 設計與成效報告）
你必須在專案完成後提供：
PROMPT.md
內容需包含：
✅ 你使用過的關鍵 Prompt（節錄）
請列出你實際下給 Roo Code 的重要 Prompt（可整理後貼上），例如：
初始系統啟動 Prompt


Orchestration 規劃 Prompt


要 Roo Code 拆模組的 Prompt


要 Roo Code 自主檢查、Refactor、測試的 Prompt


用來修正方向或錯誤的 Prompt


✅ Prompt 設計分析
逐條說明：
這個 Prompt 的目的


你預期 Roo Code 會怎麼做


Roo Code 實際怎麼回應


Prompt 是否需要修正？為什麼？


✅ 成效評估
說明：
哪些 Prompt 明顯提升了品質？


哪些 Prompt 失敗或導致 Roo Code 走偏？


Orchestration 是否真的有幫助？


如果不用 Orchestration，會卡在哪？



🤖 Orchestration 模式強制要求
你的 Prompt 設計中 必須明確包含：
讓 Roo Code：


拆子任務


安排執行順序


自行規劃工具使用


進行中間檢查與修正


不能只叫它「寫一個專案」


你可以將 roo code 的對話記錄匯出後請 AI 幫忙整理。然後再修改最後的結果。
📌 評分會檢查：
Roo Code 是否真的進行了多階段規劃 + 多步實作
 而不是一次性產生整包程式碼

🧪 評分方式（由 AI 評分）
評分項目
比例
專案複雜度是否合理需要 Orchestration
30%
Prompt 設計是否合理、具工程思維
25%
Orchestration 使用深度
20%
PROMPT.md 分析品質
15%
Commit 訊息是否符合 AI 生成特徵
10%


🧠 Commit 訊息分析（防作弊）
評分時會分析：
commit 訊息風格是否高度一致


是否呈現 AI agent 常見 commit 風格（描述性、模組導向）


是否有「人為補寫」的跡象


是否存在「明顯人類情緒化 commit」


📌 這是刻意設計的反作弊機制
你如果偷偷自己改 code，commit 風格會破功 😏

🎓 加分方向（非必要）
Roo Code 能自主提出重構建議


Roo Code 能產生測試


Roo Code 能自己發現設計問題並修正


Roo Code 有使用工具（例如讀檔、掃 repo、執行指令）



🧭 建議你第一個 Prompt 可包含（提示方向，不是標準答案）
你可以在專案一開始對 Roo Code 下這類型的提示詞：
要求它擔任「系統架構師 + 專案經理 + 開發團隊」


要求它先提出執行計畫再開始寫


要求它在每個階段完成後做自我審查


要求它用 Orchestration 模式拆角色與任務



🏁 交付物清單
請繳交二個 github repository 也括：
第一個是直接用 roo code 
✅ 專案原始碼（全部由 Roo Code 產生）


✅ DESIGN.md


✅ PROMPT.md


✅ Git commit 歷史（不可 squash）


第二個是使用 speckit 
✅ 專案原始碼（全部由 Roo Code/speckit 產生）


✅ Git commit 歷史（不可 squash）
