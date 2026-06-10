export default async function handler(req, res) {
  const { action, username, password } = req.body || {};
  if (action === 'login') {
    // 管理員帳號
    if (username === 'admin' && password === 'admin') {
      return res.status(200).json({ success: true, username: username, role: 'admin' });
    }
    // 新增測試帳號 JAMES
    if (username === 'JAMES' && password === '1234') {
      return res.status(200).json({ success: true, username: username, role: 'admin' });
    }
    return res.status(400).json({ success: false, error: '帳號或密碼錯誤' });
  }
  return res.status(200).json({ success: true });
}
