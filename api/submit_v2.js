export default async function handler(req, res) {
  try {
    const { config, data, results, editor, date, storeName, otherIncomeItems, otherExpenseItems } = req.body || {};
    const GOOGLE_SHEET_API_URL = 'https://script.google.com/macros/s/AKfycbxpRCTtrtS30vPP8PwU7eELC17X9QUnYd9RiH_tJ5faOxjnsG7RttbAsCSDEbSnpCP7/exec';
    
    // 構建 rows 陣列，用於新版 Apps Script
    const rows = [];
    
    // 添加庫存品項
    if (config && config.items) {
      config.items.forEach(item => {
        if (item.type === "庫存" && data.items && data.items[item.name]) {
          const itemData = data.items[item.name];
          rows.push({
            name: item.name,
            item: item.name,
            yesterdayRemain: 0, // 如果前端有此數據，可以替換
            todayStock: itemData.stock || 0,
            todayRemain: itemData.return || 0,
            unitPrice: item.unitPrice || 0
          });
        }
      });
    }
    
    // 添加收款品項
    if (config && config.items) {
      config.items.forEach(item => {
        if ((item.type === "收款" || item.type === "平台" || item.type === "外送") && data.items && data.items[item.name]) {
          const itemData = data.items[item.name];
          rows.push({
            name: item.name,
            item: item.name,
            amount: itemData.stock || 0,
            unitPrice: 0
          });
        }
      });
    }

    const payload = {
      action: "saveLedger",
      date: date || new Date().toISOString().split('T')[0],
      storeName: storeName || "黑武藏",
      uploadedBy: editor || "unknown",
      role: "staff", // 可根據前端傳送的角色修改
      rows: rows,
      thumb: "", // 如果有圖片縮圖，可以在這裡添加
      imgSrc: ""
    };

    const response = await fetch(GOOGLE_SHEET_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      redirect: 'follow'
    });

    const result = await response.json();
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
