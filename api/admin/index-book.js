const { requireAdmin } = require('../../lib/auth');
const { downloadDriveFile } = require('../../lib/drive');
const { processDocument } = require('../../lib/processor');
const { embedText } = require('../../lib/gemini');
const { getSupabaseAdmin } = require('../../lib/supabase');
const { v4: uuidv4 } = require('uuid');

// Tell Vercel to allow up to 300 seconds for this function (Pro) or 60s (Hobby)
module.exports.config = { maxDuration: 60 };

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') return res.status(405).end();
  if (!requireAdmin(req, res)) return;

  const { driveUrl, title, subject = 'General Medicine' } = req.body || {};

  if (!driveUrl || !title) {
    return res.status(400).json({ error: 'driveUrl and title are required' });
  }

  const supabase = getSupabaseAdmin();
  const bookId = uuidv4();

  // Create book record
  await supabase.from('books').insert({
    id: bookId,
    title,
    filename: title,
    drive_link: driveUrl,
    subject,
    status: 'indexing',
    chunk_count: 0,
  });

  // For large books, respond immediately and index in background
  res.status(200).json({ bookId, message: 'Indexing started', status: 'indexing' });

  try {
    // 1. Download from Drive
    const { buffer, filename } = await downloadDriveFile(driveUrl);

    // 2. Extract + chunk text
    const { chunks } = await processDocument(buffer, filename);
    console.log(`[Dokita] ${title}: ${chunks.length} chunks`);

    // 3. Embed each chunk
    const embeddedChunks = [];
    for (let i = 0; i < chunks.length; i++) {
      const embedding = await embedText(chunks[i].content);
      embeddedChunks.push({ ...chunks[i], embedding });
      // Respect Gemini rate limits
      if (i > 0 && i % 15 === 0) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    // 4. Save to Supabase in batches of 50
    const rows = embeddedChunks.map((c) => ({
      book_id: bookId,
      book_title: title,
      subject,
      chunk_index: c.index,
      content: c.content,
      page_hint: c.pageHint || null,
      embedding: c.embedding,
    }));

    for (let i = 0; i < rows.length; i += 50) {
      const { error } = await supabase.from('chunks').insert(rows.slice(i, i + 50));
      if (error) throw error;
    }

    // 5. Mark ready
    await supabase.from('books').update({
      status: 'ready',
      chunk_count: chunks.length,
      filename,
      updated_at: new Date().toISOString(),
    }).eq('id', bookId);

    console.log(`[Dokita] "${title}" indexed: ${chunks.length} chunks`);
  } catch (err) {
    console.error(`[Dokita] Indexing failed for "${title}":`, err.message);
    await supabase.from('books').update({
      status: 'error',
      updated_at: new Date().toISOString(),
    }).eq('id', bookId);
  }
};
