// lib/drive.js — Google Drive file fetching

const { google } = require('googleapis');

function getDriveClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  return google.drive({ version: 'v3', auth });
}

// Extract file ID from a Google Drive sharing URL
function extractFileId(url) {
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /id=([a-zA-Z0-9_-]+)/,
    /^([a-zA-Z0-9_-]{25,})$/, // raw ID
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  throw new Error('Could not extract file ID from URL: ' + url);
}

// Download a file from Drive as a buffer
async function downloadDriveFile(fileIdOrUrl) {
  const drive = getDriveClient();
  const fileId = fileIdOrUrl.includes('/') ? extractFileId(fileIdOrUrl) : fileIdOrUrl;

  // Get file metadata
  const meta = await drive.files.get({ fileId, fields: 'name,mimeType,size' });
  const { name, mimeType } = meta.data;

  // Download file content
  const response = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  );

  const buffer = Buffer.from(response.data);
  return { buffer, filename: name, mimeType };
}

// List all files in the Dokita Books folder
async function listDriveFolder() {
  const drive = getDriveClient();
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!folderId) return [];

  const response = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    fields: 'files(id,name,mimeType,modifiedTime,size)',
    orderBy: 'modifiedTime desc',
  });

  return response.data.files || [];
}

module.exports = { downloadDriveFile, listDriveFolder, extractFileId };
