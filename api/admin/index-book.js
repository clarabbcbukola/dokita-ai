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
  const BATCH_SIZE = 30; // smaller batch = safer within 60s timeout

  try {
    // Step 1: Upsert book record
    const { error: upsertErr } = await supabase.from('books').upsert({
      id: bookId, title, filename: title, drive_link: driveUrl,
      subject, status: 'indexing', chunk_count: 0,
      updated_at: new Date().toISOString(),
    });
    if (upsertErr) throw new Error('DB upsert failed: ' + upsertErr.message);

    // Step 2: Download from Drive
    console.log(`[Dokita] Downloading: ${driveUrl}`);
    let buffer, filename;
    try {
      const result = await downloadDriveFile(driveUrl);
      buffer = result.buffer;
      filename = result.filename;
    } catch (dlErr) {
      throw new Error('Download failed: ' + dlErr.message);
    }

    // Step 3: Extract + chunk text
    console.log(`[Dokita] Processing ${filename}, ${buffer.length} bytes`);
    let chunks;
    try {
      const result = await processDocument(buffer, filename);
      chunks = result.chunks;
    } catch (procErr) {
      throw new Error('Text extraction failed: ' + procErr.message);
    }
    console.log(`[Dokita] "${title}": ${chunks.length} chunks, offset ${chunkOffset}`);

    // Step 4: Process this batch only
    const slice = chunks.slice(chunkOffset, chunkOffset + BATCH_SIZE);
    const isLastBatch = (chunkOffset + BATCH_SIZE) >= chunks.length;

    // Step 5: Embed batch
    const rows = [];
    for (let i = 0; i < slice.length; i++) {
      let embedding;
      try {
        embedding = await embedText(slice[i].content);
      } catch (embErr) {
        throw new Error(`Embedding failed at chunk ${chunkOffset + i}: ${embErr.message}`);
      }
      rows.push({
        book_id: bookId, book_title: title, subject,
        chunk_index: chunkOffset + i,
        content: slice[i].content,
        page_hint: slice[i].pageHint || null,
        embedding,
      });
      if (i > 0 && i % 10 === 0) await new Promise(r => setTimeout(r, 200));
    }

    // Step 6: Save batch to Supabase
    for (let i = 0; i < rows.length; i += 25) {
      const { error: insertErr } = await supabase.from('chunks').insert(rows.slice(i, i + 25));
      if (insertErr) throw new Error('DB insert failed: ' + insertErr.message);
    }

    // Step 7: Mark done or return next offset
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
    console.error(`[Dokita] Error indexing "${title}":`, err.message);
    await supabase.from('books').update({
      status: 'error', updated_at: new Date().toISOString(),
    }).eq('id', bookId).catch(() => {});
    return res.status(500).json({ error: err.message, bookId, status: 'error' });
  }
};
