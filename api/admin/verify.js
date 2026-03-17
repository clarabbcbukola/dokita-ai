// api/admin/verify.js — lightweight password check, no DB needed

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') return res.status(405).end();

  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();
  const expected = (process.env.ADMIN_PASSWORD || '').trim();

  if (!token || !expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (token !== expected) {
    return res.status(403).json({ error: 'Wrong password' });
  }

  return res.status(200).json({ ok: true });
};
