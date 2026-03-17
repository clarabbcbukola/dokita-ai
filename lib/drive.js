// lib/drive.js — Download public Google Drive files directly (no service account needed)

const https = require('https');
const http = require('http');

// Extract file ID from any Google Drive URL format
function extractFileId(url) {
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /id=([a-zA-Z0-9_-]+)/,
    /\/d\/([a-zA-Z0-9_-]+)/,
    /^([a-zA-Z0-9_-]{25,})$/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  throw new Error('Could not extract file ID from Drive URL. Please use a standard Google Drive sharing link.');
}

// Follow redirects and download a URL as a Buffer
function fetchBuffer(url, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 10) return reject(new Error('Too many redirects'));
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchBuffer(res.headers.location, redirectCount + 1));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Download failed: HTTP ${res.statusCode}. Make sure the file is shared as "Anyone with the link".`));
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

// Download a publicly shared Google Drive file
async function downloadDriveFile(urlOrId) {
  const fileId = urlOrId.includes('drive.google.com') || urlOrId.includes('/')
    ? extractFileId(urlOrId)
    : urlOrId;

  // Try direct export URL first (works for most shared files)
  const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;

  console.log(`[Drive] Downloading file ID: ${fileId}`);
  const buffer = await fetchBuffer(downloadUrl);
  console.log(`[Drive] Downloaded ${buffer.length} bytes`);

  // Guess filename from file ID (will be corrected by processor)
  const filename = `document_${fileId}.pdf`;
  return { buffer, filename, mimeType: 'application/pdf' };
}

// List Drive folder — not needed without service account, return empty
async function listDriveFolder() {
  return [];
}

module.exports = { downloadDriveFile, listDriveFolder, extractFileId };
