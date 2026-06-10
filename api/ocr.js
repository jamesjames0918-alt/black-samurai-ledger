/**
 * 黑武藏統計卡帳本 V3.0 - Vercel API (ocr.js)
 * 負責接收前端圖片與配置，動態生成 AI Prompt，並呼叫 OpenAI 進行 OCR 辨識。
 * 
 * 核心功能：
 * - 根據前端傳遞的 `config` 動態構建 OpenAI 的 `systemPrompt`。
 * - 確保 AI Prompt 中不包含任何硬編碼的品項名稱。
 * - 處理圖片數據並傳遞給 OpenAI。
 * - 解析 OpenAI 回應並返回給前端。
 */

export default async function handler(req, res) {
  try {
    const { images, config } = req.body || {};
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    if (!OPENAI_API_KEY) {
      return res.status(500).json({ success: false, error: 'OpenAI API Key is missing.' });
    }
    if (!images || !images.card || !images.pos || !images.line) {
      return res.status(400).json({ success: false, error: '缺少一張或多張圖片檔案。' });
    }
    if (!config || !Array.isArray(config) || config.length === 0) {
      return res.status(400).json({ success: false, error: '配置 (config) 遺失或為空。' });
    }

    // 根據 config 動態生成品項結構和描述
    let itemsTemplate = {};
    let stockItemsDescription = [];
    let paymentItemsDescription = [];

    config.forEach(item => {
      if (item.enabled) {
        if (item.type === "stock") {
          itemsTemplate[item.name] = { stock: 0, return: 0 };
          stockItemsDescription.push(item.name);
        } else if (item.type === "payment" || item.type === "platform" || item.type === "delivery") {
          itemsTemplate[item.name] = { stock: 0 }; // 對於收款/平台/外送，只需要一個 stock 欄位表示金額
          paymentItemsDescription.push(item.name);
        }
      }
    });

    let itemsDescription = "";
    if (stockItemsDescription.length > 0) {
      itemsDescription += `庫存品項: ${stockItemsDescription.join('、')}.`;
    }
    if (paymentItemsDescription.length > 0) {
      if (itemsDescription) itemsDescription += " ";
      itemsDescription += `收款/平台/外送品項: ${paymentItemsDescription.join('、')}.`;
    }

    const systemPrompt = `你是一位專業的會計審計員。請從三張圖片中提取數據（手寫帳本卡、POS 機截圖、LinePay 截圖）。
${itemsDescription}

請嚴格按照以下 JSON 格式輸出。如果數據缺失，請填寫 0 或空字串：
{
  "date": "YYYY/MM/DD",
  "storeName": "龜山店/中正店/大竹店",
  "items": ${JSON.stringify(itemsTemplate)},
  "finance": {
    "pos_total_revenue": 0,
    "cash_actual": 0,
    "other_income": 0,
    "other_expense": 0
  },
  "platforms": {
    "linepay": 0,
    "panda": 0,
    "uber": 0
  }
}`; // 確保這裡的 JSON 結構與前端預期一致

    const userContent = [{ type: 'text', text: '請分析圖片並輸出 JSON。' }];
    for (const key in images) {
      if (images[key]) userContent.push({ type: 'image_url', image_url: { url: images[key] } });
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userContent }],
        response_format: { type: 'json_object' }
      })
    });

    const aiResponse = await response.json();

    if (aiResponse.choices && aiResponse.choices[0] && aiResponse.choices[0].message && aiResponse.choices[0].message.content) {
      return res.status(200).json({ success: true, data: JSON.parse(aiResponse.choices[0].message.content) });
    } else {
      console.error("OpenAI API response error:", aiResponse);
      return res.status(500).json({ success: false, error: "無法解析 AI 回應或 AI 返回錯誤。" });
    }
  } catch (err) {
    console.error("OCR API error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
