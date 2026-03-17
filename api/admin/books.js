const { requireAdmin } = require('../../lib/auth');
const { getSupabaseAdmin } = require('../../lib/supabase');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!requireAdmin(req, res)) return;

  const supabase = getSupabaseAdmin();

  // GET — list books + analytics
  if (req.method === 'GET') {
    const { data: books, error } = await supabase
      .from('books')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    const { data: queryStats } = await supabase
      .from('query_log')
      .select('query, mode, created_at')
      .order('created_at', { ascending: false })
      .limit(200);

    const modeCounts = {};
    (queryStats || []).forEach((q) => {
      modeCounts[q.mode] = (modeCounts[q.mode] || 0) + 1;
    });

    const queryCounts = {};
    (queryStats || []).forEach((q) => {
      const key = q.query.toLowerCase().trim().substring(0, 80);
      queryCounts[key] = (queryCounts[key] || 0) + 1;
    });

    const topQueries = Object.entries(queryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([query, count]) => ({ query, count }));

    return res.status(200).json({
      books,
      stats: {
        totalQueries: queryStats?.length || 0,
        modeCounts,
        topQueries,
        recentQueries: (queryStats || []).slice(0, 5),
      },
    });
  }

  // DELETE — remove book + chunks
  if (req.method === 'DELETE') {
    const { bookId } = req.body || {};
    if (!bookId) return res.status(400).json({ error: 'bookId required' });

    const { error } = await supabase.from('books').delete().eq('id', bookId);
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ success: true });
  }

  return res.status(405).end();
};
