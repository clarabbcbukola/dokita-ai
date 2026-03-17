const path = require('path');
const { embedText, generateAnswer } = require('../lib/gemini');
const { searchChunks, logQuery } = require('../lib/supabase');

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query, mode = 'chat', language = 'en', subject = null } = req.body || {};

  if (!query || String(query).trim().length < 2) {
    return res.status(400).json({ error: 'Please enter a question.' });
  }

  try {
    // 1. Embed the question
    const queryEmbedding = await embedText(String(query).trim());

    // 2. Find relevant book chunks
    const chunks = await searchChunks(queryEmbedding, {
      matchCount: 6,
      subject: subject || null,
    });

    if (!chunks || chunks.length === 0) {
      return res.status(200).json({
        answer: `I could not find relevant information in the uploaded medical textbooks for this question. Make sure relevant books have been indexed in the admin panel, or try rephrasing your question.\n\n*Dokita AI answers only from your uploaded textbooks.*`,
        sources: [],
        mode,
      });
    }

    // 3. Generate answer with Gemini
    const answer = await generateAnswer({ query, chunks, mode, language });

    // 4. Log query for analytics (non-blocking)
    const matchedBooks = [...new Set(chunks.map((c) => c.book_title))];
    logQuery(query, mode, language, matchedBooks).catch(() => {});

    return res.status(200).json({ answer, sources: matchedBooks, mode });
  } catch (err) {
    console.error('Chat error:', err.message);
    return res.status(500).json({
      error: 'Something went wrong. Please try again.',
    });
  }
};
