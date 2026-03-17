// api/admin/diagnose.js — GET request, no auth needed, just for debugging

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const results = {};

  // 1. Check environment variables
  results.env = {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY ? 'SET (' + process.env.GEMINI_API_KEY.substring(0,8) + '...)' : 'MISSING',
    SUPABASE_URL: process.env.SUPABASE_URL || 'MISSING',
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? 'SET' : 'MISSING',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'MISSING',
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ? 'SET' : 'MISSING',
    NODE_VERSION: process.version,
  };

  // 2. Test Supabase
  try {
    const { createClient } = require('@supabase/supabase-js');
    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await sb.from('books').select('id').limit(1);
    results.supabase = error ? 'ERROR: ' + error.message : 'OK - connected, books table exists';
  } catch (e) {
    results.supabase = 'CRASH: ' + e.message;
  }

  // 3. Test Gemini
  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
    const result = await model.embedContent('test');
    results.gemini = result.embedding ? 'OK - embedding works' : 'ERROR: no embedding returned';
  } catch (e) {
    results.gemini = 'CRASH: ' + e.message;
  }

  // 4. Test pdf-parse
  try {
    require('pdf-parse');
    results.pdfParse = 'OK - module loaded';
  } catch (e) {
    results.pdfParse = 'CRASH: ' + e.message;
  }

  // 5. Test mammoth
  try {
    require('mammoth');
    results.mammoth = 'OK - module loaded';
  } catch (e) {
    results.mammoth = 'CRASH: ' + e.message;
  }

  // 6. Test Drive download if URL provided
  const driveUrl = req.query.url;
  if (driveUrl) {
    try {
      const { downloadDriveFile } = require('../../lib/drive');
      const { buffer } = await downloadDriveFile(driveUrl);
      results.drive = 'OK - downloaded ' + buffer.length + ' bytes';
    } catch (e) {
      results.drive = 'CRASH: ' + e.message;
    }
  } else {
    results.drive = 'SKIPPED - add ?url=YOUR_DRIVE_URL to test';
  }

  return res.status(200).json({ ok: true, results });
};
