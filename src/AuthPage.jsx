import React, { useState } from 'react';

const STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@400;700;900&display=swap');
  .auth-container {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    background-color: #f5f0e8;
    font-family: 'Noto Serif TC', serif;
    color: #121212;
  }
  .auth-card {
    background: #fff;
    padding: 50px 40px;
    border-radius: 2px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.05);
    width: 100%;
    max-width: 420px;
    border-top: 5px solid #121212;
    position: relative;
  }
  .auth-card::before {
    content: "";
    position: absolute;
    top: 0; left: 0; right: 0; height: 1px;
    background: #c0392b;
    transform: translateY(5px);
  }
  .auth-title {
    text-align: center;
    font-size: 28px;
    font-weight: 900;
    margin-bottom: 10px;
    letter-spacing: 2px;
  }
  .auth-subtitle {
    text-align: center;
    font-size: 14px;
    color: #c0392b;
    margin-bottom: 40px;
    font-weight: 700;
    letter-spacing: 4px;
    text-transform: uppercase;
  }
  .form-group { margin-bottom: 25px; }
  .form-label {
    display: block;
    font-size: 13px;
    font-weight: 700;
    margin-bottom: 8px;
    color: #555;
    letter-spacing: 1px;
  }
  .form-input {
    width: 100%;
    padding: 12px 15px;
    border: 1px solid #ddd;
    border-radius: 0;
    font-family: 'Noto Serif TC', serif;
    font-size: 16px;
    transition: 0.3s;
    background: #fafafa;
  }
  .form-input:focus {
    outline: none;
    border-color: #121212;
    background: #fff;
  }
  .auth-btn {
    width: 100%;
    padding: 16px;
    background: #121212;
    color: #fff;
    border: none;
    font-family: 'Noto Serif TC', serif;
    font-weight: 700;
    font-size: 16px;
    letter-spacing: 2px;
    cursor: pointer;
    transition: 0.3s;
    margin-top: 10px;
  }
  .auth-btn:hover { background: #c0392b; }
  .auth-btn:disabled { background: #ccc; cursor: not-allowed; }
  .auth-footer {
    text-align: center;
    margin-top: 30px;
    font-size: 12px;
    color: #999;
    letter-spacing: 1px;
  }
`;

export default function AuthPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) return;
    setLoading(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', username, password })
      });
      const data = await res.json();
      if (data.success) {
        sessionStorage.setItem('current_user', data.username);
        sessionStorage.setItem('user_role', data.role);
        onLogin({ username: data.username, role: data.role });
      } else {
        alert(data.error || '登入失敗，請檢查帳號密碼');
      }
    } catch (err) {
      console.error(err);
      alert('系統連線錯誤，請確認網路狀態');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <style>{STYLE}</style>
      <div className="auth-card">
        <h1 className="auth-title">黑武藏職人營收</h1>
        <p className="auth-subtitle">ADMINISTRATION</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">帳號 / USERNAME</label>
            <input 
              type="text" 
              className="form-input" 
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              placeholder="請輸入帳號"
              required 
            />
          </div>
          <div className="form-group">
            <label className="form-label">密碼 / PASSWORD</label>
            <input 
              type="password" 
              className="form-input" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              placeholder="請輸入密碼"
              required 
            />
          </div>
          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? '驗證中...' : '進入系統'}
          </button>
        </form>
        <div className="auth-footer">
          © 2026 BLACK SAMURAI . ALL RIGHTS RESERVED
        </div>
      </div>
    </div>
  );
}
// Trigger Vercel redeployment
