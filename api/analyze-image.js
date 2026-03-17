const { embedText, analyzeImage } = require('../lib/gemini');
const { searchChunks, logQuery } = require('../lib/supabase');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { imageBase64, mimeType, query = 'Analyze this medical image', language = 'en' } = req.body || {};

  if (!imageBase64) return res.status(400).json({ error: 'No image provided' });

  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif'];
  if (!allowed.includes(mimeType)) {
    return res.status(400).json({ error: 'Unsupported image type. Use JPEG or PNG.' });
  }

  try {
    const queryEmbedding = await embedText(query);
    const chunks = await searchChunks(queryEmbedding, { matchCount: 4 });
    const answer = await analyzeImage({ imageBase64, mimeType, query, chunks });

    logQuery(query, 'image', language, chunks.map((c) => c.book_title)).catch(() => {});

    return res.status(200).json({
      answer,
      sources: [...new Set(chunks.map((c) => c.book_title))],
    });
  } catch (err) {
    console.error('Image analysis error:', err.message);
    return res.status(500).json({ error: 'Image analysis failed. Please try again.' });
  }
};
