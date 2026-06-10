# twCohort 維護與容量說明

最後更新：2026-06-10

正式網站：
https://script.google.com/a/macros/as.edu.tw/s/AKfycbyBiQQL-uBnRBP2MTjQv_abXGFNzXy0gwPSADycrl3rxQnSJDMsnDsL88R66YBmzLM/exec

Apps Script 專案：
`1tOLzeYuX_vEsXQQ3e1jrdSmn8v0cSVv3LXMMDrjbSz8pcHbdzOUGtz0J`

正式資料來源試算表：
`19AwtKReyzq4ELYd9DUuTGmCGpxSidrB-SxD1aBTUH2w`

## 登入與身份資料

目前後端功能修改不會影響使用者的 Google 登入資料。系統不儲存密碼、OAuth token 或瀏覽器登入 session。

目前身份來源：

- `appsscript.json` 設定 `webapp.executeAs = USER_DEPLOYING`、`access = DOMAIN`。
- 後端用 `Session.getActiveUser().getEmail()` 取得目前登入者 email。
- 若取不到 email，後端會直接拒絕讀取與寫入。
- 系統只會把使用者 email 作為權限判斷、調派紀錄 `createdBy` / `updatedBy`、操作紀錄 `operatorEmail`。

會影響登入或身份判斷的變更：

- 修改 `appsscript.json` 的 `webapp.executeAs` 或 `access`。
- 修改 Apps Script 部署的擁有者、網域存取設定或 OAuth scopes。
- 修改 `getCurrentUserEmail()`、`getDispatchAppData()` 或身份失敗處理邏輯。
- 移除 `userinfo.email` scope。

一般後端業務功能修改，例如調派驗證、月曆顯示、年度統計、操作 log，不會改變 Google 帳號登入狀態。

## 主要資料位置

正式來源資料：

- `人員主檔`
- `人員職務配置`
- `組織架構樹`
- 來源由 `ENV.DISPATCH_SOURCE_SHEET_ID` 指向。

正式調派資料：

- `調派紀錄_YYYY`
- `調派操作紀錄_YYYY`

測試模式資料：

- `測試調派紀錄_YYYY`
- `測試調派操作紀錄_YYYY`
- 測試模式另有測試駐站與隱藏駐站設定，仍放在 Script Properties。

年度資料表會由程式自動建立並隱藏。第一次讀取舊資料時，系統會把舊 Script Properties 內的調派紀錄與操作 log 搬到年度資料表，完成後清掉舊 key 以釋放 Script Properties 容量。

## 年度打包規則

統計與匯出固定使用年度區間：

- 起日：`YYYY-01-01`
- 迄日：`YYYY-12-31`

每年會寫入自己的年度資料表。跨年度任務以任務起日年度歸檔；操作 log 以操作日期年度歸檔。

年度 Excel 匯出內容包含：

- 年度臨時徵調統計摘要
- 各駐站臨時徵調人天
- 護理師個人徵調次數
- 調派操作紀錄

## 維護工作流程

每次修改前：

```bash
git pull --ff-only
git status --short --branch
```

修改後至少檢查：

```bash
node --check code.js
git diff --check
git status --short --branch
```

部署到 Apps Script：

```bash
clasp push
clasp version "說明本次修改"
clasp redeploy AKfycbyBiQQL-uBnRBP2MTjQv_abXGFNzXy0gwPSADycrl3rxQnSJDMsnDsL88R66YBmzLM --versionNumber <版本號> --description "說明本次修改"
```

部署後確認：

```bash
clasp deployments --json
git status --short --branch
```

最後同步 GitHub：

```bash
git add <修改檔案>
git commit -m "短句描述"
git push
```

## 上線檢查清單

上線後至少測：

- 一般使用者可以載入網站並顯示登入 email。
- 駐站管理員可以看到目標駐站與可調派護理師。
- 新增、修改、刪除調派後，月曆與年度統計能刷新。
- 測試模式不寫入正式年度資料表。
- 年度統計查詢與 Excel 匯出可正常產生。
- 官方假日資料仍能顯示；若官方尚未提供年度資料，UI 應顯示明確提示。
- 若第一次遷移舊資料，確認年度資料表有建立，且舊資料仍能在月曆與統計中查到。

## 並發與寫入安全

所有調派寫入入口都應保留：

- `LockService.getScriptLock()`
- `APP_CONFIG.writeLockWaitMs = 30000`
- record version 檢查
- 重疊調派檢查
- 30 天臨時調派冷卻檢查
- audit log 寫入

目前寫入是「單一 script lock 序列化」。多位管理員可以同時開頁面查詢，但同時寫入時會排隊；若 30 秒內拿不到 lock，系統會提示稍後再試，避免互相覆蓋。

## 容量與性能上限

程式內部年度保護值：

- 每年調派紀錄上限：`APP_CONFIG.maxDispatchRecordsPerYear = 10000`
- 每年操作紀錄上限：`APP_CONFIG.maxDispatchAuditLogsPerYear = 30000`

實務建議值：

- 建議每年調派紀錄低於 5000 筆。
- 建議每年操作紀錄低於 15000 筆。
- 超過此量仍可運作，但年度統計、首次載入與寫入後刷新會逐漸變慢。

目前資料表容量估算：

- 一個正式年度滿載約 40000 列、4 欄，約 160000 cells。
- 若測試模式也滿載，正式加測試約 320000 cells / 年。
- Google Sheets 官方上限為每份試算表 1000 萬 cells，因此年度分表後，容量瓶頸主要會先出現在 Apps Script 執行時間與 SpreadsheetApp 讀寫速度，而不是 cells 數。

Apps Script 官方限制中，和本系統最相關的是：

- 單次執行時間：6 分鐘。
- 同一使用者同時執行：30。
- 同一 script 同時執行：1000。
- Workspace 帳號 Properties 讀寫：500000 次 / 日。
- Workspace 帳號 URL Fetch：100000 次 / 日。
- Script Properties 單值 9 KB、總容量 500 KB。
- Script 版本上限：200。

官方文件：

- Apps Script quotas: https://developers.google.com/apps-script/guides/services/quotas
- Google Sheets file limits: https://support.google.com/drive/answer/37603

## 已知性能風險

目前 `getStoredDispatchRecords_()` 會讀取所有年度調派資料表後再依日期過濾。年度分表已解決 Script Properties 容量問題，但如果累積多年且每年都接近上限，日曆載入與統計會變慢。

建議後續優化：

- 改成依查詢日期只讀必要年度。
- 年度結案後，把不常查詢的歷史年度匯出封存。
- 若資料量超過每年 10000 筆調派或需要多年高頻查詢，改用 BigQuery、Firestore 或專用資料庫。

## 回復與風險處理

回復程式：

- 可用 `clasp deployments --json` 查目前 deployment。
- 可用 `clasp redeploy <deploymentId> --versionNumber <舊版號>` 回復程式版本。

注意：

- 回復程式不會自動回復 Google Sheet 資料。
- 年度資料表建立或資料遷移後，不要直接刪除隱藏年度分頁。
- 大改資料結構前，先複製正式資料來源試算表備份。

## 維護原則

- 不在前端硬寫正式資料 ID 或權限規則。
- 權限判斷必須留在後端，前端隱藏按鈕不等於授權。
- 測試模式與正式資料必須分流。
- 修改 OAuth scopes、部署設定、資料表欄位名稱、年度儲存格式時，必須在 PR 或 commit 說明中標明。
