const { requireAdmin } = require('../../lib/auth');
const { downloadDriveFile } = require('../../lib/drive');
const { processDocument } = require('../../lib/processor');
const { embedText } = require('../../lib/gemini');
const { getSupabaseAdmin } = require('../../lib/supabase');
const { v4: uuidv4 } = require('uuid');

module.exports.config = { maxDuration: 60 };

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();
  if (!requireAdmin(req, res)) return;

  const { driveUrl, title, subject = 'General Medicine', bookId: existingBookId, chunkOffset = 0 } = req.body || {};
  if (!driveUrl || !title) {
    return res.status(400).json({ error: 'driveUrl and title are required' });
  }

  const supabase = getSupabaseAdmin();
  const bookId = existingBookId || uuidv4();
  const BATCH_SIZE = 60;

  try {
    // Upsert book record
    await supabase.from('books').upsert({
      id: bookId, title, filename: title, drive_link: driveUrl,
      subject, status: 'indexing', chunk_count: 0,
      updated_at: new Date().toISOString(),
    });

    // Download + extract text
    const { buffer, filename } = await downloadDriveFile(driveUrl);
    const { chunks } = await processDocument(buffer, filename);
    console.log(`[Dokita] "${title}": ${chunks.length} total chunks, processing from offset ${chunkOffset}`);

    // Process this batch only
    const slice = chunks.slice(chunkOffset, chunkOffset + BATCH_SIZE);
    const isLastBatch = (chunkOffset + BATCH_SIZE) >= chunks.length;

    // Embed batch
    const rows = [];
    for (let i = 0; i < slice.length; i++) {
      const embedding = await embedText(slice[i].content);
      rows.push({
        book_id: bookId, book_title: title, subject,
        chunk_index: chunkOffset + i,
        content: slice[i].content,
        page_hint: slice[i].pageHint || null,
        embedding,
      });
      if (i > 0 && i % 10 === 0) await new Promise(r => setTimeout(r, 300));
    }

    // Save batch
    for (let i = 0; i < rows.length; i += 50) {
      const { error } = await supabase.from('chunks').insert(rows.slice(i, i + 50));
      if (error) throw new Error('DB insert failed: ' + error.message);
    }

    if (isLastBatch) {
      await supabase.from('books').update({
        status: 'ready', chunk_count: chunks.length,
        filename, updated_at: new Date().toISOString(),
      }).eq('id', bookId);
      console.log(`[Dokita] "${title}" fully indexed: ${chunks.length} chunks`);
      return res.status(200).json({ bookId, status: 'ready', totalChunks: chunks.length, done: true });
    }

    const nextOffset = chunkOffset + BATCH_SIZE;
    return res.status(200).json({
      bookId, status: 'indexing', totalChunks: chunks.length,
      processedSoFar: nextOffset, nextOffset, done: false,
    });

  } catch (err) {
    console.error(`[Dokita] Error:`, err.message);
    await supabase.from('books').update({ status: 'error', updated_at: new Date().toISOString() })
      .eq('id', bookId).catch(() => {});
    return res.status(500).json({ error: err.message, bookId, status: 'error' });
  }
};
