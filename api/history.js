export default async function handler(req, res) {
  try {
    const GOOGLE_URL = 'https://script.google.com/macros/s/AKfycbxpRCTtrtS30vPP8PwU7eELC17X9QUnYd9RiH_tJ5faOxjnsG7RttbAsCSDEbSnpCP7/exec?type=GET_HISTORY_V2';
    const response = await fetch(GOOGLE_URL, { redirect: "follow" });
    const result = await response.json();
    return res.status(200).json({ success: true, history: result.history || [] });
  } catch (err) {
    return res.status(200).json({ success: false, error: "目前無法從 Google 獲取歷史數據，請檢查 Google 腳本權限。" });
  }
}
