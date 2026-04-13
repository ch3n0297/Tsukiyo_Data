# Handoff
**To:** Git
**From:** Review
**Task:** commit review 修復 + simplify（TypeScript 遷移 code review 結果）
**Context:** 共 5 個修復：(1) AppConfig 重複定義 → types/app.ts 改為 re-export；(2) UserAuthService 5 個 fields → private readonly；(3) 7 個 repos 的 store/collection → private readonly；(4) types/app.ts 的 export 移到 import 之後（風格）；(5) 3 個 services 的 AppConfig import 路徑統一到 ../types/app.ts。tsc 零錯誤，37 後端 + 6 前端測試全通過。
**Status:** pending
