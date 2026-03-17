// lib/supabase.js — Supabase client + vector search

const { createClient } = require('@supabase/supabase-js');

// Public client (for frontend reads)
function getSupabaseClient() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );
}

// Admin client (for indexing — uses service role)
function getSupabaseAdmin() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Search for relevant chunks given a query embedding
async function searchChunks(queryEmbedding, { matchCount = 5, subject = null } = {}) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('match_chunks', {
    query_embedding: queryEmbedding,
    match_count: matchCount,
    filter_subject: subject,
  });
  if (error) throw new Error(`Vector search failed: ${error.message}`);
  return data || [];
}

// Insert chunks with embeddings for a book
async function insertChunks(bookId, bookTitle, subject, chunks) {
  const supabase = getSupabaseAdmin();
  const rows = chunks.map((c) => ({
    book_id: bookId,
    book_title: bookTitle,
    subject,
    chunk_index: c.index,
    content: c.content,
    page_hint: c.pageHint || null,
    embedding: c.embedding,
  }));

  // Insert in batches of 50
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    const { error } = await supabase.from('chunks').insert(batch);
    if (error) throw new Error(`Chunk insert failed: ${error.message}`);
  }
}

// Log a user query for analytics
async function logQuery(query, mode, language, matchedBooks) {
  const supabase = getSupabaseClient();
  await supabase.from('query_log').insert({
    query,
    mode,
    language,
    matched_books: matchedBooks,
  });
}

// Get all books
async function getBooks() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

// Get top queried topics for analytics
async function getTopQueries(limit = 20) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('query_log')
    .select('query, mode, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

module.exports = {
  getSupabaseClient,
  getSupabaseAdmin,
  searchChunks,
  insertChunks,
  logQuery,
  getBooks,
  getTopQueries,
};
