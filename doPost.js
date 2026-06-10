function doPost(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("數據總表");

  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: "找不到 '數據總表' 工作表" })).setMimeType(ContentService.MimeType.JSON);
  }

  try {
    var postData = JSON.parse(e.postData.contents);

    if (postData.type === 'FULL_SYNC_V2') {
      // 定義標準標題順序，與 doGet 中的 headers 保持一致
      var headers = [
        "店別", "日期", "星期", "上傳者", "上傳時間", 
        "飯粒_帶貨", "飯粒_退貨", "飯粒_銷售數量", "飯粒_銷售金額",
        "花壽司_帶貨", "花壽司_退貨", "花壽司_銷售數量", "花壽司_銷售金額",
        "茶碗蒸_帶貨", "茶碗蒸_退貨", "茶碗蒸_銷售數量", "茶碗蒸_銷售金額",
        "味噌湯_帶貨", "味噌湯_退貨", "味噌湯_銷售數量", "味噌湯_銷售金額",
        "涼麵_帶貨", "涼麵_退貨", "涼麵_銷售數量", "涼麵_銷售金額",
        "優待顆數_帶貨", "優待顆數_退貨", "優待顆數_銷售數量", "優待顆數_銷售金額",
        "熊貓外送", "UBER", "LINEPAY", "其他收入", "其他收入細項", "其他支出", "其他支出細項",
        "其他收支總計", 
        "錢櫃實點現金", "留存金", "短溢", "總營收", "售價應收", "實收誤差", "收支誤差", "飯粒溢價", "誤差值"
      ];

      // 輔助函數：安全地獲取數字
      var getNum = function(val) {
        var num = Number(val);
        return isNaN(num) ? 0 : num;
      };

      // 輔助函數：從 data 中獲取特定項目的特定欄位
      var getItemData = function(itemName, field) {
        if (postData.data && postData.data[itemName]) {
          return getNum(postData.data[itemName][field]);
        }
        return 0;
      };

      // 輔助函數：從 results 中獲取特定結果
      var getResult = function(resultName) {
        if (postData.results && postData.results[resultName] !== undefined) {
          return getNum(postData.results[resultName]);
        }
        return 0;
      };

      // 根據星期幾計算
      var dateObj = new Date(postData.date);
      var days = ['日', '一', '二', '三', '四', '五', '六'];
      var dayOfWeek = days[dateObj.getDay()];

      // 構建 rowData 陣列，順序必須與 headers 完全一致
      var rowData = [
        postData.storeName || "", // 店別
        postData.date || "", // 日期
        dayOfWeek || "", // 星期
        postData.editor || "", // 上傳者
        postData.uploadTime || "", // 上傳時間
        
        getItemData("飯粒", "stockIn"), // 飯粒_帶貨
        getItemData("飯粒", "stockOut"), // 飯粒_退貨
        getItemData("飯粒", "salesCount"), // 飯粒_銷售數量
        getItemData("飯粒", "salesAmount"), // 飯粒_銷售金額
        
        getItemData("花壽司", "stockIn"), // 花壽司_帶貨
        getItemData("花壽司", "stockOut"), // 花壽司_退貨
        getItemData("花壽司", "salesCount"), // 花壽司_銷售數量
        getItemData("花壽司", "salesAmount"), // 花壽司_銷售金額
        
        getItemData("茶碗蒸", "stockIn"), // 茶碗蒸_帶貨
        getItemData("茶碗蒸", "stockOut"), // 茶碗蒸_退貨
        getItemData("茶碗蒸", "salesCount"), // 茶碗蒸_銷售數量
        getItemData("茶碗蒸", "salesAmount"), // 茶碗蒸_銷售金額
        
        getItemData("味噌湯", "stockIn"), // 味噌湯_帶貨
        getItemData("味噌湯", "stockOut"), // 味噌湯_退貨
        getItemData("味噌湯", "salesCount"), // 味噌湯_銷售數量
        getItemData("味噌湯", "salesAmount"), // 味噌湯_銷售金額
        
        getItemData("涼麵", "stockIn"), // 涼麵_帶貨
        getItemData("涼麵", "stockOut"), // 涼麵_退貨
        getItemData("涼麵", "salesCount"), // 涼麵_銷售數量
        getItemData("涼麵", "salesAmount"), // 涼麵_銷售金額
        
        getItemData("優待顆數", "stockIn"), // 優待顆數_帶貨
        getItemData("優待顆數", "stockOut"), // 優待顆數_退貨
        getItemData("優待顆數", "salesCount"), // 優待顆數_銷售數量
        getItemData("優待顆數", "salesAmount"), // 優待顆數_銷售金額
        
        getResult("panda"), // 熊貓外送
        getResult("uber"), // UBER
        getResult("linePay"), // LINEPAY
        getResult("otherIncome"), // 其他收入
        postData.otherIncomeDetail || "", // 其他收入細項
        getResult("otherExpense"), // 其他支出
        postData.otherExpenseDetail || "", // 其他支出細項
        
        postData.otherBalance || 0, // 其他收支總計
        
        getResult("cashInRegister"), // 錢櫃實點現金
        getResult("retainedCash"), // 留存金
        getResult("shortageSurplus"), // 短溢
        getResult("totalRevenue"), // 總營收
        getResult("expectedRevenue"), // 售價應收
        getResult("actualRevenueError"), // 實收誤差
        getResult("revenueExpenseError"), // 收支誤差
        getResult("ricePremium"), // 飯粒溢價
        getResult("errorValue") // 誤差值
      ];

      // 將數據寫入試算表
      sheet.appendRow(rowData);

      return ContentService.createTextOutput(JSON.stringify({ success: true, message: "數據同步成功" })).setMimeType(ContentService.MimeType.JSON);
    } else {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "無效的請求類型" })).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message })).setMimeType(ContentService.MimeType.JSON);
  }
}
