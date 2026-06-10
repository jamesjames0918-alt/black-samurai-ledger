const SHEET_CONFIG_ITEMS = "設定_品項";
const SHEET_RAW = "原始上傳紀錄";
const SHEET_ITEMS = "品項銷售明細";
const SHEET_PAYMENTS = "付款方式明細";
const SHEET_DAILY = "每日總表";
const SHEET_ERRORS = "異常紀錄";

/**
 * GET API
 * ?action=config 取得設定
 * ?action=history 取得歷史
 */
function doGet(e) {
  try {
    const action = e.parameter.action || "";

    if (action === "config") {
      return jsonOutput({
        success: true,
        items: getConfigItems()
      });
    }

    if (action === "history") {
      return jsonOutput({
        success: true,
        history: getHistory()
      });
    }

    return jsonOutput({
      success: true,
      message: "黑武藏營收 API 正常",
      actions: ["config", "history"]
    });

  } catch (err) {
    return jsonOutput({
      success: false,
      error: err.message
    });
  }
}

/**
 * POST API
 * 預設：寫入統計卡資料
 * action=updateConfigItems 更新設定_品項
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000); // 等待最多30秒以獲取鎖定

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const data = JSON.parse(e.postData.contents || "{}");
    const action = data.action || "saveLedger";

    setupAllSheets(ss); // 確保所有工作表存在並設置標頭

    if (action === "updateConfigItems") {
      updateConfigItems(data.items || []);
      return jsonOutput({
        success: true,
        message: "設定_品項已更新"
      });
    }

    return saveLedgerData(data);

  } catch (err) {
    return jsonOutput({
      success: false,
      error: err.message
    });
  } finally {
    lock.releaseLock(); // 釋放鎖定
  }
}

/***********************
 * 核心：寫入統計卡
 ***********************/
function saveLedgerData(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const rawSheet = getSheetOrCreate(ss, SHEET_RAW);
  const itemSheet = getSheetOrCreate(ss, SHEET_ITEMS);
  const paymentSheet = getSheetOrCreate(ss, SHEET_PAYMENTS);
  const dailySheet = getSheetOrCreate(ss, SHEET_DAILY);
  const errorSheet = getSheetOrCreate(ss, SHEET_ERRORS);

  const configItems = getConfigItems();
  const configMap = {};
  configItems.forEach(item => {
    configMap[item.name] = item;
  });

  const now = new Date();
  const date = data.date ? new Date(data.date) : now; // 確保是 Date 物件
  const storeName = data.storeName || "黑武藏";
  const uploadedBy = data.uploadedBy || "";
  const role = data.role || "";
  const rows = data.rows || [];
  const frontendResults = data.frontendResults || {};
  const otherIncomeDetail = data.otherIncomeDetail || "";
  const otherExpenseDetail = data.otherExpenseDetail || "";
  const otherBalance = data.otherBalance || 0;

  // 原始紀錄
  rawSheet.appendRow([
    now,
    date,
    storeName,
    uploadedBy,
    role,
    JSON.stringify(data.rawAiData),
    JSON.stringify(frontendResults),
    otherIncomeDetail,
    otherExpenseDetail,
    otherBalance,
    data.thumb || data.imgSrc || ""
  ]);

  let totalSalesAmount = 0;
  let totalPaymentAmount = 0;
  let hasError = false;

  rows.forEach(r => {
    const itemName = r.item || r.name || "";
    const cfg = configMap[itemName];

    if (!cfg) {
      hasError = true;
      errorSheet.appendRow([
        now,
        date,
        storeName,
        "未設定品項",
        itemName,
        "此品項不存在於設定_品項",
        JSON.stringify(r)
      ]);
      return;
    }

    const type = cfg.type;
    const yesterdayRemain = Number(r.yesterdayRemain || 0);
    const todayStock = Number(r.todayStock || r.amount || 0);
    const todayRemain = Number(r.todayRemain || 0);
    const unitPrice = Number(r.unitPrice || cfg.unitPrice || 0);

    if (type === "庫存") {
      const salesQty = (todayStock || 0) - (todayRemain || 0); // 前端已計算帶貨-退貨
      const salesAmount = salesQty * unitPrice;

      if (salesQty < 0) {
        hasError = true;
        errorSheet.appendRow([
          now,
          date,
          storeName,
          "銷售量異常",
          itemName,
          "系統計算銷售量小於 0",
          JSON.stringify(r)
        ]);
      }

      itemSheet.appendRow([
        now,
        date,
        storeName,
        uploadedBy,
        itemName,
        cfg.category,
        yesterdayRemain,
        todayStock,
        todayRemain,
        salesQty,
        unitPrice,
        salesAmount,
        salesQty < 0 ? "異常" : "正常",
        ""
      ]);

      totalSalesAmount += salesAmount;
    }

    if (type === "收款" || type === "平台" || type === "外送") {
      const amount = Number(todayStock || 0);

      paymentSheet.appendRow([
        now,
        date,
        storeName,
        uploadedBy,
        itemName,
        cfg.category,
        amount
      ]);

      totalPaymentAmount += amount;
    }
  });

  // 每日總表
  dailySheet.appendRow([
    now,
    date,
    storeName,
    uploadedBy,
    frontendResults.salesTotal || 0, // 品項銷售總額
    frontendResults.posTotal || 0, // POS總營收
    frontendResults.actualDiff || 0, // 實收誤差
    frontendResults.cashActual || 0, // 實點現金
    frontendResults.reserveCash || 0, // 留存金
    frontendResults.registerCash || 0, // 錢櫃實點現金
    frontendResults.onlineTotal || 0, // LINEPAY
    (data.rawAiData.platforms.panda || 0) + (data.rawAiData.platforms.uber || 0), // 熊貓外送 + UBER
    frontendResults.otherIncome || 0, // 其他收入
    frontendResults.otherExpenseTotal || 0, // 其他支出
    otherBalance || 0, // 其他收支總計
    frontendResults.ricePremium || 0, // 飯粒溢價
    frontendResults.finalError || 0, // 誤差值(最終)
    hasError ? "有異常" : "正常"
  ]);

  return jsonOutput({
    success: true,
    message: "已成功寫入 Google Sheet",
    hasError,
    totalSalesAmount,
    totalPaymentAmount
  });
}

/***********************
 * 設定_品項
 ***********************/
function getConfigItems() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheetOrCreate(ss, SHEET_CONFIG_ITEMS);

  setupHeaders(sheet, [
    "id",
    "排序",
    "分類",
    "品項名稱",
    "類型",
    "單價",
    "是否啟用"
  ]);

  // 如果是空表，自動建立預設品項
  if (sheet.getLastRow() <= 1) { // 只有標頭行
    sheet.getRange(2, 1, 8, 7).setValues([
      ["item_001", 1, "主食", "飯粒", "庫存", 10, true],
      ["item_002", 2, "主食", "花壽司", "庫存", 65, true],
      ["item_003", 3, "小品", "茶碗蒸", "庫存", 45, true],
      ["item_004", 4, "小品", "味噌湯", "庫存", 35, true],
      ["item_005", 5, "耗材", "盒裝", "庫存", 10, true],
      ["item_006", 6, "外送", "熊貓", "平台", 0, true],
      ["item_007", 7, "外送", "Uber", "平台", 0, true],
      ["item_008", 8, "線上收款", "LINE PAY", "收款", 0, true]
    ]);
  }

  const values = sheet.getDataRange().getValues();

  if (values.length <= 1) {
    return [];
  }

  values.shift(); // 移除標頭

  return values
    .filter(row => String(row[0] || "").trim() !== "") // 過濾掉空行
    .map(row => ({
      id: String(row[0]),
      sort: Number(row[1] || 0),
      category: String(row[2] || ""),
      name: String(row[3] || ""),
      type: String(row[4] || ""),
      unitPrice: Number(row[5] || 0),
      enabled: row[6] === true || String(row[6]).toUpperCase() === "TRUE"
    }))
    .filter(item => item.enabled) // 只返回啟用的品項
    .sort((a, b) => a.sort - b.sort); // 依排序欄位排序
}

function updateConfigItems(items) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheetOrCreate(ss, SHEET_CONFIG_ITEMS);

  sheet.clear(); // 清空現有數據

  const headers = [
    "id",
    "排序",
    "分類",
    "品項名稱",
    "類型",
    "單價",
    "是否啟用"
  ];

  sheet.appendRow(headers);

  items.forEach((item, index) => {
    sheet.appendRow([
      item.id || "item_" + String(index + 1).padStart(3, "0"),
      item.sort || index + 1,
      item.category || "",
      item.name || item["品項名稱"] || "",
      item.type || item["類型"] || "庫存",
      Number(item.unitPrice || item["單價"] || 0),
      item.enabled !== false
    ]);
  });
}

/***********************
 * 歷史紀錄
 ***********************/
function getHistory() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheetOrCreate(ss, SHEET_RAW);

  setupHeaders(sheet, [
    "建立時間",
    "日期",
    "店別",
    "上傳者",
    "角色",
    "原始JSON",
    "前端計算結果JSON",
    "其他收入細項",
    "其他支出細項",
    "其他收支總計",
    "圖片縮圖"
  ]);

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();

  return values.map(row => ({
    createdAt: row[0],
    date: row[1],
    storeName: row[2],
    uploadedBy: row[3],
    role: row[4],
    rawAiData: row[5],
    frontendResults: row[6],
    otherIncomeDetail: row[7],
    otherExpenseDetail: row[8],
    otherBalance: row[9],
    thumb: row[10]
  })).reverse();
}

/***********************
 * 建立工作表與表頭
 ***********************/
function setupAllSheets(ss) {
  setupHeaders(getSheetOrCreate(ss, SHEET_CONFIG_ITEMS), [
    "id",
    "排序",
    "分類",
    "品項名稱",
    "類型",
    "單價",
    "是否啟用"
  ]);

  setupHeaders(getSheetOrCreate(ss, SHEET_RAW), [
    "建立時間",
    "日期",
    "店別",
    "上傳者",
    "角色",
    "原始JSON",
    "前端計算結果JSON",
    "其他收入細項",
    "其他支出細項",
    "其他收支總計",
    "圖片縮圖"
  ]);

  setupHeaders(getSheetOrCreate(ss, SHEET_ITEMS), [
    "建立時間",
    "日期",
    "店別",
    "上傳者",
    "品項",
    "分類",
    "昨日餘量",
    "今日帶貨",
    "今日餘量",
    "系統計算銷售",
    "單價",
    "銷售額",
    "狀態",
    "備註"
  ]);

  setupHeaders(getSheetOrCreate(ss, SHEET_PAYMENTS), [
    "建立時間",
    "日期",
    "店別",
    "上傳者",
    "付款方式",
    "分類",
    "金額"
  ]);

  setupHeaders(getSheetOrCreate(ss, SHEET_DAILY), [
    "建立時間",
    "日期",
    "店別",
    "上傳者",
    "品項銷售總額",
    "POS總營收",
    "實收誤差",
    "實點現金",
    "留存金",
    "錢櫃實點現金",
    "LINEPAY",
    "平台總額", // 熊貓外送 + UBER
    "其他收入",
    "其他支出",
    "其他收支總計",
    "飯粒溢價",
    "誤差值(最終)",
    "狀態"
  ]);

  setupHeaders(getSheetOrCreate(ss, SHEET_ERRORS), [
    "建立時間",
    "日期",
    "店別",
    "上傳者",
    "異常類型",
    "品項",
    "錯誤內容",
    "原始資料"
  ]);

  // 如果設定_品項為空，則填入預設品項
  const configSheet = ss.getSheetByName(SHEET_CONFIG_ITEMS);
  if (configSheet && configSheet.getLastRow() <= 1) { // 只有標頭行
    configSheet.getRange(2, 1, 8, 7).setValues([
      ["item_001", 1, "主食", "飯粒", "庫存", 10, true],
      ["item_002", 2, "主食", "花壽司", "庫存", 65, true],
      ["item_003", 3, "小品", "茶碗蒸", "庫存", 45, true],
      ["item_004", 4, "小品", "味噌湯", "庫存", 35, true],
      ["item_005", 5, "耗材", "盒裝", "庫存", 10, true],
      ["item_006", 6, "外送", "熊貓", "平台", 0, true],
      ["item_007", 7, "外送", "Uber", "平台", 0, true],
      ["item_008", 8, "線上收款", "LINE PAY", "收款", 0, true]
    ]);
  }
}

function getSheetOrCreate(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

function setupHeaders(sheet, headers) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    return;
  }

  const current = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const isEmpty = current.every(v => v === "");

  if (isEmpty || current.length < headers.length) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
}

/***********************
 * 回傳 JSON
 ***********************/
function jsonOutput(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/***********************
 * 測試用
 ***********************/
function testConfig() {
  Logger.log(JSON.stringify(getConfigItems(), null, 2));
}

function testSaveLedger() {
  const testData = {
    action: "saveLedger",
    date: "2026-06-10",
    storeName: "中正店",
    uploadedBy: "test_admin",
    rawAiData: {
      date: "2026/06/10",
      storeName: "中正店",
      items: {
        "飯粒": { stock: 100, return: 5 },
        "花壽司": { stock: 50, return: 2 },
        "盒裝": { stock: 10, return: 0 },
        "熊貓": { stock: 150, return: 0 },
        "Uber": { stock: 80, return: 0 },
        "LINE PAY": { stock: 200, return: 0 }
      },
      finance: {
        pos_total_revenue: 1500,
        cash_actual: 1000,
        other_income: 50,
        other_expense: 20
      },
      platforms: {
        linepay: 200,
        panda: 150,
        uber: 80
      }
    },
    frontendResults: {
      itemDetails: [
        { name: "飯粒", qty: 95, amount: 950 },
        { name: "花壽司", qty: 48, amount: 3120 }
      ],
      salesTotal: 4070,
      posTotal: 1500,
      cashActual: 1000,
      onlineTotal: 200,
      platformTotal: 230,
      actualDiff: -2570,
      ricePremium: 475,
      finalError: -3015,
      otherIncome: 50,
      otherExpenseTotal: 20,
      registerCash: -4000,
      reserveCash: 5000
    },
    otherIncomeDetail: "飲料:50",
    otherExpenseDetail: "水電:20",
    otherBalance: 30,
    thumb: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
  };

  const result = saveLedgerData(testData);
  Logger.log(JSON.stringify(result, null, 2));
}
