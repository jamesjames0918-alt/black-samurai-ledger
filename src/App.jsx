import React, { useState, useRef, useEffect, useMemo } from 'react';
import AuthPage from './AuthPage.jsx';

const GLOBAL_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@400;700;900&display=swap' );
  :root { --primary: #c0392b; --dark: #121212; --bg-light: #f5f0e8; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background-color: var(--bg-light); font-family: 'Noto Serif TC', serif; color: var(--dark); min-height: 100vh; }
  .dashboard { max-width: 1200px; margin: 0 auto; padding: 15px; }
  .nav-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid var(--dark); padding-bottom: 10px; }
  .report-card { background: #fff; padding: 20px; border: 1px solid #ddd; box-shadow: 0 4px 12px rgba(0,0,0,0.05); margin-bottom: 20px; border-radius: 8px; }
  
  /* 響應式圖片預覽 */
  .preview-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 15px; margin-bottom: 20px; }
  .preview-box { border: 1px solid #ddd; padding: 10px; background: #fff; text-align: center; border-radius: 4px; }
  .preview-box img { width: 100%; max-height: 300px; object-fit: contain; }
  .preview-label { font-size: 13px; color: #666; margin-top: 8px; font-weight: bold; }

  /* 響應式表格 */
  .table-container { overflow-x: auto; margin-bottom: 20px; -webkit-overflow-scrolling: touch; }
  .data-table { width: 100%; border-collapse: collapse; font-size: 14px; min-width: 600px; }
  .data-table th, .data-table td { border: 1px solid #eee; padding: 10px; text-align: center; }
  .data-table th { background: #f9f9f9; font-weight: bold; position: sticky; top: 0; }
  
  .editable-input { width: 80px; border: 1px solid #ccc; text-align: center; padding: 6px; border-radius: 4px; font-size: 16px; /* 防止手機縮放 */ }
  
  /* 摘要網格響應式 */
  .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
  .summary-item { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #eee; align-items: center; }
  
  .submit-btn { width: 100%; padding: 16px; background: var(--dark); color: #fff; border: none; cursor: pointer; font-weight: bold; font-size: 18px; border-radius: 8px; transition: 0.3s; margin-top: 10px; }
  .submit-btn:hover { background: var(--primary); }
  .submit-btn:disabled { background: #ccc; cursor: not-allowed; }

  .image-slot { border: 2px dashed #ccc; height: 180px; display: flex; align-items: center; justify-content: center; cursor: pointer; background: #fafafa; border-radius: 8px; overflow: hidden; }
  .image-slot img { width: 100%; height: 100%; object-fit: cover; }

  .badge { padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: bold; }
  .badge-success { background: #e6f4ea; color: #1e8e3e; }
  .badge-error { background: #fce8e6; color: #d93025; }

  @media (max-width: 600px) {
    .nav-header { flex-direction: column; gap: 10px; text-align: center; }
    .report-card { padding: 15px; }
    .data-table { font-size: 13px; }
    .editable-input { width: 65px; padding: 4px; }
  }
`;

const RESERVE_CASH = 5000; // 留存金配置，可修改此數值
const GOOGLE_SHEET_API_URL = 'https://script.google.com/macros/s/AKfycbxpRCTtrtS30vPP8PwU7eELC17X9QUnYd9RiH_tJ5faOxjnsG7RttbAsCSDEbSnpCP7/exec';

export default function App( ) {
  const [user, setUser] = useState(sessionStorage.getItem("current_user"));
  const [view, setView] = useState("home");
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState({ card: null, pos: null, line: null });
  const [data, setData] = useState(null);
  const [otherIncomeItems, setOtherIncomeItems] = useState([{ amount: 0, note: "" }]);
  const [otherExpenseItems, setOtherExpenseItems] = useState([{ amount: 0, note: "" }]);
  const [history, setHistory] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [storeName, setStoreName] = useState("");
  const [userRole, setUserRole] = useState(sessionStorage.getItem("user_role") || "staff");
  const [config, setConfig] = useState(null); // 儲存從 Apps Script 載入的配置
  const [configLoading, setConfigLoading] = useState(true); // 配置載入狀態
  const [configError, setConfigError] = useState(null); // 配置載入錯誤訊息

  const fileInputs = { card: useRef(), pos: useRef(), line: useRef() };

  // 從 Apps Script 載入品項配置
  const loadConfig = async () => {
    try {
      const res = await fetch(`${GOOGLE_SHEET_API_URL}?action=config`);
      const result = await res.json();
      if (result.success && result.items) {
        setConfig(result.items);
        console.log("Config loaded successfully:", result.items); // For self-check B
      } else {
        console.error("Failed to load config:", result.error);
        setConfigError(result.error || "Unknown error");
        setConfig([]); 
      }
    } catch (err) {
      console.error("Failed to load config:", err);
      setConfigError(err.message || "Connection error");
      setConfig([]); 
    } finally {
      setConfigLoading(false);
    }
  };

  // 頁面載入時自動載入配置
  useEffect(() => {
    loadConfig();
  }, []);

  // 根據配置建立 PRICES 物件 (useMemo 優化性能)
  const PRICES = useMemo(() => {
    const prices = {};
    if (config) {
      config.forEach(item => {
        prices[item.name] = item.unitPrice || 0;
      });
    }
    return prices;
  }, [config]);

  const handleFileChange = (type, e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImages(prev => ({ ...prev, [type]: reader.result }));
      reader.readAsDataURL(file);
    }
  };

  const runOCR = async () => {
    if (!images.card || !images.pos || !images.line) return alert("Please upload all three images.");
    if (!config || config.length === 0) {
      alert("System configuration not loaded or empty. Please check Google Sheet '設定_品項'."); // For self-check C & E
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/ocr", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ images, config }) // 傳遞 config 到 OCR API
      });
      const result = await res.json();
      if (result.success) { 
        let formattedDate = "";
        if (result.data.date) {
          formattedDate = result.data.date.replace(/\//g, '-');
        }
        
        let formattedStoreName = "";
        if (result.data.storeName) {
          formattedStoreName = result.data.storeName.endsWith('店') ? result.data.storeName : result.data.storeName + '店';
        }

        const initialItems = {};
        config.forEach(cfgItem => {
          if (cfgItem.enabled) {
            if (cfgItem.type === "stock") {
              initialItems[cfgItem.name] = {
                stock: result.data.items?.[cfgItem.name]?.stock || 0,
                return: result.data.items?.[cfgItem.name]?.return || 0,
                yesterdayRemain: 0, 
                todayRemain: 0
              };
            } else if (cfgItem.type === "payment" || cfgItem.type === "platform" || cfgItem.type === "delivery") {
              initialItems[cfgItem.name] = {
                stock: result.data.items?.[cfgItem.name]?.stock || 0, // For payment/platform/delivery, 'stock' means amount
                return: 0 // Not applicable for these types
              };
            }
          }
        });

        setData({
          ...result.data,
          date: formattedDate,
          items: initialItems 
        }); 
        
        if (formattedStoreName) {
          setStoreName(formattedStoreName);
        }

        setOtherIncomeItems([{ amount: result.data.finance?.other_income || 0, note: "" }]);
        setOtherExpenseItems([{ amount: result.data.finance?.other_expense || 0, note: "" }]);
        
        setView("result"); 
        window.scrollTo(0,0); 
      }
      else alert("OCR failed: " + (result.error || "Please try again."));
    } catch (err) { alert("System connection error: " + err.message); }
    finally { setLoading(false); }
  };

  const updateItem = (name, field, val) => {
    setData(prev => ({
      ...prev,
      items: { ...prev.items, [name]: { ...prev.items[name], [field]: Number(val) } }
    }));
  };

  const calculateResults = () => {
    if (!data || !config) return {};
    
    let salesTotal = 0;
    const itemDetails = [];
    
    // 遍歷配置中的所有庫存品項
    config.forEach(configItem => {
      if (configItem.type === "stock" && configItem.enabled && data.items && data.items[configItem.name]) {
        const item = data.items[configItem.name];
        const qty = (item.stock || 0) - (item.return || 0);
        const amount = qty * (configItem.unitPrice || 0);
        salesTotal += amount;
        itemDetails.push({ name: configItem.name, qty, amount });
      }
    });

    // 計算盒裝支出（如果存在）
    const boxItem = config.find(item => item.name === "盒裝" && item.type === "stock");
    let boxExpense = 0;
    if (boxItem && data.items && data.items["盒裝"]) {
      const boxReturnQty = data.items["盒裝"].stock || 0; 
      boxExpense = boxReturnQty * (boxItem.unitPrice || 0);
    }
    
    // 計算動態細項總和
    const dynamicOtherIncome = otherIncomeItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const dynamicOtherExpense = otherExpenseItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

    // 將盒裝支出加入其他支出
    const otherExpenseTotal = dynamicOtherExpense + boxExpense;

    const posTotal = data.finance?.pos_total_revenue || 0;
    const cashActual = data.finance?.cash_actual || 0;
    const onlineTotal = data.platforms?.linepay || 0;
    const platformTotal = (data.platforms?.panda || 0) + (data.platforms?.uber || 0);
    
    const otherIncome = dynamicOtherIncome;
    const actualDiff = posTotal - salesTotal; // 實收誤差 = POS - 應收
    
    // 飯粒溢價計算（如果存在飯粒品項）
    const riceItem = config.find(item => item.name === "飯粒" && item.type === "stock");
    let ricePremium = 0;
    if (riceItem && data.items && data.items["飯粒"]) {
      const riceQty = (data.items["飯粒"].stock || 0) - (data.items["飯粒"].return || 0);
      ricePremium = Math.round(riceQty * 0.7) * 5; // 假設飯粒溢價計算邏輯
    }
    
    // 誤差值 (最終) = 實收誤差 + 其他支出總計 - 其他收入總計 - 飯粒溢價
    const finalError = actualDiff + otherExpenseTotal - otherIncome - ricePremium;
    
    // 錢櫃現金 = 實點現金 - 留存金
    const registerCash = cashActual - RESERVE_CASH;
    
    return { itemDetails, salesTotal, posTotal, cashActual, onlineTotal, platformTotal, actualDiff, ricePremium, finalError, otherIncome, otherExpenseTotal, registerCash, reserveCash: RESERVE_CASH };
  };

  const results = calculateResults();

  // 數據校驗函數：檢查是否有負數銷售數量（根據配置動態檢查）
  const validateData = () => {
    const errors = [];
    if (!config || !data || !data.items) return errors;
    
    config.forEach(configItem => {
      if (configItem.type === "stock" && configItem.enabled && data.items[configItem.name]) {
        const item = data.items[configItem.name];
        const qty = (item.stock || 0) - (item.return || 0);
        if (qty < 0) {
          errors.push(`${configItem.name} sales quantity cannot be negative (Stock: ${item.stock || 0}, Return: ${item.return || 0}).`);
        }
      }
    });
    
    return errors;
  };

  const formatLocalTime = (isoStr) => {
    if (!isoStr) return "";
    try {
      const date = new Date(isoStr);
      return date.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false });
    } catch (e) {
      return isoStr;
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${GOOGLE_SHEET_API_URL}?action=history`);
      const resData = await res.json();
      if (resData.success) setHistory(resData.history);
    } catch (err) {
      alert("Failed to fetch history: " + err.message);
    }
  };

  useEffect(() => {
    if (user && !configLoading && !configError) fetchHistory();
  }, [user, configLoading, configError]); 

  const submit = async () => {
    const errors = validateData();
    if (errors.length > 0) {
      alert("❌ Data anomaly, cannot sync!\n\n" + errors.join("\n\n") + "\n\nPlease correct before trying again.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/submit", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ 
          config, 
          data, 
          results, 
          editor: user, 
          date: data.date, 
          storeName,
          otherIncomeItems,
          otherExpenseItems
        }) 
      });
      const resData = await res.json();
      if (resData.success) { 
        alert("Sync successful! Data written to spreadsheet."); 
        setView("home"); 
        setImages({card:null,pos:null,line:null}); 
        setData(null); 
        setOtherIncomeItems([{ amount: 0, note: "" }]); 
        setOtherExpenseItems([{ amount: 0, note: "" }]); 
        fetchHistory(); 
      }
      else alert("Sync failed: " + (resData.error || "Please check connection."));
    } catch { alert("Connection error during sync."); }
    finally { setLoading(false); }
  };

  const handleLoginSuccess = ({ username, role }) => {
    setUser(username);
    sessionStorage.setItem("current_user", username);
    setUserRole(role);
    sessionStorage.setItem("user_role", role);
  };

  if (!user) return <AuthPage onLogin={handleLoginSuccess} />;

  // 配置載入中
  if (configLoading) {
    return (
      <div className="dashboard">
        <style>{GLOBAL_STYLE}</style>
        <div style={{ textAlign: 'center', padding: '40px', fontSize: '16px', color: '#666' }}>
          Loading system configuration...
        </div>
      </div>
    );
  }

  // 配置載入失敗
  if (configError) {
    return (
      <div className="dashboard">
        <style>{GLOBAL_STYLE}</style>
        <div style={{ textAlign: 'center', padding: '40px', fontSize: '16px', color: 'red' }}>
          Failed to load system configuration: {configError}. Please check Google Sheet '設定_品項' or Apps Script deployment.
        </div>
      </div>
    );
  }

  // 過濾出庫存品項和收款品項
  const stockItems = config.filter(item => item.type === "stock" && item.enabled);
  const paymentItems = config.filter(item => (item.type === "payment" || item.type === "platform" || item.type === "delivery") && item.enabled);

  return (
    <div className="dashboard">
      <style>{GLOBAL_STYLE}</style>
      <header className="nav-header">
        <h1>黑武藏職人營收 <span style={{ fontSize: '0.6em', opacity: 0.7 }}>MOBILE v5.6</span></h1>
        <div>
          <span>{user}</span>
          <button onClick={() => { sessionStorage.removeItem("current_user"); sessionStorage.removeItem("user_role"); setUser(null); }} style={{ marginLeft: '10px', padding: '5px 10px', background: '#c0392b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Logout</button>
        </div>
      </header>

      {view === "home" && (
        <div className="report-card">
          <h2>Upload Today's Revenue Photos</h2>
          <div className="preview-grid">
            {['card', 'pos', 'line'].map(type => (
              <div key={type} className="preview-box">
                <div className="image-slot" onClick={() => fileInputs[type].current.click()}>
                  {images[type] ? <img src={images[type]} alt={type} /> : <span>Click to Upload {type.toUpperCase()}</span>}
                </div>
                <input type="file" ref={fileInputs[type]} style={{ display: 'none' }} onChange={(e) => handleFileChange(type, e)} accept="image/*" />
                <div className="preview-label">{type.toUpperCase()} Image</div>
              </div>
            ))}
          </div>
          <button className="submit-btn" onClick={runOCR} disabled={loading}>
            {loading ? 'Processing...' : 'Start Recognition and Auto Reconciliation'}
          </button>
          
          <h2 style={{ marginTop: '40px', marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>Upload History</h2>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Store</th>
                  <th>Date</th>
                  <th>Uploader</th>
                  <th>Upload Time</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {history.length > 0 ? history.map((record, index) => (
                  <tr key={index}>
                    <td>{record.storeName}</td>
                    <td>{record.date ? new Date(record.date).toLocaleDateString('zh-TW') : ''}</td>
                    <td>{record.uploadedBy}</td>
                    <td>{formatLocalTime(record.createdAt)}</td>
                    <td><button onClick={() => setSelectedRecord(record)} style={{ padding: '5px 10px', background: '#3498db', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>View</button></td>
                  </tr>
                )) : (
                  <tr><td colSpan="5">No history records.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {selectedRecord && (
            <div style={{ marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '20px' }}>
              <h3>Record Details</h3>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: '0.8em', background: '#f5f5f5', padding: '10px', borderRadius: '4px' }}>
                {JSON.stringify(selectedRecord, null, 2)}
              </pre>
              <button onClick={() => setSelectedRecord(null)} style={{ marginTop: '10px', padding: '5px 10px', background: '#95a5a6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Close</button>
            </div>
          )}
        </div>
      )}

      {view === "result" && data && (
        <div className="report-card">
          <h2>Recognition Results & Manual Adjustment</h2>
          <div style={{ marginBottom: '20px' }}>
            <label>Date: <input type="date" value={data.date} onChange={(e) => setData(prev => ({ ...prev, date: e.target.value }))} /></label>
            <label style={{ marginLeft: '20px' }}>Store: 
              <select value={storeName} onChange={(e) => setStoreName(e.target.value)}>
                <option value="龜山店">龜山店</option>
                <option value="中正店">中正店</option>
                <option value="大竹店">大竹店</option>
              </select>
            </label>
          </div>

          <h3 style={{ marginTop: '20px', marginBottom: '10px' }}>Stock Items</h3>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Stock</th>
                  <th>Return</th>
                  <th>Unit Price</th>
                  <th>Sales Qty</th>
                  <th>Sales Amount</th>
                </tr>
              </thead>
              <tbody>
                {stockItems.map(item => {
                  const currentItemData = data.items?.[item.name] || { stock: 0, return: 0 };
                  const salesQty = (currentItemData.stock || 0) - (currentItemData.return || 0);
                  const salesAmount = salesQty * (item.unitPrice || 0);
                  return (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td><input type="number" className="editable-input" value={currentItemData.stock} onChange={(e) => updateItem(item.name, 'stock', e.target.value)} /></td>
                      <td><input type="number" className="editable-input" value={currentItemData.return} onChange={(e) => updateItem(item.name, 'return', e.target.value)} /></td>
                      <td>{item.unitPrice}</td>
                      <td>{salesQty}</td>
                      <td>{salesAmount}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <h3 style={{ marginTop: '20px', marginBottom: '10px' }}>Payment/Platform/Delivery Items</h3>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Method</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {paymentItems.map(item => {
                  const currentItemData = data.items?.[item.name] || { stock: 0 };
                  return (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td><input type="number" className="editable-input" value={currentItemData.stock} onChange={(e) => updateItem(item.name, 'stock', e.target.value)} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <h3 style={{ marginTop: '20px', marginBottom: '10px' }}>Other Income</h3>
          {otherIncomeItems.map((item, index) => (
            <div key={index} className="summary-item">
              <input type="text" placeholder="Note" value={item.note} onChange={(e) => {
                const newItems = [...otherIncomeItems];
                newItems[index].note = e.target.value;
                setOtherIncomeItems(newItems);
              }} />
              <input type="number" placeholder="Amount" value={item.amount} onChange={(e) => {
                const newItems = [...otherIncomeItems];
                newItems[index].amount = Number(e.target.value);
                setOtherIncomeItems(newItems);
              }} />
              <button onClick={() => setOtherIncomeItems(prev => prev.filter((_, i) => i !== index))}>Remove</button>
            </div>
          ))}
          <button onClick={() => setOtherIncomeItems(prev => [...prev, { amount: 0, note: "" }])}>Add Other Income</button>

          <h3 style={{ marginTop: '20px', marginBottom: '10px' }}>Other Expense</h3>
          {otherExpenseItems.map((item, index) => (
            <div key={index} className="summary-item">
              <input type="text" placeholder="Note" value={item.note} onChange={(e) => {
                const newItems = [...otherExpenseItems];
                newItems[index].note = e.target.value;
                setOtherExpenseItems(newItems);
              }} />
              <input type="number" placeholder="Amount" value={item.amount} onChange={(e) => {
                const newItems = [...otherExpenseItems];
                newItems[index].amount = Number(e.target.value);
                setOtherExpenseItems(newItems);
              }} />
              <button onClick={() => setOtherExpenseItems(prev => prev.filter((_, i) => i !== index))}>Remove</button>
            </div>
          ))}
          <button onClick={() => setOtherExpenseItems(prev => [...prev, { amount: 0, note: "" }])}>Add Other Expense</button>

          <h3 style={{ marginTop: '20px', marginBottom: '10px' }}>Summary</h3>
          <div className="summary-grid">
            <div className="summary-item"><span>Item Sales Total:</span><span>{results.salesTotal}</span></div>
            <div className="summary-item"><span>POS Total Revenue:</span><span>{results.posTotal}</span></div>
            <div className="summary-item"><span>Actual Difference (POS - Expected):</span><span>{results.actualDiff}</span></div>
            <div className="summary-item"><span>Actual Cash Count:</span><span>{results.cashActual}</span></div>
            <div className="summary-item"><span>Reserve Cash:</span><span>{results.reserveCash}</span></div>
            <div className="summary-item"><span>Register Cash Count (Actual - Reserve):</span><span>{results.registerCash}</span></div>
            <div className="summary-item"><span>LINEPAY:</span><span>{results.onlineTotal}</span></div>
            <div className="summary-item"><span>Platform Total (Panda + Uber):</span><span>{results.platformTotal}</span></div>
            <div className="summary-item"><span>Other Income:</span><span>{results.otherIncome}</span></div>
            <div className="summary-item"><span>Other Expense:</span><span>{results.otherExpenseTotal}</span></div>
            <div className="summary-item"><span>Rice Premium:</span><span>{results.ricePremium}</span></div>
            <div className="summary-item"><span>Final Error:</span><span>{results.finalError}</span></div>
          </div>

          <button className="submit-btn" onClick={submit} disabled={loading}>
            {loading ? 'Submitting...' : 'Sync to Google Sheet'}
          </button>
          <button className="submit-btn" onClick={() => setView("home")} style={{ background: '#6c757d', marginTop: '10px' }}>Cancel</button>
        </div>
      )}
    </div>
  );
}
