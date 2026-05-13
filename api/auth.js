module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const APP_PASSWORD = process.env.APP_PASSWORD;

  // No password set → open access
  if (!APP_PASSWORD) {
    return res.json({ success: true, token: 'open' });
  }

  const { password } = req.body || {};
  if (!password || password !== APP_PASSWORD) {
    return res.status(401).json({ error: 'Incorrect password' });
  }

  // Static token derived from password — never expires, rotates when password changes
  const token = Buffer.from(`${APP_PASSWORD}:synersage-crm:v2`).toString('base64');
  return res.json({ success: true, token });
};
