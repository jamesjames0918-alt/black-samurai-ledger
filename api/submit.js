export default async function handler(req, res) {
  try {
    const { config, data, results, editor, date, storeName, otherIncomeItems, otherExpenseItems } = req.body || {};
    const GOOGLE_SHEET_API_URL = 'https://script.google.com/macros/s/AKfycbxpRCTtrtS30vPP8PwU7eELC17X9QUnYd9RiH_tJ5faOxjnsG7RttbAsCSDEbSnpCP7/exec';
    
    // 合併項目文字：項目1:100 | 項目2:200
    const formatItems = (items) => (items || [])
      .filter(item => item.note || item.amount > 0)
      .map(item => `${item.note || '未命名'}:${item.amount}`)
      .join(' | ');

    // 計算其他收支總計
    const otherIncomeTotal = (otherIncomeItems || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const otherExpenseTotal = (otherExpenseItems || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const otherBalance = otherIncomeTotal - otherExpenseTotal;

    const payload = {
      action: 'saveLedger', // 指定 Apps Script 的 action 為 saveLedger
      date, 
      storeName, 
      uploadedBy: editor, // 更改為 uploadedBy 以匹配 Apps Script
      role: 'staff', // 暫時寫死為 staff，後續可從前端傳遞
      rows: [], // 將前端計算的品項數據轉換為 Apps Script 期望的 rows 格式
      thumb: data.thumb || data.imgSrc || "", // 圖片縮圖
      // 原始 AI 辨識結果
      rawAiData: data,
      // 前端計算結果
      frontendResults: results,
      // 其他收支細項
      otherIncomeDetail: formatItems(otherIncomeItems),
      otherExpenseDetail: formatItems(otherExpenseItems),
      otherBalance,
      config // 傳遞 config 到 Apps Script
    };

    // 將前端的 data.items 轉換為 Apps Script 期望的 rows 格式
    if (data && data.items && config) {
      config.forEach(cfgItem => {
        if (data.items[cfgItem.name]) {
          const itemData = data.items[cfgItem.name];
          payload.rows.push({
            item: cfgItem.name,
            type: cfgItem.type,
            unitPrice: cfgItem.unitPrice,
            yesterdayRemain: itemData.yesterdayRemain, // 如果有這個數據
            todayStock: itemData.stock, // 帶貨或收款金額
            todayRemain: itemData.return // 退貨或餘量
          });
        }
      });
    }

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
