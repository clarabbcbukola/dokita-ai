// lib/auth.js — Admin authentication

function requireAdmin(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  const token = authHeader.replace('Bearer ', '');
  if (token !== process.env.ADMIN_PASSWORD) {
    res.status(403).json({ error: 'Invalid admin password' });
    return false;
  }
  return true;
}

module.exports = { requireAdmin };
