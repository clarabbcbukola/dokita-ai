module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const info = {
    status: 'alive',
    node: process.version,
    env: {
      GEMINI_API_KEY: process.env.GEMINI_API_KEY ? 'SET' : 'MISSING',
      SUPABASE_URL: process.env.SUPABASE_URL ? 'SET' : 'MISSING',
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? 'SET' : 'MISSING',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'MISSING',
      ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ? 'SET' : 'MISSING',
    }
  };

  // test loading each module one by one
  const modules = ['@supabase/supabase-js', '@google/generative-ai', 'pdf-parse', 'mammoth', 'uuid'];
  info.modules = {};
  for (const m of modules) {
    try {
      require(m);
      info.modules[m] = 'OK';
    } catch(e) {
      info.modules[m] = 'FAIL: ' + e.message;
    }
  }

  return res.status(200).json(info);
};
