export default async function handler(req, res) {
  try {
    const { images, config } = req.body || {};
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) return res.status(500).json({ success: false, error: 'API Key missing' });

    // 根據 config 動態生成品項結構
    let itemsTemplate = {};
    let itemsDescription = "";
    
    if (config && Array.isArray(config)) {
      const stockItems = config.filter(item => item.type === "庫存");
      const paymentItems = config.filter(item => item.type === "收款" || item.type === "平台" || item.type === "外送");
      
      // 生成品項模板
      stockItems.forEach(item => {
        itemsTemplate[item.name] = { stock: 0, return: 0 };
      });
      paymentItems.forEach(item => {
        itemsTemplate[item.name] = { stock: 0 };
      });
      
      // 生成描述文字
      if (stockItems.length > 0) {
        itemsDescription = "庫存品項：" + stockItems.map(item => item.name).join("、");
      }
    } else {
      // 預設品項結構 (如果沒有配置，提供一個基礎模板)
      itemsTemplate = {
        "飯粒": { stock: 0, return: 0 },
        "花壽司": { stock: 0, return: 0 },
        "茶碗蒸": { stock: 0, return: 0 },
        "味噌湯": { stock: 0, return: 0 },
        "涼麵": { stock: 0, return: 0 },
        "優待顆數": { stock: 0, return: 0 },
        "盒裝": { stock: 0, return: 0 }
      };
      itemsDescription = "庫存品項：飯粒、花壽司、茶碗蒸、味噌湯、涼麵、優待顆數、盒裝";
    }

    const systemPrompt = `你是一個專業的會計審核員。請從三張圖片（手寫統計卡、POS截圖、LinePay截圖）中提取數據。
${itemsDescription}

必須輸出以下格式的 JSON，若無數據則填 0 或空字串：
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
}`;

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
    return res.status(200).json({ success: true, data: JSON.parse(aiResponse.choices[0].message.content) });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
