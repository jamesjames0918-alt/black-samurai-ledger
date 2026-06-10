/**
 * 黑武藏統計卡帳本 V3.0 - Vercel API (submit.js)
 * 負責接收前端提交的數據，進行格式化，並發送至 Google Apps Script 進行儲存。
 * 
 * 核心功能：
 * - 根據前端傳遞的 `config` 動態構建發送給 Apps Script 的 `rows` 數據。
 * - 處理其他收入/支出細項的格式化與總計。
 * - 將所有數據打包成 JSON 格式，透過 POST 請求發送給 Apps Script。
 */

export default async function handler(req, res) {
  try {
    const { config, data, results, editor, date, storeName, otherIncomeItems, otherExpenseItems } = req.body || {};
    
    // 確保 GOOGLE_SHEET_API_URL 與前端 App.jsx 保持一致
    const GOOGLE_SHEET_API_URL = process.env.GOOGLE_SHEET_API_URL || 'https://script.google.com/macros/s/AKfycbxpRCTtrtS30vPP8PwU7eELC17X9QUnYd9RiH_tJ5faOxjnsG7RttbAsCSDEbSnpCP7/exec';

    if (!config || !Array.isArray(config ) || config.length === 0) {
      return res.status(400).json({ success: false, error: 'Configuration (config) is missing or empty.' });
    }
    if (!data || !data.items) {
      return res.status(400).json({ success: false, error: 'Missing data or data.items for submission.' });
    }

    // 合併項目文字：項目1:100 | 項目2:200
    const formatItems = (items) => (items || [])
      .filter(item => item.note || (Number(item.amount) || 0) > 0) // 過濾掉空備註且金額為0的項目
      .map(item => `${item.note || 'Unnamed'}:${Number(item.amount) || 0}`)
      .join(' | ');

    // 計算其他收支總計
    const otherIncomeTotal = (otherIncomeItems || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const otherExpenseTotal = (otherExpenseItems || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const otherBalance = otherIncomeTotal - otherExpenseTotal;

    const payload = {
      action: 'saveLedger', // 指定 Apps Script 的 action 為 saveLedger
      date, 
      storeName, 
      uploadedBy: editor, 
      role: 'staff', // 暫時寫死為 staff，後續可從前端傳遞
      rows: [], // 將前端計算的品項數據轉換為 Apps Script 期望的 rows 格式
      thumb: data.thumb || data.imgSrc || "", // 圖片縮圖
      rawAiData: data, // 原始 AI 辨識結果
      frontendResults: results, // 前端計算結果
      otherIncomeDetail: formatItems(otherIncomeItems),
      otherExpenseDetail: formatItems(otherExpenseItems),
      otherBalance,
      config // 傳遞 config 到 Apps Script (Apps Script 會用它來驗證品項)
    };

    // 根據 config 動態構建 payload.rows
    if (data && data.items && config) {
      config.forEach(cfgItem => {
        if (cfgItem.enabled && data.items[cfgItem.name]) { // 只處理啟用的品項
          const itemData = data.items[cfgItem.name];
          const row = {
            item: cfgItem.name,
            type: cfgItem.type,
            unitPrice: cfgItem.unitPrice,
            yesterdayRemain: itemData.yesterdayRemain || 0, // 預設為0，如果需要可從歷史數據載入
          };

          if (cfgItem.type === "stock") {
            row.todayStock = itemData.stock || 0;
            row.todayRemain = itemData.return || 0;
          } else if (cfgItem.type === "payment" || cfgItem.type === "platform" || cfgItem.type === "delivery") {
            row.todayStock = itemData.stock || 0; // 對於收款/平台/外送，stock 代表金額
            row.todayRemain = 0; // 不適用於這些類型
          }
          payload.rows.push(row);
        }
      });
    }

    const response = await fetch(GOOGLE_SHEET_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      redirect: 'follow' // 允許重定向，Apps Script 有時會重定向
    });

    // 檢查響應是否為 JSON
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
      const result = await response.json();
      return res.status(200).json({ success: true, ...result });
    } else {
      const text = await response.text();
      console.error("Apps Script returned non-JSON response:", text);
      return res.status(500).json({ success: false, error: "Apps Script did not return a valid JSON response." });
    }

  } catch (err) {
    console.error("Submit API error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
