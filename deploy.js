/**
 * 部署工具：建立／驗證「資料試算表」(Script Properties 的 DISPATCH_DATA_SHEET_ID) 所需的工作表。
 *
 * 使用方式（於 GAS 編輯器選取本檔函式手動執行）：
 *   1. 先在「專案設定 > 指令碼屬性」設定 DISPATCH_DATA_SHEET_ID（與 DISPATCH_SOURCE_SHEET_ID、CHRM_MASTER_SHEET_ID 皆不可相同）。
 *   2. 執行 deployAllSheets() 建立／確認以下工作表：
 *        行動駐站、駐站調配、調派紀錄_當年、調派操作紀錄_當年。
 *   3. 若需把舊「來源試算表」的既有資料搬到新資料試算表，執行 code.js 的 migrateDispatchDataToDataSpreadsheet()。
 *   4. 執行 deployVerify() 檢視設定防呆與工作表是否齊備。
 *
 * 註：本檔僅呼叫 code.js 既有的存取層函式（GAS 各 .js 共用全域命名空間），不重複造輪子。
 */

function deployAllSheets() {
  // 驗證資料試算表 ID 設定（空／=cHRM／=來源 任一錯設會 throw，避免誤建到錯誤試算表）。
  getDispatchDataSpreadsheetId_();

  const created = [];

  // 行動駐站（A-G 表頭，凍結首列）。
  getMobileStationSheet_(true);
  created.push(getEnvString_('DISPATCH_MOBILE_STATION_SHEET_NAME', APP_CONFIG.mobileStationSheetName));

  // 駐站調配（資料ID = assignmentKey 的 upsert 表）。
  getStationAllocationSheet_(true);
  created.push(getEnvString_('DISPATCH_STATION_ALLOCATION_SHEET_NAME', APP_CONFIG.stationAllocationSheetName));

  // 當年度的調派紀錄／操作紀錄（隱藏年度 JSON 表；後續年份會在首次寫入時自動建立）。
  const year = Number(getTodayDateString_().slice(0, 4));
  getAnnualJsonStoreSheet_(APP_CONFIG.recordSheetPrefix, year, true);
  created.push(`${APP_CONFIG.recordSheetPrefix}${year}`);
  getAnnualJsonStoreSheet_(APP_CONFIG.auditLogSheetPrefix, year, true);
  created.push(`${APP_CONFIG.auditLogSheetPrefix}${year}`);

  const message = `部署完成，已建立／確認工作表：${created.join('、')}`;
  console.log(message);
  return message;
}

function deployVerify() {
  const lines = [];

  // 1) 設定防呆檢查（兩個試算表 ID）。
  [
    ['DISPATCH_SOURCE_SHEET_ID（唯讀來源）', getDispatchSourceSpreadsheetId_],
    ['DISPATCH_DATA_SHEET_ID（可寫資料）', getDispatchDataSpreadsheetId_]
  ].forEach((guard) => {
    const label = guard[0];
    try {
      guard[1]();
      lines.push(`✓ ${label} 設定通過`);
    } catch (error) {
      lines.push(`✗ ${label}：${error && error.message ? error.message : error}`);
    }
  });

  // 2) 資料試算表內各工作表是否齊備。
  try {
    const spreadsheet = getDispatchDataSpreadsheet_();
    const year = Number(getTodayDateString_().slice(0, 4));
    const expected = [
      getEnvString_('DISPATCH_MOBILE_STATION_SHEET_NAME', APP_CONFIG.mobileStationSheetName),
      getEnvString_('DISPATCH_STATION_ALLOCATION_SHEET_NAME', APP_CONFIG.stationAllocationSheetName),
      `${APP_CONFIG.recordSheetPrefix}${year}`,
      `${APP_CONFIG.auditLogSheetPrefix}${year}`
    ];
    expected.forEach((name) => {
      lines.push(`${spreadsheet.getSheetByName(name) ? '✓' : '✗'} 工作表「${name}」`);
    });
  } catch (error) {
    lines.push(`✗ 開啟資料試算表失敗：${error && error.message ? error.message : error}`);
  }

  const report = lines.join('\n');
  console.log(report);
  return report;
}
