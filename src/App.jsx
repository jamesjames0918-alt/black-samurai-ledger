import React, { useState, useRef, useEffect, useMemo } from 'react';
import AuthPage from './AuthPage.jsx';

const GLOBAL_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@400;700;900&display=swap');
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

export default function App() {
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
      } else {
        console.error("無法載入配置：", result.error);
        setConfigError(result.error || "未知錯誤");
        setConfig([]); // 設置為空陣列以避免後續錯誤
      }
    } catch (err) {
      console.error("載入配置失敗：", err);
      setConfigError(err.message || "連線錯誤");
      setConfig([]); // 設置為空陣列以避免後續錯誤
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
    if (!images.card || !images.pos || !images.line) return alert("請先上傳三張圖片");
    if (!config || config.length === 0) return alert("系統配置未載入或為空，請檢查 Google Sheet '設定_品項'。");

    setLoading(true);
    try {
      const res = await fetch("/api/ocr", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ images, config }) // 傳遞 config 到 OCR API
      });
      const result = await res.json();
      if (result.success) { 
        // 格式化日期為 YYYY-MM-DD 以符合 <input type="date">
        let formattedDate = "";
        if (result.data.date) {
          formattedDate = result.data.date.replace(/\//g, '-');
        }
        
        // 格式化店名，確保帶有「店」字以匹配下拉選單
        let formattedStoreName = "";
        if (result.data.storeName) {
          formattedStoreName = result.data.storeName.endsWith('店') ? result.data.storeName : result.data.storeName + '店';
        }

        // 初始化 data.items，確保所有 config 中的品項都有預設值
        const initialItems = {};
        config.forEach(cfgItem => {
          if (cfgItem.type === "庫存" || cfgItem.type === "收款" || cfgItem.type === "平台" || cfgItem.type === "外送") {
            initialItems[cfgItem.name] = {
              stock: result.data.items?.[cfgItem.name]?.stock || 0,
              return: result.data.items?.[cfgItem.name]?.return || 0,
              yesterdayRemain: 0, // 預設為0，如果需要可從歷史數據載入
              todayRemain: 0
            };
          }
        });

        setData({
          ...result.data,
          date: formattedDate,
          items: initialItems // 使用初始化的品項數據
        }); 
        
        if (formattedStoreName) {
          setStoreName(formattedStoreName);
        }

        // 初始化細項
        setOtherIncomeItems([{ amount: result.data.finance?.other_income || 0, note: "" }]);
        setOtherExpenseItems([{ amount: result.data.finance?.other_expense || 0, note: "" }]);
        
        setView("result"); 
        window.scrollTo(0,0); 
      }
      else alert("辨識失敗：" + (result.error || "請重試"));
    } catch (err) { alert("系統連線錯誤：" + err.message); }
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
      if (configItem.type === "庫存" && data.items && data.items[configItem.name]) {
        const item = data.items[configItem.name];
        const qty = (item.stock || 0) - (item.return || 0);
        const amount = qty * (configItem.unitPrice || 0);
        salesTotal += amount;
        itemDetails.push({ name: configItem.name, qty, amount });
      }
    });

    // 計算盒裝支出（如果存在）
    const boxItem = config.find(item => item.name === "盒裝");
    let boxExpense = 0;
    if (boxItem && data.items["盒裝"]) {
      const boxReturnQty = data.items["盒裝"].stock || 0; // 盒裝的 stock 代表退回的數量
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
    const riceItem = config.find(item => item.name === "飯粒");
    let ricePremium = 0;
    if (riceItem && data.items["飯粒"]) {
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
      if (configItem.type === "庫存" && data.items[configItem.name]) {
        const item = data.items[configItem.name];
        const qty = (item.stock || 0) - (item.return || 0);
        if (qty < 0) {
          errors.push(`${configItem.name} 的銷售數量不能為負數 (帶貨: ${item.stock || 0}, 退貨: ${item.return || 0})`);
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
      alert("無法獲取歷史記錄：" + err.message);
    }
  };

  useEffect(() => {
    if (user && !configLoading && !configError) fetchHistory();
  }, [user, configLoading, configError]); // 依賴 configLoading 和 configError

  const submit = async () => {
    // 先進行數據校驗
    const errors = validateData();
    if (errors.length > 0) {
      alert("❌ 數據異常，無法同步！\n\n" + errors.join("\n\n") + "\n\n請修正後再試一次。");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/submit", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ 
          config, // 傳遞 config 到 submit API
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
      if (resData.success) { alert("同步成功！數據已寫入試算表。"); setView("home"); setImages({card:null,pos:null,line:null}); setData(null); setOtherIncomeItems([{ amount: 0, note: "" }]); setOtherExpenseItems([{ amount: 0, note: "" }]); fetchHistory(); }
      else alert("同步失敗：" + (resData.error || "請檢查連線"));
    } catch { alert("同步時發生連線錯誤"); }
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
          正在載入系統配置...
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
          載入系統配置失敗：{configError}，請檢查 Google Sheet '設定_品項' 或 Apps Script 部署。
        </div>
      </div>
    );
  }

  // 過濾出庫存品項和收款品項
  const stockItems = config.filter(item => item.type === "庫存" && item.enabled);
  const paymentItems = config.filter(item => (item.type === "收款" || item.type === "平台" || item.type === "外送") && item.enabled);

  return (
    <div className="dashboard">
      <style>{GLOBAL_STYLE}</style>
      <header className="nav-header">
        <div style={{ fontSize: '22px', fontWeight: '900', letterSpacing: '1px' }}>黑武藏職人營收 <span style={{fontSize:'12px', color:'#c0392b', verticalAlign:'middle'}}>MOBILE v5.6</span></div>
        <div style={{fontSize:'14px'}}>{user} <span onClick={() => { setUser(null); sessionStorage.clear(); }} style={{ cursor: 'pointer', color: '#c0392b', marginLeft:'5px' }}>[登出]</span></div>
      </header>

      {view === "home" && (
        <>
        <div className="report-card" style={{ textAlign: 'center' }}>
          <h3 style={{marginBottom:'20px', color: '#555'}}>上傳今日營收照片</h3>
          <div className="preview-grid">
            {[
              {id: 'card', label: '1. 手寫統計卡'},
              {id: 'pos', label: '2. POS 系統截圖'},
              {id: 'line', label: '3. LINE PAY 截圖'}
            ].map(t => (
              <div key={t.id} className="preview-box">
                <div className="image-slot" onClick={() => fileInputs[t.id].current.click()}>
                  {images[t.id] ? <img src={images[t.id]} alt={t.label} /> : <div style={{textAlign:'center', padding:'10px'}}><div style={{fontSize:'30px', marginBottom:'5px'}}>📸</div><div style={{fontSize:'13px'}}>{t.label}</div></div>}
                  <input type="file" ref={fileInputs[t.id]} hidden accept="image/*" onChange={e => handleFileChange(t.id, e)} />
                </div>
              </div>
            ))}
          </div>
          <button className="submit-btn" disabled={loading} onClick={runOCR}>{loading ? "正在進行 AI 辨識中..." : "開始辨識與自動對帳"}</button>
        </div>

        <div className="report-card">
          <h3 style={{marginBottom:'15px'}}>上傳歷史記錄</h3>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>店別</th>
                  <th>日期</th>
                  <th>上傳者</th>
                  <th>上傳時間</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {history.length > 0 ? history.map((record, idx) => (
                  <tr key={idx}>
                    <td>{record.storeName}</td>
                    <td>{record.date}</td>
                    <td>{record.uploadedBy}</td>
                    <td>{formatLocalTime(record.createdAt)}</td>
                    <td>
                      <button 
                        onClick={() => { setSelectedRecord(record); setView("historyDetail"); }}
                        style={{ padding: '5px 10px', border: '1px solid #ccc', borderRadius: '4px', background: '#f0f0f0', cursor: 'pointer' }}
                      >檢視</button>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="5">無歷史記錄</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}

      {view === "result" && data && (
        <>
          <div className="report-card">
            <h3 style={{marginBottom:'15px'}}>辨識結果與數據校正</h3>
            <div style={{display:'flex', gap:'10px', marginBottom:'15px', alignItems:'center'}}>
              <label>日期:</label>
              <input type="date" value={data.date} onChange={e => setData(prev => ({...prev, date: e.target.value}))} style={{padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} />
              <label>店別:</label>
              <select value={storeName} onChange={e => setStoreName(e.target.value)} style={{padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}}>
                <option value="中正店">中正店</option>
                <option value="龜山店">龜山店</option>
                <option value="大竹店">大竹店</option>
              </select>
            </div>

            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>品項</th>
                    <th>帶貨</th>
                    <th>退貨</th>
                    <th>數量</th>
                    <th>金額</th>
                  </tr>
                </thead>
                <tbody>
                  {stockItems.map(item => (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td><input type="number" className="editable-input" value={data.items[item.name]?.stock || 0} onChange={e => updateItem(item.name, 'stock', e.target.value)} /></td>
                      <td><input type="number" className="editable-input" value={data.items[item.name]?.return || 0} onChange={e => updateItem(item.name, 'return', e.target.value)} /></td>
                      <td>{(data.items[item.name]?.stock || 0) - (data.items[item.name]?.return || 0)}</td>
                      <td>${((data.items[item.name]?.stock || 0) - (data.items[item.name]?.return || 0)) * (item.unitPrice || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h4 style={{marginTop:'20px', marginBottom:'10px'}}>其他收入</h4>
            {otherIncomeItems.map((item, index) => (
              <div key={index} style={{display:'flex', gap:'10px', marginBottom:'10px', alignItems:'center'}}>
                <input type="text" placeholder="收入項目" value={item.note} onChange={e => {
                  const newItems = [...otherIncomeItems];
                  newItems[index].note = e.target.value;
                  setOtherIncomeItems(newItems);
                }} style={{flex:'1', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} />
                <input type="number" placeholder="金額" value={item.amount} onChange={e => {
                  const newItems = [...otherIncomeItems];
                  newItems[index].amount = Number(e.target.value);
                  setOtherIncomeItems(newItems);
                }} style={{width:'100px', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} />
                <button onClick={() => setOtherIncomeItems(prev => prev.filter((_, i) => i !== index))} style={{padding:'8px 12px', background:'transparent', border:'1px solid #ccc', borderRadius:'4px', cursor:'pointer'}}>移除</button>
              </div>
            ))}
            <button onClick={() => setOtherIncomeItems(prev => [...prev, {amount:0, note:""}])} style={{padding:'8px 12px', background:'#eee', border:'none', borderRadius:'4px', cursor:'pointer', marginBottom:'20px'}}>新增其他收入</button>

            <h4 style={{marginTop:'20px', marginBottom:'10px'}}>其他支出</h4>
            {otherExpenseItems.map((item, index) => (
              <div key={index} style={{display:'flex', gap:'10px', marginBottom:'10px', alignItems:'center'}}>
                <input type="text" placeholder="支出項目" value={item.note} onChange={e => {
                  const newItems = [...otherExpenseItems];
                  newItems[index].note = e.target.value;
                  setOtherExpenseItems(newItems);
                }} style={{flex:'1', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} />
                <input type="number" placeholder="金額" value={item.amount} onChange={e => {
                  const newItems = [...otherExpenseItems];
                  newItems[index].amount = Number(e.target.value);
                  setOtherExpenseItems(newItems);
                }} style={{width:'100px', padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} />
                <button onClick={() => setOtherExpenseItems(prev => prev.filter((_, i) => i !== index))} style={{padding:'8px 12px', background:'transparent', border:'1px solid #ccc', borderRadius:'4px', cursor:'pointer'}}>移除</button>
              </div>
            ))}
            <button onClick={() => setOtherExpenseItems(prev => [...prev, {amount:0, note:""}])} style={{padding:'8px 12px', background:'#eee', border:'none', borderRadius:'4px', cursor:'pointer', marginBottom:'20px'}}>新增其他支出</button>

            <div className="summary-grid">
              <div className="report-card">
                <h4 style={{marginBottom:'10px'}}>支付平台</h4>
                {paymentItems.map(item => (
                  <div key={item.id} className="summary-item">
                    <span>{item.name}</span>
                    <input type="number" className="editable-input" value={data.items[item.name]?.stock || 0} onChange={e => updateItem(item.name, 'stock', e.target.value)} />
                  </div>
                ))}
              </div>

              <div className="report-card">
                <h4 style={{marginBottom:'10px'}}>財務總計</h4>
                <div className="summary-item"><span>POS 總營收</span><span>${results.posTotal}</span></div>
                <div className="summary-item"><span>實點現金</span><span>${results.cashActual}</span></div>
                <div className="summary-item"><span>售價應收</span><span>${results.salesTotal}</span></div>
                <div className="summary-item"><span>實收誤差</span><span style={{color: results.actualDiff !== 0 ? 'red' : 'inherit'}}>${results.actualDiff}</span></div>
                <div className="summary-item"><span>飯粒溢價</span><span>${results.ricePremium}</span></div>
                <div className="summary-item"><span>誤差值 (最終)</span><span style={{color: results.finalError !== 0 ? 'red' : 'inherit'}}>${results.finalError}</span></div>
              </div>
            </div>

            <button className="submit-btn" disabled={loading} onClick={submit}>{loading ? "正在同步數據..." : "同步至試算表"}</button>
            <button className="submit-btn" onClick={() => setView("home")} style={{background:'#6c757d', marginTop:'10px'}}>返回首頁</button>
          </div>
        </>
      )}

      {view === "historyDetail" && selectedRecord && (
        <div className="report-card">
          <h3 style={{marginBottom:'15px'}}>歷史記錄詳情</h3>
          <p>日期: {selectedRecord.date}</p>
          <p>店別: {selectedRecord.storeName}</p>
          <p>上傳者: {selectedRecord.uploadedBy}</p>
          <p>上傳時間: {formatLocalTime(selectedRecord.createdAt)}</p>
          {/* 這裡可以添加圖片預覽功能，V3.1 再做 */}
          <button className="submit-btn" onClick={() => setView("home")} style={{background:'#6c757d', marginTop:'20px'}}>返回首頁</button>
        </div>
      )}
    </div>
  );
}
